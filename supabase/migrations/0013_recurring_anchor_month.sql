-- A quarterly or yearly bill needs to say *which* month it falls in.
--
-- `frequency` has allowed 'quarterly' and 'yearly' since the first migration,
-- but post_recurring_for_month posts the month it is handed and the table said
-- nothing about which months a non-monthly bill is due in — so the function
-- could only ever generate monthly rows, and the form only ever wrote
-- 'monthly'. Giving the form the field without this column would have been a
-- promise of a transaction that never appeared.
--
-- due_day already says which day. This says which month, and the pair is read
-- the same way for every frequency: yearly means that month, quarterly means
-- that month and every third one after it.

alter table public.recurring_expenses add column if not exists due_month int;

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_due_month_range;
alter table public.recurring_expenses
  add constraint recurring_expenses_due_month_range
  check (due_month is null or due_month between 1 and 12);

-- A monthly bill is due every month, so naming one would be meaningless; a
-- non-monthly one is unpostable without it. Making the column's presence
-- exactly track the frequency is what stops a row existing that the generator
-- would silently skip.
alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_due_month_required;
alter table public.recurring_expenses
  add constraint recurring_expenses_due_month_required
  check ((frequency = 'monthly') = (due_month is null));

-- ------------------------------------------------- generating the month --

-- Unchanged except for the frequency test at the bottom: monthly always,
-- yearly in its own month, quarterly in its month and every third after it.
-- Idempotency still comes from the unique index on
-- (recurring_expense_id, posted_month), so this stays safe to call on
-- every dashboard load.
create or replace function public.post_recurring_for_month(p_month date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_month_number int := extract(month from v_month)::int;
  v_inserted integer;
begin
  insert into public.transactions (
    user_id, type, amount, currency, category_id, account_id, merchant, note,
    occurred_on, source, recurring_expense_id, posted_month, is_confirmed
  )
  select
    r.user_id,
    'expense',
    r.amount,
    r.currency,
    r.category_id,
    r.account_id,
    null,
    r.title,
    -- A due_day of 31 in a 30-day month lands on the last day, not next month.
    least(
      v_month + (r.due_day - 1),
      (v_month + interval '1 month - 1 day')::date
    ),
    'recurring',
    r.id,
    v_month,
    true
  from public.recurring_expenses r
  where r.user_id = (select auth.uid())
    and r.is_active
    and r.auto_post
    and (
      r.frequency = 'monthly'
      or (r.frequency = 'yearly' and v_month_number = r.due_month)
      -- Its own month, then every third one: February gives February, May,
      -- August, November. The +12 keeps the modulo away from negatives.
      or (
        r.frequency = 'quarterly'
        and mod(v_month_number - r.due_month + 12, 3) = 0
      )
    )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.post_recurring_for_month(date) from public, anon;
grant execute on function public.post_recurring_for_month(date) to authenticated;
