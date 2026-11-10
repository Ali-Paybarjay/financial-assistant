-- ------------------------------- importing a statement, all of it or none --
--
-- Applying an import was four writes with no transaction around them, in this
-- order:
--
--   1. flip the chosen lines from 'new' to 'imported';
--   2. read the category list;
--   3. insert one transaction per claimed line;
--   4. mark the rest 'skipped' and the import 'applied'.
--
-- Step 1 committed before step 3 ran. So if the category read failed, or the
-- function was cut off — a timeout, a deploy, a closed laptop — the lines were
-- `imported` and no transaction existed. And because the retry only claims rows
-- still marked 'new', a second attempt found nothing to do, inserted nothing,
-- and reported the import applied with zero rows. The money was never in the
-- ledger and the report said it was. The unique index on
-- transactions.statement_line_id stops the same row being written twice; it has
-- nothing to say about a row that was written zero times. That was F05.
--
-- This does the whole of it in one function body, which is one transaction. A
-- line reaches 'imported' in the same commit as the transaction it names, so the
-- status cannot outlive the row again.
--
-- It also repairs what the old path left behind, at the top, before it claims
-- anything: any line in this import marked 'imported' with no live transaction
-- against it goes back to 'new'. That is the recovery path — the user re-opens
-- a half-finished report, presses the button again, and the rows that were lost
-- are offered back to them. Nothing else has to know the state existed.
--
-- `security invoker`, so RLS decides what the caller may write. `user_id` comes
-- from `auth.uid()` and the amount comes from the stored line, never from the
-- payload: the user may correct a category or a date in the review card and may
-- choose which rows to take, but not what a row is worth.

create or replace function public.apply_statement_lines(
  p_import_id uuid,
  p_lines jsonb
)
returns table (imported int, skipped int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_import public.statement_imports;
  v_imported int := 0;
  v_skipped int := 0;
  v_applied_at timestamptz := now();
  v_item jsonb;
  v_line public.statement_lines;
  v_needs_review text[];
  v_resolved text[];
begin
  -- `for update` so two taps on the button serialise rather than interleave.
  select * into v_import
  from public.statement_imports
  where id = p_import_id and user_id = v_user
  for update;

  if not found then
    raise exception 'import not found' using errcode = 'P0002';
  end if;
  if v_import.status <> 'review' then
    raise exception 'import is not open for review' using errcode = '22023';
  end if;

  -- Recovery, before anything is claimed. See the header.
  update public.statement_lines l
  set match_status = 'new'
  where l.import_id = v_import.id
    and l.match_status = 'imported'
    and not exists (
      select 1 from public.transactions t
      where t.statement_line_id = l.id and t.deleted_at is null
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    -- One line at a time, claimed and written in the same statement pair. The
    -- `for update` holds the row for the rest of this transaction, so a
    -- concurrent apply cannot take it in between.
    select * into v_line
    from public.statement_lines
    where import_id = v_import.id
      and row_index = (v_item ->> 'row_index')::int
      and match_status = 'new'
    for update;

    -- Already imported by an earlier attempt, matched, or skipped. Not this
    -- request's responsibility, and not an error.
    continue when not found;

    v_resolved := coalesce(
      array(select jsonb_array_elements_text(v_item -> 'resolved')),
      '{}'::text[]
    );

    -- What the user looked at and accepted stops needing review; the rest
    -- still does, and the row is written unconfirmed because of it.
    select coalesce(array_agg(field), '{}'::text[]) into v_needs_review
    from unnest(v_line.needs_review) as field
    where field <> all (v_resolved);

    insert into public.transactions (
      user_id, type, amount, currency, category_id, account_id,
      merchant, note, occurred_on, source, statement_line_id,
      ai_confidence, is_confirmed, needs_review
    )
    values (
      v_user,
      case when v_line.direction = 'in' then 'income' else 'expense' end,
      -- From the stored line. The request does not get a say in this.
      v_line.amount,
      v_import.target_currency,
      nullif(v_item ->> 'category_id', '')::uuid,
      -- From the import: the user chose the account when they said whose
      -- statement this was.
      v_import.account_id,
      coalesce(nullif(v_item ->> 'merchant', ''), v_line.merchant),
      -- The bank's own wording, so the row can always be traced back.
      v_line.description,
      (v_item ->> 'occurred_on')::date,
      'statement',
      v_line.id,
      v_line.ai_confidence,
      cardinality(v_needs_review) = 0,
      v_needs_review
    );

    update public.statement_lines
    set match_status = 'imported'
    where id = v_line.id;

    v_imported := v_imported + 1;
  end loop;

  -- Everything still unclaimed is a row the user chose to leave.
  with left_behind as (
    update public.statement_lines
    set match_status = 'skipped'
    where import_id = v_import.id and match_status = 'new'
    returning 1
  )
  select count(*)::int into v_skipped from left_behind;

  update public.statement_imports
  set status = 'applied',
      imported_count = v_imported,
      applied_at = v_applied_at
  where id = v_import.id;

  -- The account has now been checked against the bank, whether or not that
  -- added anything. An import that finds nothing missing is the best possible
  -- outcome, and it would be perverse for it to leave the account still nagging
  -- the user to do what they just did.
  if v_import.account_id is not null then
    update public.accounts
    set last_reconciled_at = v_applied_at
    where id = v_import.account_id and user_id = v_user;
  end if;

  return query select v_imported, v_skipped;
end;
$$;

revoke execute on function public.apply_statement_lines(uuid, jsonb) from public, anon;
grant execute on function public.apply_statement_lines(uuid, jsonb) to authenticated;

comment on function public.apply_statement_lines(uuid, jsonb) is
  'Applies a statement import in one transaction: repairs lines left marked imported with no transaction, writes one transaction per chosen line, skips the rest and closes the report. See migration 0030 and F05.';

-- -------------------------------------------- finding the ones that got away --

-- For the operator, and for a user who wants to know. A line marked imported
-- with nothing behind it is the state the old path could leave; this names it,
-- so «did that import actually land» stops being a question only SQL by hand
-- could answer. The apply function heals them, but an import that was never
-- retried would sit there unnoticed.
create or replace function public.orphaned_statement_lines()
returns table (import_id uuid, line_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.import_id, count(*)
  from public.statement_lines l
  where l.user_id = (select auth.uid())
    and l.match_status = 'imported'
    and not exists (
      select 1 from public.transactions t
      where t.statement_line_id = l.id and t.deleted_at is null
    )
  group by l.import_id;
$$;

revoke execute on function public.orphaned_statement_lines() from public, anon;
grant execute on function public.orphaned_statement_lines() to authenticated;
