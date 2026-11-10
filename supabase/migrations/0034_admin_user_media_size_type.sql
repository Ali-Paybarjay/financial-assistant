-- ------------------------------------------ the column was never a bigint --
--
-- 0031 declared `admin_user_media()` as returning `size_bytes bigint`, but
-- `media_assets.size_bytes` is an `integer`. A plpgsql `return query` does not
-- widen types: the mismatch passes `create function` and fails on the first
-- call with «structure of query does not match function result type». So every
-- user's detail page in the admin panel threw the moment 0031 shipped. The
-- smoke test caught it on the pull request; nothing earlier could, because the
-- unit tests stub the RPC.
--
-- The signature stays `bigint` (the TypeScript row type already says number,
-- and a byte count has no business being capped at 2 GB), so the fix is the
-- cast in the select, not a change to what the function promises.

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
  select m.id, m.kind, m.mime_type, m.size_bytes::bigint, m.status,
         m.error_message, m.created_at
  from public.media_assets m
  where m.user_id = p_user_id
  order by m.created_at desc
  limit v_limit;
end;
$$;

revoke execute on function public.admin_user_media(uuid, int) from public, anon;
grant execute on function public.admin_user_media(uuid, int) to authenticated;

comment on function public.admin_user_media(uuid, int) is
  'One user''s uploads as metadata. Deliberately excludes storage_path and extracted; see migrations 0031 and 0034, and F06.';
