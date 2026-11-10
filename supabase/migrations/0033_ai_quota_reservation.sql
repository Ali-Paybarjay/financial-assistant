-- ------------------------------------- a quota that two requests cannot share --
--
-- The ceiling on model calls was enforced by counting and then calling:
--
--   const allowance = await remainingCalls(timeZone, feature);
--   if (allowance.remaining <= 0) return refused;
--   await complete(...);           // real money at the provider
--   await logUsage(...);           // the row that makes the count go up
--
-- Two requests arriving together both read a count below the ceiling, both
-- proceed, and both spend. The comment above it said so and called the trade
-- «cheaper than serialising every request through a lock», which is a fair
-- judgement about one extra call and a poor one about a limit: the window is a
-- whole day wide, so a client that fires n requests at once gets n calls
-- regardless of what the ceiling says. A rate limit that any loop can step
-- straight through is decoration.
--
-- The count also had nothing to say about *whose* calls it was counting. It
-- filtered by date and by feature and left the user to RLS — which was right
-- for an ordinary user and wrong for an admin, whose read policy on
-- `ai_usage_logs` (migration 0027) covers everybody's rows. So the operator's
-- own allowance was measured against the whole product's usage. That was F12.
--
-- So: reserve first, settle after. This function counts and writes the row in
-- one statement pair, under a per-user advisory lock held to the end of the
-- transaction, and returns the row's id. The caller then makes the model call
-- and updates that row with what it cost. A request that dies between the two
-- leaves a row marked `reserved`, which still counts against the day — the safe
-- direction, because over-counting costs the user one call and under-counting
-- costs real money at the provider.
--
-- `security definer`, and necessarily: there is deliberately no insert policy on
-- `ai_usage_logs`, because a client that could forge its own usage rows could
-- erase its own rate limit. The function writes on the caller's behalf with the
-- user id taken from `auth.uid()` and never from an argument, so «forge a row»
-- and «reserve your own call» stay different things.

create or replace function public.reserve_ai_call(
  p_feature text,
  p_limit int,
  p_since timestamptz,
  -- A guest is capped across all three features at once rather than per
  -- feature: their ceiling exists to keep the demo affordable for an account
  -- that costs one tap to make. See lib/ai/usage.ts.
  p_per_feature boolean default true,
  p_model text default 'unknown'
)
returns table (reservation_id uuid, used int, allowed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_limit int := greatest(coalesce(p_limit, 0), 0);
  v_used int;
  v_id uuid;
begin
  -- Serialises reservations for this one user, and only until the transaction
  -- ends. Two requests from the same person queue behind each other for the
  -- length of one insert; two requests from different people never meet. This
  -- is the «lock» the old comment was avoiding, and it is a great deal cheaper
  -- than it sounds — the alternative was a ceiling that did not hold.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*)::int into v_used
  from public.ai_usage_logs l
  where l.user_id = v_user
    and l.created_at >= p_since
    and (not p_per_feature or l.feature = p_feature);

  if v_used >= v_limit then
    -- Refused, and the refusal is itself worth a row: «how often do people hit
    -- the ceiling» is a question the admin panel already asks, and it cannot be
    -- answered from calls that were never made.
    insert into public.ai_usage_logs
      (user_id, feature, provider, model, status)
    values (v_user, p_feature, 'openrouter', p_model, 'rejected');

    return query select null::uuid, v_used, false;
    return;
  end if;

  insert into public.ai_usage_logs
    (user_id, feature, provider, model, status)
  values (v_user, p_feature, 'openrouter', p_model, 'reserved')
  returning id into v_id;

  return query select v_id, v_used, true;
end;
$$;

revoke execute on function public.reserve_ai_call(text, int, timestamptz, boolean, text)
  from public, anon;
grant execute on function public.reserve_ai_call(text, int, timestamptz, boolean, text)
  to authenticated;

comment on function public.reserve_ai_call(text, int, timestamptz, boolean, text) is
  'Counts this user''s calls since p_since and writes the usage row in the same transaction, under a per-user advisory lock, returning the row id to settle against. A row left at status=reserved is a request that died mid-flight and still counts. See migration 0033 and F12.';

-- A reservation is read by user and by day, and it is now read on the critical
-- path of every model call. The existing (user_id, created_at desc) index
-- serves it; this one carries `feature` so the per-feature count is satisfied
-- from the index alone.
create index if not exists ai_usage_logs_user_feature_created_idx
  on public.ai_usage_logs (user_id, feature, created_at desc);

-- ------------------------------------- the reports have to know the new status --

-- `reserved` is a new value in `ai_usage_logs.status`, and two reports in
-- migration 0027 carry the list of what counts as a failure written out in SQL.
-- lib/admin/status.ts carries the same list in TypeScript, and the comment there
-- says the two must agree — so they are updated together.
--
-- A reservation nobody closed is a failure for the operator's purposes: it means
-- a request vanished between claiming the quota and recording what the call
-- cost, so the money may be spent with nothing saying what it bought. It is not
-- `rejected`, which is the app deliberately refusing to spend.
--
-- Only the status lists change. Everything else in both functions is copied
-- from 0027 unchanged.

create or replace function public.admin_ai_top_users(
  p_from date,
  p_to date,
  p_tz text default 'UTC',
  p_limit int default 10
)
returns table (
  user_id      uuid,
  email        text,
  is_anonymous boolean,
  calls        bigint,
  cost_cents   bigint,
  rejected     bigint,
  failed       bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 100);
begin
  perform public.assert_admin();

  return query
  select
    l.user_id,
    nullif(u.email, ''),
    u.is_anonymous,
    count(*),
    coalesce(sum(l.cost_cents), 0),
    count(*) filter (where l.status = 'rejected'),
    count(*) filter (
      where l.status in ('timeout', 'rate_limit', 'provider', 'malformed', 'reserved')
    )
  from public.ai_usage_logs l
  join auth.users u on u.id = l.user_id
  where (l.created_at at time zone p_tz)::date between p_from and p_to
  group by l.user_id, u.email, u.is_anonymous
  order by count(*) desc
  limit v_limit;
end;
$$;

revoke execute on function public.admin_ai_top_users(date, date, text, int) from public, anon;
grant execute on function public.admin_ai_top_users(date, date, text, int) to authenticated;

create or replace function public.admin_overview(
  p_tz text default 'UTC',
  p_retention_days int default 7
)
returns table (
  users_total         bigint,
  users_guests        bigint,
  users_registered    bigint,
  users_onboarded     bigint,
  users_new_7d        bigint,
  users_active_7d     bigint,
  transactions_total  bigint,
  transactions_7d     bigint,
  dong_groups_total   bigint,
  dong_groups_open    bigint,
  ai_calls_today      bigint,
  ai_calls_7d         bigint,
  ai_calls_30d        bigint,
  ai_cost_cents_30d   bigint,
  ai_failures_7d      bigint,
  ai_rate_limited_7d  bigint,
  imports_open        bigint,
  imports_failed_7d   bigint,
  media_count         bigint,
  media_bytes         bigint,
  guests_stale        bigint,
  last_purge_at       timestamptz,
  last_purge_result   jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
begin
  perform public.assert_admin();

  return query
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where is_anonymous),
    (select count(*) from auth.users where not is_anonymous),
    (select count(*) from public.profiles where onboarding_completed_at is not null),
    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    -- last_sign_in_at rather than created_at, and the same coalesce the guest
    -- sweep uses: a row that has never signed in is as old as it is.
    (select count(*) from auth.users
      where coalesce(last_sign_in_at, created_at) > now() - interval '7 days'),
    -- Counts. Never a sum: rule of this migration's header.
    (select count(*) from public.transactions where deleted_at is null),
    (select count(*) from public.transactions
      where deleted_at is null and created_at > now() - interval '7 days'),
    (select count(*) from public.dong_groups),
    (select count(*) from public.dong_groups where settled_at is null),
    (select count(*) from public.ai_usage_logs
      where (created_at at time zone p_tz)::date = v_today),
    (select count(*) from public.ai_usage_logs where created_at > now() - interval '7 days'),
    (select count(*) from public.ai_usage_logs where created_at > now() - interval '30 days'),
    -- logUsage() rounds to whole cents and stores 0 as null, so this
    -- under-reports every sub-cent call. The UI says «تقریبی» for that
    -- reason; see DECISIONS.md.
    (select coalesce(sum(cost_cents), 0) from public.ai_usage_logs
      where created_at > now() - interval '30 days'),
    -- `rejected` is the app refusing before spending anything (over the
    -- ceiling, or the model switched off), so it is not a failure. Every other
    -- non-ok status is, including `reserved` — a call that was claimed and never
    -- settled, which means the request vanished between taking the quota and
    -- recording what the call cost. The same list lives in lib/admin/status.ts.
    (select count(*) from public.ai_usage_logs
      where created_at > now() - interval '7 days'
        and status in ('timeout', 'rate_limit', 'provider', 'malformed', 'reserved')),
    (select count(*) from public.ai_usage_logs
      where created_at > now() - interval '7 days' and status = 'rejected'),
    (select count(*) from public.statement_imports
      where status in ('uploading', 'parsing', 'review')),
    (select count(*) from public.statement_imports
      where status = 'failed' and created_at > now() - interval '7 days'),
    (select count(*) from public.media_assets),
    (select coalesce(sum(size_bytes), 0)::bigint from public.media_assets),
    (select count(*) from auth.users
      where is_anonymous
        and coalesce(last_sign_in_at, created_at)
            < now() - make_interval(days => p_retention_days)),
    (select started_at from public.cron_runs
      where job = 'purge-guests' order by started_at desc limit 1),
    (select result from public.cron_runs
      where job = 'purge-guests' order by started_at desc limit 1);
end;
$$;

revoke execute on function public.admin_overview(text, int) from public, anon;
grant execute on function public.admin_overview(text, int) to authenticated;
