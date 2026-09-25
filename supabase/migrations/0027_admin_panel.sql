-- ------------------------------------------------------------ an operator --

-- The app has an operator, and until now it had no way to be operated.
--
-- Three things in this product cost money or lose data when nobody is
-- watching, and none of them was visible anywhere: what the model spends and
-- who spends it, which bank-statement imports failed and why, and whether the
-- nightly guest sweep actually ran. Answering any of those meant opening the
-- Supabase dashboard and writing SQL by hand, which is not a thing that gets
-- done on a Tuesday.
--
-- So: an admin panel. What follows is the half of it that lives in the
-- database — who counts as an admin, what an admin may read, and the reports
-- the panel is built from.
--
-- ---------------------------------------------------------------------------
-- THE PRIVACY LINE, which every function below is shaped by
--
-- The panel never reads anybody's ledger. Not one transaction, not one
-- account balance, not one goal, not one shared expense. It gets counts,
-- aggregates and metadata, and that is all it is able to get: no admin policy
-- is added to transactions, accounts, goals, income_sources,
-- recurring_expenses, category_budgets, variable_expense_baselines,
-- statement_lines or any dong_* table, and the reports that touch those
-- tables return `count(*)` and `max(occurred_on)` — never `sum(amount)`.
--
-- Four tables do get an admin read policy, because their rows are about the
-- account rather than about the money: profiles, ai_usage_logs,
-- statement_imports and media_assets. A row-level policy cannot hide a
-- column, so these columns are ledger content and the app deliberately never
-- selects them (lib/admin/queries.ts lists explicit columns for this reason):
--
--   profiles.monthly_income_estimate, .debt_amount,
--           .emergency_fund_months, .savings_rate_estimate
--   statement_imports.closing_balance
--   media_assets.extracted, .storage_path
--
-- A leak in the panel should cost an email address, not somebody's salary.
--
-- ---------------------------------------------------------------------------
-- WHY A JWT CLAIM, AND WHY RPCs
--
-- Admin-ness lives in `auth.users.raw_app_meta_data.role`, which GoTrue
-- publishes as the `app_metadata` claim. The user cannot write it — that is
-- the whole difference from `user_metadata`, which they can — and it arrives
-- in the token, so is_admin() costs no query. It is granted by
-- scripts/grant-admin.mjs and by nothing else; there is no UI for it, because
-- a single-operator product does not need one and a page that can create
-- admins is a page worth attacking.
--
-- The reports are `security definer` RPCs rather than service-role reads in
-- Next. Two reasons. The service-role key bypasses RLS entirely and is the
-- top risk in PLAN.md (R6); it is currently used in five places and every one
-- of them had to be argued for, so «the admin panel» should not become a
-- sixth reason to reach for it on every page. And a definer function can read
-- auth.users, which PostgREST cannot expose at all — so the alternative was
-- not «service role or RLS», it was «service role or nothing».
--
-- Each one starts by asserting admin and raises 42501 otherwise, so the
-- function is its own gate: being reachable by `authenticated` is not being
-- readable by `authenticated`.

-- ------------------------------------------------------------------ who --

-- Reads only the caller's own token, so it is safe for anyone to execute and
-- the default grant stays. The admin layout calls it directly to find out
-- whether the *token* has caught up with the grant — see requireAdmin().
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is
  'True when the caller''s JWT carries app_metadata.role = admin. Granted only by scripts/grant-admin.mjs; reaches the token on the next refresh or sign-in.';

-- The first statement of every admin RPC. A shared raise, so «admin only»
-- cannot drift into meaning three different things in three functions, and so
-- a new report that forgets the check is a one-line diff to spot in review.
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

-- ------------------------------------------------------- what admin reads --

-- Permissive policies, OR'd with the owner policies already on these tables.
-- Nothing an owner could do gets taken away; an admin gets select and only
-- select.

-- Identity and setup. Never the four income/debt columns — see the header.
create policy profiles_admin_select on public.profiles for select to authenticated
  using ((select public.is_admin()));

-- The whole point of the panel. Feature, model, tokens, cost, latency,
-- status: all of it is about the call, none of it about the purchase.
create policy ai_usage_logs_admin_select on public.ai_usage_logs for select to authenticated
  using ((select public.is_admin()));

-- Import metadata, for finding the failed and the stuck. Never
-- closing_balance, and statement_lines stays closed: those rows are the
-- bank's description of the user's spending, which is the ledger by another
-- name.
create policy statement_imports_admin_select on public.statement_imports for select to authenticated
  using ((select public.is_admin()));

-- Upload metadata, for storage size and failed parses. Never `extracted`
-- (which is what the model read off the receipt) and never storage_path
-- (which is the key to the file itself). The buckets keep their own policies,
-- so the bytes stay unreachable either way.
create policy media_assets_admin_select on public.media_assets for select to authenticated
  using ((select public.is_admin()));

-- System categories were editable by SQL alone. They are 20 rows that appear
-- on every user's composer and inside the model's prompt, so renaming one is
-- a product change — it belongs in a UI with a confirmation, not in a psql
-- session. Scoped to `is_system` rows: an admin has no business editing a
-- category somebody invented for themselves.
create policy categories_admin_insert on public.categories for insert to authenticated
  with check ((select public.is_admin()) and is_system and user_id is null);

create policy categories_admin_update on public.categories for update to authenticated
  using ((select public.is_admin()) and is_system)
  with check ((select public.is_admin()) and is_system and user_id is null);

create policy categories_admin_delete on public.categories for delete to authenticated
  using ((select public.is_admin()) and is_system);

-- ------------------------------------------------------------- audit log --

-- Every admin action that changes something, with who did it.
--
-- actor_email is stored beside actor_id rather than joined on read: the log
-- has to survive the admin account being deleted, and a log that says «some
-- uuid deleted a user» is not a log. The FK goes to null in that case and the
-- address stays.
--
-- Insert-only. No update policy and no delete policy, so a row cannot be
-- edited or removed through the API by anyone — including the admin who wrote
-- it, which is the only property that makes an audit log worth keeping.
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  -- Dotted and coarse: user.delete, guests.purge, category.save,
  -- category.delete, settings.save. Owned by lib/admin/actions.ts.
  action      text not null,
  target_type text,
  -- text, not uuid: the target is sometimes a category slug or a settings
  -- key, and sometimes nothing at all.
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using ((select public.is_admin()));

create policy admin_audit_log_insert on public.admin_audit_log for insert to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- -------------------------------------------------------------- cron runs --

-- What the nightly sweep did.
--
-- /api/cron/purge-guests has been returning {found, purged, failed} to
-- Vercel's scheduler since it was written, which means the answer to «did the
-- guests get cleaned up» has been sitting in a log nobody reads. Migration
-- 0018 is the standing reminder here: the first version of that sweep failed
-- silently every night at 03:17 and would have gone on doing so until a real
-- guest appeared. A job with no record is a job you find out about late.
--
-- No insert policy, on purpose, exactly like ai_usage_logs: the writer is the
-- service role, and a client that could forge a «purged 7, failed 0» row
-- could hide a broken sweep.
create table public.cron_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text not null,
  -- The admin's «purge now» button runs the same code as the scheduler, so
  -- the two are distinguished here rather than by two tables.
  triggered_by text not null check (triggered_by in ('cron', 'admin')),
  started_at   timestamptz not null default now(),
  -- null while running, which is also how a run that crashed mid-way reads.
  finished_at  timestamptz,
  result       jsonb,
  error        text
);

alter table public.cron_runs enable row level security;

create policy cron_runs_select on public.cron_runs for select to authenticated
  using ((select public.is_admin()));

create index cron_runs_job_started_idx on public.cron_runs (job, started_at desc);

-- ----------------------------------------------------------- app settings --

-- The handful of numbers that should be changeable without a deploy.
--
-- All five have lived as constants in TypeScript, and all five are things an
-- operator wants to change in the middle of a bad afternoon: the AI kill
-- switch when OpenRouter credit runs out or somebody is farming guest
-- accounts, the per-feature daily ceilings, the guest ceiling, how long an
-- abandoned guest is kept, and a maintenance sentence to put above the app.
-- Waiting out a build to turn the model off is the wrong shape of slow.
--
-- The constants stay in the code as defaults, and lib/settings.ts falls back
-- to them per key. A missing row, a malformed value, or a database that
-- cannot be reached leaves the app behaving exactly as it does today.
--
-- One row per key rather than one row of columns, so adding the sixth knob is
-- an insert rather than a migration.
create table public.app_settings (
  key        text primary key,
  -- not null, and every value is a real JSON value — never JSON null. An unset
  -- maintenance banner is the empty string, because supabase-js sends a
  -- JavaScript null as SQL NULL and «clear the banner» would otherwise fail
  -- this constraint. See lib/settings.ts.
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

-- Readable by every signed-in user, because the app itself reads it on paths
-- that have nothing to do with the panel: the composer needs to know whether
-- the model is on, and the shell needs the banner text. Nothing here is
-- private — the ceilings are already reported to the user when they hit one.
create policy app_settings_select on public.app_settings for select to authenticated
  using (true);

create policy app_settings_insert on public.app_settings for insert to authenticated
  with check ((select public.is_admin()) and updated_by = (select auth.uid()));

create policy app_settings_update on public.app_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and updated_by = (select auth.uid()));

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- The defaults, written as data so the panel has something to show on its
-- first load. `do nothing` keeps a re-run from undoing an operator's change.
insert into public.app_settings (key, value) values
  ('ai_enabled',          'true'::jsonb),
  ('ai_daily_limits',     '{"parse_text": 60, "parse_receipt": 20, "parse_statement": 5}'::jsonb),
  ('guest_daily_calls',   '3'::jsonb),
  ('guest_retention_days','7'::jsonb),
  ('maintenance_banner',  '""'::jsonb)
on conflict (key) do nothing;

-- ================================================================ reports --
--
-- All of the following: `security definer` (they read auth.users, which no
-- policy can reach), `set search_path = ''`, `assert_admin()` first, and
-- execute revoked from public and anon. They are reachable by
-- `authenticated` because that is the role a signed-in admin has; the assert
-- is what makes reachable different from readable.

-- --------------------------------------------------------------- overview --

-- One row, one round trip. The overview page is the page most likely to be
-- left open, so it is deliberately a single call rather than fifteen.
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
    -- ceiling, or the model switched off), so it is not a failure. The other
    -- four non-ok statuses are.
    (select count(*) from public.ai_usage_logs
      where created_at > now() - interval '7 days'
        and status in ('timeout', 'rate_limit', 'provider', 'malformed')),
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

-- ------------------------------------------------------- signups per day --

-- Guests and registered accounts counted apart, because they answer different
-- questions: one is interest, the other is adoption, and added together they
-- are neither.
create or replace function public.admin_signups_daily(
  p_from date,
  p_to date,
  p_tz text default 'UTC'
)
returns table (
  day        date,
  guests     bigint,
  registered bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    (u.created_at at time zone p_tz)::date as day,
    count(*) filter (where u.is_anonymous)     as guests,
    count(*) filter (where not u.is_anonymous) as registered
  from auth.users u
  where (u.created_at at time zone p_tz)::date between p_from and p_to
  group by 1
  order by 1;
end;
$$;

revoke execute on function public.admin_signups_daily(date, date, text) from public, anon;
grant execute on function public.admin_signups_daily(date, date, text) to authenticated;

-- ------------------------------------------------------------------ users --

-- The list, with its filters and its total in the same row set.
--
-- total_count rides along as a window function rather than being a second
-- call: two queries against a table that is being written to disagree about
-- how many rows there are, and the pager built on them then offers a page
-- that is not there.
create or replace function public.admin_users(
  p_q text default null,
  p_kind text default 'all',
  p_provider text default null,
  p_page int default 1,
  p_page_size int default 25
)
returns table (
  id              uuid,
  email           text,
  full_name       text,
  provider        text,
  is_anonymous    boolean,
  is_admin        boolean,
  onboarded       boolean,
  onboarding_step int,
  country_code    text,
  base_currency   text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  ai_calls_30d    bigint,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Clamped rather than trusted: these arrive from a query string.
  v_size int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.assert_admin();

  return query
  select
    u.id,
    -- An anonymous user's email is '' rather than null, and an empty string
    -- is not an address. Same normalisation lib/auth.ts does.
    nullif(u.email, '') as email,
    p.full_name,
    case
      when u.is_anonymous then 'guest'
      else coalesce(u.raw_app_meta_data ->> 'provider', 'unknown')
    end as provider,
    u.is_anonymous,
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' as is_admin,
    p.onboarding_completed_at is not null as onboarded,
    coalesce(p.onboarding_step, 0) as onboarding_step,
    p.country_code,
    p.base_currency,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.ai_usage_logs l
      where l.user_id = u.id and l.created_at > now() - interval '30 days') as ai_calls_30d,
    count(*) over () as total_count
  -- left join: a user whose profile row has not been created yet still
  -- exists, and a list that hides them is a list that cannot explain the
  -- count on the overview page.
  from auth.users u
  left join public.profiles p on p.id = u.id
  where (
      v_q is null
      or u.email ilike '%' || v_q || '%'
      or p.full_name ilike '%' || v_q || '%'
    )
    and case coalesce(p_kind, 'all')
      when 'guest'      then u.is_anonymous
      when 'registered' then not u.is_anonymous
      when 'onboarded'  then p.onboarding_completed_at is not null
      when 'pending'    then p.onboarding_completed_at is null
      else true
    end
    and (
      p_provider is null
      or p_provider = ''
      or case
           when u.is_anonymous then 'guest'
           else coalesce(u.raw_app_meta_data ->> 'provider', 'unknown')
         end = p_provider
    )
  order by u.created_at desc
  limit v_size offset (v_page - 1) * v_size;
end;
$$;

revoke execute on function public.admin_users(text, text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, text, int, int) to authenticated;

-- ------------------------------------------------------------ one user --

-- Everything about an account except what they spent.
--
-- The counts are what an operator answering a support email needs: «is this
-- account empty», «has this person actually used it», «how much have they
-- cost». None of them needs an amount, and every one of them would be a
-- reason to add `sum(amount)` if the shape allowed it. It does not.
create or replace function public.admin_user_detail(p_id uuid)
returns table (
  id                   uuid,
  email                text,
  full_name            text,
  provider             text,
  is_anonymous         boolean,
  is_admin             boolean,
  created_at           timestamptz,
  last_sign_in_at      timestamptz,
  country_code         text,
  timezone             text,
  base_currency        text,
  onboarding_step      int,
  onboarding_completed_at timestamptz,
  default_workspace    text,
  theme                text,
  transactions_count   bigint,
  accounts_count       bigint,
  goals_count          bigint,
  dong_groups_count    bigint,
  imports_count        bigint,
  media_count          bigint,
  media_bytes          bigint,
  ai_calls_30d         bigint,
  ai_cost_cents_30d    bigint,
  last_transaction_on  date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    u.id,
    nullif(u.email, ''),
    p.full_name,
    case
      when u.is_anonymous then 'guest'
      else coalesce(u.raw_app_meta_data ->> 'provider', 'unknown')
    end,
    u.is_anonymous,
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
    u.created_at,
    u.last_sign_in_at,
    p.country_code,
    p.timezone,
    p.base_currency,
    coalesce(p.onboarding_step, 0),
    p.onboarding_completed_at,
    p.default_workspace,
    p.theme,
    (select count(*) from public.transactions t
      where t.user_id = u.id and t.deleted_at is null),
    (select count(*) from public.accounts a where a.user_id = u.id),
    (select count(*) from public.goals g where g.user_id = u.id),
    (select count(*) from public.dong_groups d where d.user_id = u.id),
    (select count(*) from public.statement_imports s where s.user_id = u.id),
    (select count(*) from public.media_assets m where m.user_id = u.id),
    (select coalesce(sum(m.size_bytes), 0)::bigint from public.media_assets m
      where m.user_id = u.id),
    (select count(*) from public.ai_usage_logs l
      where l.user_id = u.id and l.created_at > now() - interval '30 days'),
    (select coalesce(sum(l.cost_cents), 0) from public.ai_usage_logs l
      where l.user_id = u.id and l.created_at > now() - interval '30 days'),
    -- A date, not an amount: «are they still using it».
    (select max(t.occurred_on) from public.transactions t
      where t.user_id = u.id and t.deleted_at is null)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_id;
end;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- --------------------------------------------------------------- ai usage --

-- Raw-ish, on purpose: one row per (day, feature, status, model) and the
-- page folds it into the four views it wants. Four functions returning four
-- shapes of the same table would be four things to keep in step, and the
-- grain here is small enough that the fold is cheaper than the round trips.
create or replace function public.admin_ai_usage_daily(
  p_from date,
  p_to date,
  p_tz text default 'UTC'
)
returns table (
  day           date,
  feature       text,
  status        text,
  model         text,
  calls         bigint,
  cost_cents    bigint,
  input_tokens  bigint,
  output_tokens bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    (l.created_at at time zone p_tz)::date as day,
    l.feature,
    l.status,
    l.model,
    count(*),
    coalesce(sum(l.cost_cents), 0),
    coalesce(sum(l.input_tokens), 0)::bigint,
    coalesce(sum(l.output_tokens), 0)::bigint
  from public.ai_usage_logs l
  where (l.created_at at time zone p_tz)::date between p_from and p_to
  group by 1, 2, 3, 4
  order by 1, 2, 3, 4;
end;
$$;

revoke execute on function public.admin_ai_usage_daily(date, date, text) from public, anon;
grant execute on function public.admin_ai_usage_daily(date, date, text) to authenticated;

-- Latency over the calls that actually completed. A timeout's latency is the
-- budget, not the model's speed, so including it would make the number say
-- «we are slow» when it means «we gave up».
create or replace function public.admin_ai_latency(
  p_from date,
  p_to date,
  p_tz text default 'UTC'
)
returns table (
  feature text,
  p50     numeric,
  p95     numeric,
  calls   bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    l.feature,
    percentile_cont(0.5) within group (order by l.latency_ms)::numeric,
    percentile_cont(0.95) within group (order by l.latency_ms)::numeric,
    count(*)
  from public.ai_usage_logs l
  where (l.created_at at time zone p_tz)::date between p_from and p_to
    and l.status = 'ok'
    and l.latency_ms is not null
  group by 1
  order by 1;
end;
$$;

revoke execute on function public.admin_ai_latency(date, date, text) from public, anon;
grant execute on function public.admin_ai_latency(date, date, text) to authenticated;

-- Who is spending it, and who is hitting the ceiling.
--
-- The two columns belong side by side: a guest farm shows up as many accounts
-- with three calls and a rate_limit each, which looks like nothing in a
-- per-user list sorted by cost and like something obvious here.
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
    count(*) filter (where l.status in ('timeout', 'rate_limit', 'provider', 'malformed'))
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

-- ---------------------------------------------------------------- imports --

-- The failed, and the ones that stopped without failing.
--
-- «stuck» is its own filter because it is the state nothing else reports: an
-- import that dies mid-parse stays in `parsing` forever, the user sees a
-- spinner that never resolves, and the row looks healthy in every count of
-- failures. An hour is well past the 300-second ceiling on that route.
--
-- No closing_balance. It is the one figure on this table that is the user's
-- money.
create or replace function public.admin_imports(
  p_status text default 'all',
  p_user_id uuid default null,
  p_page int default 1,
  p_page_size int default 25
)
returns table (
  id              uuid,
  user_id         uuid,
  email           text,
  is_anonymous    boolean,
  status          text,
  source_currency text,
  target_currency text,
  period_from     date,
  period_to       date,
  file_count      int,
  line_count      int,
  matched_count   int,
  new_count       int,
  imported_count  int,
  error_message   text,
  is_stuck        boolean,
  created_at      timestamptz,
  updated_at      timestamptz,
  applied_at      timestamptz,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_size int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin();

  return query
  select
    s.id,
    s.user_id,
    nullif(u.email, ''),
    u.is_anonymous,
    s.status,
    s.source_currency,
    s.target_currency,
    s.period_from,
    s.period_to,
    s.file_count,
    s.line_count,
    s.matched_count,
    s.new_count,
    s.imported_count,
    s.error_message,
    s.status in ('uploading', 'parsing')
      and s.updated_at < now() - interval '1 hour' as is_stuck,
    s.created_at,
    s.updated_at,
    s.applied_at,
    count(*) over () as total_count
  from public.statement_imports s
  join auth.users u on u.id = s.user_id
  where (p_user_id is null or s.user_id = p_user_id)
    and case coalesce(p_status, 'all')
      when 'open'      then s.status in ('uploading', 'parsing', 'review')
      when 'stuck'     then s.status in ('uploading', 'parsing')
                            and s.updated_at < now() - interval '1 hour'
      when 'failed'    then s.status = 'failed'
      when 'applied'   then s.status = 'applied'
      when 'discarded' then s.status = 'discarded'
      else true
    end
  order by s.created_at desc
  limit v_size offset (v_page - 1) * v_size;
end;
$$;

revoke execute on function public.admin_imports(text, uuid, int, int) from public, anon;
grant execute on function public.admin_imports(text, uuid, int, int) to authenticated;

-- ----------------------------------------------------------------- guests --

-- The guests, oldest first, with whether the sweep is about to take them.
--
-- The counts are there so an operator can see what is about to be deleted
-- before pressing the button. `stale_guest_ids()` answers «who», this answers
-- «who, and what goes with them» — and it does not replace that function,
-- which is what the deletion path actually reads.
create or replace function public.admin_guests(
  p_retention_days int default 7,
  p_limit int default 100
)
returns table (
  id                 uuid,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  idle_days          int,
  is_stale           boolean,
  transactions_count bigint,
  media_count        bigint,
  total_count        bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_days  int := greatest(coalesce(p_retention_days, 7), 0);
begin
  perform public.assert_admin();

  return query
  select
    u.id,
    u.created_at,
    u.last_sign_in_at,
    -- Idle, not age: a guest who comes back every day for a fortnight is
    -- still using the app. Same measure the sweep uses.
    extract(day from now() - coalesce(u.last_sign_in_at, u.created_at))::int,
    coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => v_days),
    (select count(*) from public.transactions t
      where t.user_id = u.id and t.deleted_at is null),
    (select count(*) from public.media_assets m where m.user_id = u.id),
    count(*) over ()
  from auth.users u
  where u.is_anonymous
  order by coalesce(u.last_sign_in_at, u.created_at) asc
  limit v_limit;
end;
$$;

revoke execute on function public.admin_guests(int, int) from public, anon;
grant execute on function public.admin_guests(int, int) to authenticated;

-- ------------------------------------------------------- category usage --

-- Whether a system category is safe to delete.
--
-- Five tables reference a category, and «unused» has to mean all five: a
-- category with no transactions can still be the one somebody's rent is filed
-- under. Counts across every user, which is exactly why it needs definer
-- rights — the question is about the category, not about the caller.
create or replace function public.admin_category_usage()
returns table (
  category_id     uuid,
  transactions    bigint,
  statement_lines bigint,
  recurring       bigint,
  budgets         bigint,
  baselines       bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    c.id,
    (select count(*) from public.transactions t where t.category_id = c.id),
    (select count(*) from public.statement_lines l where l.category_id = c.id),
    (select count(*) from public.recurring_expenses r where r.category_id = c.id),
    (select count(*) from public.category_budgets b where b.category_id = c.id),
    (select count(*) from public.variable_expense_baselines v where v.category_id = c.id)
  from public.categories c
  where c.user_id is null
  order by c.sort_order;
end;
$$;

revoke execute on function public.admin_category_usage() from public, anon;
grant execute on function public.admin_category_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Not here, deliberately: deleting a user, and purging stale guests.
--
-- Both have to remove uploaded files, and Supabase blocks a delete against
-- storage.objects with a trigger — correctly, because deleting the row does
-- not delete the bytes behind it. Migration 0018 is the record of trying it
-- in SQL anyway. So the split the platform draws stays drawn: Postgres says
-- who (stale_guest_ids), and the app deletes them through the Storage and
-- admin APIs (lib/guests.ts), which is the same path a guest's own sign-out
-- already takes.
-- ---------------------------------------------------------------------------
