-- Bank accounts, and the balance question.
--
-- The user says what an account holds and when that was true; every
-- transaction posted to the account on or after that date moves it. The
-- balance is therefore never stored — it is derived, every time it is read,
-- from the one number the user typed and the ledger that followed it.
--
-- That is the whole design decision. A stored `current_balance` column would
-- have to be nudged by a trigger on insert, on update, on soft delete, on
-- restore, on a change of amount, of type, of date, of account — eight paths
-- that must all agree forever, and one missed path is a balance that is
-- quietly wrong and cannot be reconstructed. A derived balance cannot drift,
-- because there is nothing to drift from.

-- --------------------------------------------------------------- accounts --

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('checking','savings','card','cash','other')),
  -- Denormalised from the profile at creation, the way income_sources and
  -- recurring_expenses carry theirs. An account in a currency other than the
  -- base is refused in the action: this app does no rate conversion.
  currency text not null check (char_length(currency) = 3),
  -- The balance the user states, and the date they state it for. Negative is
  -- legal and meaningful: a credit card at 1,200 owed is -1200.
  opening_balance bigint not null default 0,
  opening_balance_on date not null,
  -- Whose account it is, and which one. Both optional, both only ever shown.
  institution text,
  reference text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One default per user, enforced here rather than in application code: two
-- defaults means the entry form silently picks whichever row sorted first.
create unique index accounts_one_default_key on public.accounts (user_id)
  where is_default;

create index accounts_user_idx on public.accounts (user_id);
create index accounts_user_active_idx on public.accounts (user_id) where is_active;

create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

create policy accounts_select on public.accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy accounts_delete on public.accounts for delete to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------- transactions get an account --

-- Nullable, and staying that way: cash out of a pocket is a real expense with
-- no account behind it, and every row written before this migration has none.
-- A transaction with no account is money that moved without touching one.
alter table public.transactions add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

-- Leads with account_id so the balance function can walk one account's rows,
-- and so ON DELETE SET NULL can find them. The date is in the index because
-- the balance only counts rows at or after the account's stated date.
create index transactions_account_date_idx on public.transactions
  (account_id, occurred_on) where deleted_at is null;
create index transactions_account_idx on public.transactions (account_id);

-- ------------------------------------------ a statement is of one account --

alter table public.statement_imports add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

create index statement_imports_account_idx on public.statement_imports (account_id);

-- ------------------------------------------------------ balances, derived --

-- One round trip for every account's balance. `security invoker` keeps the
-- caller's RLS, so this can only ever see its own rows; the `user_id` filter
-- is belt to that braces, and is what lets the planner use the index.
create or replace function public.account_balances()
returns table (
  account_id uuid,
  opening_balance bigint,
  movement bigint,
  balance bigint,
  transaction_count int,
  last_activity_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.opening_balance,
    coalesce(m.movement, 0)::bigint,
    (a.opening_balance + coalesce(m.movement, 0))::bigint,
    coalesce(m.row_count, 0)::int,
    m.last_on
  from public.accounts a
  left join lateral (
    select
      sum(case when t.type = 'income' then t.amount else -t.amount end) as movement,
      count(*) as row_count,
      max(t.occurred_on) as last_on
    from public.transactions t
    where t.account_id = a.id
      and t.deleted_at is null
      -- Rows dated before the stated balance are already inside it. A
      -- statement of the last three months, imported the day an account is
      -- created, must not move a balance the user just read off their phone.
      and t.occurred_on >= a.opening_balance_on
  ) m on true
  where a.user_id = (select auth.uid());
$$;

revoke execute on function public.account_balances() from public, anon;
grant execute on function public.account_balances() to authenticated;

-- ------------------------------------ fixed expenses come out of somewhere --

-- Rent leaves an account every month whether or not anyone tells the app so.
-- Without this, the one kind of expense the app posts by itself would be the
-- one kind that never moved a balance.
alter table public.recurring_expenses add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

create index recurring_expenses_account_idx on public.recurring_expenses (account_id);

-- Restated only to carry account_id onto the rows it writes. Everything else,
-- including the idempotency the unique index gives it, is as 0001 left it.
create or replace function public.post_recurring_for_month(p_month date)
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
    and r.frequency = 'monthly'
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.post_recurring_for_month(date) from public, anon;
grant execute on function public.post_recurring_for_month(date) to authenticated;
