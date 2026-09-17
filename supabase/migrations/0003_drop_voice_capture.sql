-- In-app voice recording is out of scope. Users dictate with the keyboard mic
-- they already have, straight into the free-text field, which removes the
-- MediaRecorder format fragmentation (webm on Chrome, mp4 on iOS Safari)
-- entirely. Everything that existed only to serve recorded audio goes.
--
-- The voice-notes bucket itself is removed through the Storage API, not here:
-- Postgres refuses direct deletes from storage.buckets.

drop policy if exists voice_notes_select on storage.objects;
drop policy if exists voice_notes_insert on storage.objects;
drop policy if exists voice_notes_delete on storage.objects;

alter table public.media_assets drop column if exists transcript;

-- media_assets now only ever holds receipt images.
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check check (kind = 'image');
