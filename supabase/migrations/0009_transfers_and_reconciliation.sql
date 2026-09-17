-- Two things that turn accounts into a ledger you can actually trust:
-- moving money between your own accounts, and checking the app against the
-- bank on a schedule.

-- ------------------------------------------------------------- transfers --

-- A transfer is one row, not two.
--
-- Double entry would say two rows — one leaving, one arriving — and for a
-- general ledger it would be right. Here it would mean two rows that must
-- agree about amount, date and existence forever: edit one, edit the other;
-- soft-delete one, soft-delete the other; and every list in the app has to
-- learn to show them as one thing anyway. One row naming both accounts cannot
-- disagree with itself.
--
-- The cost is paid in two known places, both of which are single functions
-- with tests around them: the balance function below, which has to look at
-- both columns, and lib/import/reconcile.ts, which turns one transfer into
-- the one leg a given account's statement would show.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('expense', 'income', 'transfer'));

alter table public.transactions add column if not exists to_account_id uuid
  references public.accounts(id) on delete set null;

-- A second account only means anything on a transfer. The reverse is not
-- asserted — an account hard-deleted out from under a transfer would set this
-- null, and a constraint that turns that into an error would make the delete
-- fail rather than degrade. The delete guard in the action is what actually
-- prevents it; this is only about keeping other rows honest.
alter table public.transactions add constraint transactions_to_account_shape
  check (to_account_id is null or type = 'transfer');

-- Money cannot move from an account to itself.
alter table public.transactions add constraint transactions_transfer_distinct
  check (to_account_id is null or account_id is null or to_account_id <> account_id);

create index transactions_to_account_date_idx on public.transactions
  (to_account_id, occurred_on) where deleted_at is null;
create index transactions_to_account_idx on public.transactions (to_account_id);

-- ------------------------------------------------ balances, both legs now --

-- The one place that has to know a transfer touches two accounts. It adds to
-- the account it arrived in and subtracts from the one it left, and each side
-- is measured against that account's own stated date — money that arrived
-- before the destination's balance was stated is already inside it.
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
      sum(
        case
          when t.type = 'income' then t.amount
          -- The arriving leg. The leaving leg falls through to the else.
          when t.type = 'transfer' and t.to_account_id = a.id then t.amount
          else -t.amount
        end
      ) as movement,
      count(*) as row_count,
      max(t.occurred_on) as last_on
    from public.transactions t
    where (t.account_id = a.id or t.to_account_id = a.id)
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

-- ------------------------------------------------ when the bank last spoke --

-- Drives the monthly reminder. Deliberately not derived from the newest
-- applied import: an import can be applied and import nothing, and that is
-- still the user having checked this account against the bank.
alter table public.accounts add column if not exists last_reconciled_at timestamptz;

-- ---------------------------------------- what the statement said it held --

-- The closing balance the statement prints, and whether the user accepted it.
-- Kept on the import rather than written straight to the account: it is a
-- claim the report shows and the user confirms, like every other thing a model
-- read off a page.
alter table public.statement_imports
  add column if not exists closing_balance bigint,
  add column if not exists closing_balance_on date,
  add column if not exists balance_applied boolean not null default false;

-- ------------------------------------- one open import per account, not one --

-- The original rule was one open import, full stop, because two half-finished
-- reports over the same period is a way to import the same money twice. Now
-- that a statement belongs to an account and reconciliation only looks at that
-- account's rows, two reports over two accounts cannot collide — and the user
-- is being asked to update every account at the start of the month, which
-- under the old rule meant doing them strictly one at a time.
--
-- The coalesce gives account-less imports (everything from before this
-- feature) a single shared slot, which is exactly the old rule for them.
create unique index statement_imports_one_open_key on public.statement_imports
  (user_id, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('uploading', 'parsing', 'review');
