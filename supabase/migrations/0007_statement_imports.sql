-- Bank statement import.
--
-- The user uploads one to three months of statement; the app reads the rows,
-- works out which are already in the ledger, and offers the rest. Two tables
-- carry it: the import (one upload session) and its lines (one row of the
-- statement each).
--
-- Lines are kept after the import is applied, not discarded. They are what the
-- report is rendered from, they are the evidence behind every row that was
-- written, and they are how a second upload of the same file can be explained
-- to the user rather than merely absorbed.

-- ------------------------------------------------------ statement_imports --

create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'uploading' check (status in
    ('uploading','parsing','review','applied','failed','discarded')),
  -- The unit the statement is written in. An Iranian bank prints rial while
  -- the account holder keeps this app in toman, so the two differ routinely.
  source_currency text not null check (char_length(source_currency) = 3),
  -- The base currency at the time of import. Every amount stored on a line
  -- below has already been converted into it.
  target_currency text not null check (char_length(target_currency) = 3),
  period_from date,
  period_to date,
  file_count int not null default 0 check (file_count >= 0),
  line_count int not null default 0 check (line_count >= 0),
  matched_count int not null default 0 check (matched_count >= 0),
  new_count int not null default 0 check (new_count >= 0),
  imported_count int not null default 0 check (imported_count >= 0),
  error_message text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_to is null or period_from is null or period_to >= period_from)
);

create index statement_imports_user_created_idx
  on public.statement_imports (user_id, created_at desc);

create trigger statement_imports_set_updated_at before update
  on public.statement_imports
  for each row execute function public.set_updated_at();

alter table public.statement_imports enable row level security;

create policy statement_imports_select on public.statement_imports
  for select to authenticated using (user_id = (select auth.uid()));
create policy statement_imports_insert on public.statement_imports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy statement_imports_update on public.statement_imports
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy statement_imports_delete on public.statement_imports
  for delete to authenticated using (user_id = (select auth.uid()));

-- -------------------------------------------------------- statement_lines --

create table public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.statement_imports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Position in the statement, and the stable identity of the row within an
  -- import. Reconciliation is deterministic, so this ordering is reproducible.
  row_index int not null check (row_index >= 0),
  occurred_on date not null,
  direction text not null check (direction in ('in','out')),
  -- Already in target_currency. Always positive: the sign lives in direction,
  -- the same way it lives in transactions.type.
  amount bigint not null check (amount > 0),
  -- Verbatim, as the bank printed it. The user must always be able to see what
  -- the row actually said, whatever the model made of it.
  description text,
  merchant text,
  category_id uuid references public.categories(id) on delete set null,
  ai_confidence numeric(3,2) check (ai_confidence between 0 and 1),
  needs_review text[] not null default '{}',
  match_status text not null default 'new' check (match_status in
    ('new','matched','imported','skipped')),
  -- Set when the row was found to be in the ledger already.
  matched_transaction_id uuid references public.transactions(id) on delete set null,
  match_day_gap int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, row_index),
  check (matched_transaction_id is null or match_status = 'matched')
);

create index statement_lines_import_idx on public.statement_lines (import_id, row_index);
create index statement_lines_user_idx on public.statement_lines (user_id);
create index statement_lines_category_idx on public.statement_lines (category_id);
create index statement_lines_matched_idx on public.statement_lines (matched_transaction_id);

create trigger statement_lines_set_updated_at before update on public.statement_lines
  for each row execute function public.set_updated_at();

alter table public.statement_lines enable row level security;

create policy statement_lines_select on public.statement_lines
  for select to authenticated using (user_id = (select auth.uid()));
create policy statement_lines_insert on public.statement_lines
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy statement_lines_update on public.statement_lines
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy statement_lines_delete on public.statement_lines
  for delete to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------- transactions from a statement --

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('form','text','voice','receipt','recurring','statement'));

alter table public.transactions add column if not exists statement_line_id uuid
  references public.statement_lines(id) on delete set null;

-- Applying an import twice (a double tap, a retried request) must not write
-- the row twice. The same guarantee the recurring job gets, by the same means.
create unique index transactions_statement_line_key on public.transactions
  (statement_line_id)
  where statement_line_id is not null and deleted_at is null;

-- Leads with statement_line_id so ON DELETE SET NULL can find its rows.
create index transactions_statement_line_idx on public.transactions (statement_line_id);

-- ---------------------------------------------------- media_assets widened --

-- A statement arrives as a PDF or a spreadsheet export as often as a photo, so
-- media_assets stops being images-only. 0003 narrowed it to a single value when
-- voice was dropped; this widens it by exactly one rather than reopening it.
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check
  check (kind in ('image','document'));

alter table public.media_assets add column if not exists statement_import_id uuid
  references public.statement_imports(id) on delete cascade;

create index media_assets_statement_import_idx
  on public.media_assets (statement_import_id);

-- ---------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('statements', 'statements', false, 15728640,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf',
         'text/csv','text/plain'])
on conflict (id) do nothing;

create policy statements_select on storage.objects for select to authenticated
  using (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy statements_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy statements_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
