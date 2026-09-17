-- Sign-in providers disagree on where the person's name lives. Google sends
-- both `full_name` and `name`; some OIDC servers send only the two halves; an
-- email/password signup lands in `full_name` because this app puts it there.
-- Reading only `full_name` meant a user could sign in with an account that had
-- just told us their name and still land on onboarding with an empty field.
--
-- The email is deliberately not used as a fallback: a local part like
-- "[REDACTED]" is not what anyone is called, and a wrong prefill is worse than
-- an empty one on the very first question the app asks.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(
      btrim(concat_ws(
        ' ',
        nullif(btrim(meta ->> 'given_name'), ''),
        nullif(btrim(meta ->> 'family_name'), '')
      )),
      ''
    )
  );

  insert into public.profiles (id, full_name)
  values (new.id, resolved_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- CREATE OR REPLACE keeps the old ACL, but state it again so the grant cannot
-- drift if this file is ever replayed against a fresh database.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
