-- A month you did not open the app in never got its fixed bills, and until
-- now the app could only tell you so.
--
-- It cannot decide for you. Whether last June's rent was actually paid is
-- something only you know, and a product that guesses either way is wrong in
-- a way that shows up in the totals: invent it and the month reads poorer
-- than it was, skip it and richer. So the app asks, and — this is the part
-- that makes it more than a questionnaire — a «no» is also information. A
-- bill you have stopped paying should stop being counted in what a month
-- costs, which changes every figure the savings plan is built on.

-- ------------------------------------------------- a month answered «no» --

-- Recording the «no» is what stops the question coming back forever. A
-- transaction records a «yes»; nothing recorded a «no».
create table if not exists public.recurring_skipped_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_expense_id uuid not null
    references public.recurring_expenses(id) on delete cascade,
  month date not null,
  created_at timestamptz not null default now(),
  -- Months are stored as their first day, the way posted_month already is.
  check (date_trunc('month', month) = month)
);

create unique index if not exists recurring_skipped_month_key
  on public.recurring_skipped_months (recurring_expense_id, month);
create index if not exists recurring_skipped_user_idx
  on public.recurring_skipped_months (user_id);

alter table public.recurring_skipped_months enable row level security;

create policy recurring_skipped_select on public.recurring_skipped_months
  for select to authenticated using (user_id = (select auth.uid()));
create policy recurring_skipped_insert on public.recurring_skipped_months
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy recurring_skipped_delete on public.recurring_skipped_months
  for delete to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------- one definition of «is it due then» --

-- Pulled out of post_recurring_for_month so the generator and the
-- missed-month finder cannot drift apart. Two copies of this rule would mean
-- the app asking about a month it would never have generated, or generating
-- one it never asked about.
create or replace function public.recurring_due_in_month(
  p_frequency text,
  p_due_month int,
  p_month date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'monthly' then true
    when 'yearly' then extract(month from p_month)::int = p_due_month
    -- Its own month, then every third: February gives February, May, August,
    -- November. The +12 keeps the modulo away from negatives.
    when 'quarterly'
      then mod(extract(month from p_month)::int - p_due_month + 12, 3) = 0
    else false
  end;
$$;

-- ------------------------------------------------ generating, as before --

-- Same function, now saying the due-date rule by name, and able to be aimed
-- at a single bill: confirming one missed month must post that bill and not
-- every other one that happened to be due in the same month.
drop function if exists public.post_recurring_for_month(date);

create or replace function public.post_recurring_for_month(
  p_month date,
  p_only uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
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
    and (p_only is null or r.id = p_only)
    and public.recurring_due_in_month(r.frequency, r.due_month, v_month)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.post_recurring_for_month(date, uuid)
  from public, anon;
grant execute on function public.post_recurring_for_month(date, uuid)
  to authenticated;

-- ------------------------------------------------- what is still unasked --

-- Every (bill, month) pair that should have been generated and was not, and
-- that the user has neither confirmed nor waved away.
--
-- Bounded deliberately. Never the current month — it is generated on sight,
-- and asking about a month still in progress is asking about a bill that has
-- not come due. Never a month before the bill existed. And never more than a
-- year back: beyond that a person is not remembering, they are guessing, and
-- a guessed «yes» writes a number into the ledger that nothing will ever
-- correct.
create or replace function public.missed_recurring_months(p_before date)
returns table (recurring_expense_id uuid, month date, amount bigint, title text)
language sql
stable
security invoker
set search_path = ''
as $$
  -- No floor on the profile's own age: a bill cannot exist before the person
  -- who created it, so «the month after the bill was created» is already at
  -- or after that date. Adding it as a second floor only ever binds on data
  -- that could not occur, and when it binds it answers «nothing to review»
  -- silently — the worst possible failure for a question the user is waiting
  -- to be asked.
  with bounds as (
    select
      date_trunc('month', p_before)::date as this_month,
      date_trunc('month', p_before - interval '12 months')::date as floor_month
  )
  select r.id, m.month::date, r.amount, r.title
  from public.recurring_expenses r
  cross join bounds b
  cross join lateral generate_series(
    greatest(
      b.floor_month,
      -- The month after it was created: a bill added halfway through a month
      -- did not cover that month.
      (date_trunc('month', r.created_at) + interval '1 month')::date
    ),
    (b.this_month - interval '1 month')::date,
    interval '1 month'
  ) as m(month)
  where r.user_id = (select auth.uid())
    and r.is_active
    and r.auto_post
    and public.recurring_due_in_month(r.frequency, r.due_month, m.month::date)
    and not exists (
      select 1 from public.transactions t
      where t.recurring_expense_id = r.id
        and t.posted_month = m.month::date
        and t.deleted_at is null
    )
    and not exists (
      select 1 from public.recurring_skipped_months s
      where s.recurring_expense_id = r.id
        and s.month = m.month::date
    )
  order by m.month, r.title;
$$;

revoke execute on function public.missed_recurring_months(date) from public, anon;
grant execute on function public.missed_recurring_months(date) to authenticated;
