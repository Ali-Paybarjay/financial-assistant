-- ------------------------------------- the privacy line, actually enforced --
--
-- Migration 0027 drew a line: «the panel never reads anybody's ledger». It then
-- granted an admin `select` on the whole of `profiles`, `statement_imports` and
-- `media_assets`, and wrote down which columns the app promises not to select:
--
--   profiles.monthly_income_estimate, .debt_amount,
--           .emergency_fund_months, .savings_rate_estimate
--   statement_imports.closing_balance
--   media_assets.extracted, .storage_path
--
-- A promise in lib/admin/queries.ts binds lib/admin/queries.ts. It does not bind
-- a request, and PostgREST is a public HTTP API: an admin holding their own
-- access token could ask for `/rest/v1/profiles?select=monthly_income_estimate`
-- and be answered for every user in the system. The four columns the header
-- calls «somebody's salary» were one query away, and so were the closing
-- balance of every bank statement and the storage key of every uploaded
-- receipt. The audit confirmed it against two test accounts. That was F06.
--
-- A row-level policy cannot hide a column, so the answer is not a better policy
-- — it is not having one. All three go. Every report in 0027 is `security
-- definer` and reads these tables from inside the function, where it names its
-- own columns and RLS is not consulted at all, so nothing in the panel loses
-- anything. The one direct read that was relying on the policy — one user's
-- uploads, on their detail page — becomes a function with its column list in the
-- signature, which is a place a promise can actually be kept.
--
-- `ai_usage_logs_admin_select` stays. Every column on that table is about the
-- model call and none of it is about the purchase, which is the distinction the
-- whole panel is shaped by. What it did cost is separate and smaller: the quota
-- count in lib/ai/usage.ts filtered by date and not by user, so an admin's own
-- allowance was measured against everybody's calls. That is fixed in the query,
-- not here — see F12.
--
-- The owner policies on all four tables are untouched. Nothing a user could see
-- about themselves changes.

drop policy if exists profiles_admin_select on public.profiles;
drop policy if exists statement_imports_admin_select on public.statement_imports;
drop policy if exists media_assets_admin_select on public.media_assets;

-- ------------------------------------------------------ one user's uploads --

-- What `adminUserMedia` used to read through the policy, with the column list
-- in the signature instead of in a comment.
--
-- Never `storage_path`, which is the key to the file itself, and never
-- `extracted`, which is what the model read off the receipt — that is the
-- purchase, written out in fields. Size, type, and whether it parsed is the
-- whole of what an operator needs to answer «why did this person's upload
-- fail».
create or replace function public.admin_user_media(
  p_user_id uuid,
  p_limit int default 20
)
returns table (
  id            uuid,
  kind          text,
  mime_type     text,
  size_bytes    bigint,
  status        text,
  error_message text,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 200);
begin
  perform public.assert_admin();

  return query
  select m.id, m.kind, m.mime_type, m.size_bytes, m.status, m.error_message,
         m.created_at
  from public.media_assets m
  where m.user_id = p_user_id
  order by m.created_at desc
  limit v_limit;
end;
$$;

revoke execute on function public.admin_user_media(uuid, int) from public, anon;
grant execute on function public.admin_user_media(uuid, int) to authenticated;

comment on function public.admin_user_media(uuid, int) is
  'One user''s uploads as metadata. Deliberately excludes storage_path and extracted; see migration 0031 and F06.';
