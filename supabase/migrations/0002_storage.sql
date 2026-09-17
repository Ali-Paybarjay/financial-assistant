-- Private buckets for the two AI entry methods.
-- Path contract: {user_id}/{uuid}.{ext} — the first folder segment is the
-- owner, which is what every policy below checks.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 5242880,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('voice-notes', 'voice-notes', false, 10485760,
   array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy receipts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy voice_notes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy voice_notes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy voice_notes_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
