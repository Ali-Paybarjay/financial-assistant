-- Guest (anonymous) sessions.
--
-- A guest is a real auth.users row with is_anonymous = true, so every existing
-- policy — all of which are scoped `to authenticated` — already covers them and
-- none of them needed changing. Two consequences follow, and this migration
-- handles both:
--
--   1. The guest's rows are real rows. When they later add an email and a
--      password the user id does not change, so everything they entered while
--      trying the app survives the upgrade. That is the whole point.
--   2. A guest who closes the tab and never comes back leaves that row behind.
--      The app promises their data is temporary, so something has to make that
--      true even when they never press «خروج».

create extension if not exists pg_cron;

/**
 * Deletes guests who have been idle longer than max_age, and everything that
 * hangs off them. Every table's user_id is ON DELETE CASCADE, so one delete
 * from auth.users clears the lot — except Storage, which has no foreign key
 * back to auth.users and so has to be cleared by hand first.
 *
 * last_sign_in_at rather than created_at: a guest who keeps coming back over a
 * week is still using the app, and deleting their month of entries under them
 * would be the single worst thing this feature could do.
 */
create or replace function public.purge_stale_guests(max_age interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale_ids uuid[];
  stale_keys text[];
  purged integer;
begin
  select array_agg(id), array_agg(id::text)
    into stale_ids, stale_keys
  from auth.users
  where is_anonymous
    and coalesce(last_sign_in_at, created_at) < now() - max_age;

  if stale_ids is null then
    return 0;
  end if;

  -- Path contract from 0002_storage.sql: {user_id}/{uuid}.{ext}.
  delete from storage.objects
  where bucket_id in ('receipts', 'voice-notes')
    and (storage.foldername(name))[1] = any (stale_keys);

  delete from auth.users where id = any (stale_ids);
  get diagnostics purged = row_count;

  return purged;
end;
$$;

-- Same rule as the other privileged functions in 0001: nothing reachable
-- through PostgREST. Only the cron job, running as postgres, calls this.
revoke execute on function public.purge_stale_guests(interval) from public, anon, authenticated;

-- 03:17 rather than 03:00: nothing else in this schedule should line up with
-- the top of an hour that every other Postgres on the planet is also using.
select cron.unschedule('purge-stale-guests')
where exists (select 1 from cron.job where jobname = 'purge-stale-guests');

select cron.schedule(
  'purge-stale-guests',
  '17 3 * * *',
  $cron$select public.purge_stale_guests()$cron$
);
