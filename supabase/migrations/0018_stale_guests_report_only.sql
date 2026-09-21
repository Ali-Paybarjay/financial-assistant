-- purge_stale_guests() could never have worked, and would have failed silently
-- every night at 03:17 without anyone noticing.
--
-- It deleted from storage.objects, which Supabase blocks with a trigger:
--   "Direct deletion from storage tables is not allowed. Use the Storage API"
-- The guard is right. Deleting the row does not delete the file behind it, so
-- SQL cannot clean up an upload at all — the bytes would outlive the account
-- whether the statement is blocked or not.
--
-- 0016 only ever returned 0 in testing because it short-circuits when there is
-- nothing stale, so it never reached the statement that throws. The first real
-- guest would have been the first failure.
--
-- So the work splits along the line the platform draws: Postgres says WHO is
-- stale, and the app deletes them through the Storage API and the admin API,
-- which is the same path a guest's own sign-out already takes. The schedule
-- moves with it, to a Vercel cron hitting /api/cron/purge-guests.

select cron.unschedule('purge-stale-guests')
where exists (select 1 from cron.job where jobname = 'purge-stale-guests');

drop function if exists public.purge_stale_guests(interval);

/**
 * Guests whose last sign-in is older than max_age.
 *
 * last_sign_in_at rather than created_at: a guest who keeps coming back over a
 * week is still using the app, and deleting their month of entries under them
 * would be the single worst thing this feature could do.
 */
create or replace function public.stale_guest_ids(max_age interval default interval '7 days')
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id
  from auth.users
  where is_anonymous
    and coalesce(last_sign_in_at, created_at) < now() - max_age;
$$;

-- Reachable only by the service role, which is the cron route. Same rule as
-- every other privileged function here: nothing a browser holds can call it.
revoke execute on function public.stale_guest_ids(interval) from public, anon, authenticated;
grant execute on function public.stale_guest_ids(interval) to service_role;

-- pg_cron stays installed. Nothing here uses it now, but dropping an extension
-- another migration may be about to schedule against is not worth the tidiness.
