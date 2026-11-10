-- ------------------------------------------- what a stated balance means --
--
-- An account carries one number the user typed and the date it was true for,
-- and every balance in the product is that number plus the ledger that
-- followed it. What was never written down is *when on that date* it was true,
-- and the two readings differ by a whole day of spending.
--
-- `account_balances()` has always added rows with `occurred_on >=
-- opening_balance_on`, which is the start-of-day reading: the stated figure is
-- what the account held before that day's transactions, so they all still move
-- it. That is the right reading for the question the account form asks — «این
-- موجودی مالِ چه تاریخی است», answered by someone reading their banking app
-- and then carrying on with their day.
--
-- It is the wrong reading for a bank statement's closing balance, and the
-- balance step of statement import wrote one straight into these two columns.
-- A statement's closing figure is the *end* of its last day: the day's
-- transactions are already inside it. So an account holding 100, with a 20
-- expense on 30 September and a printed closing balance of 80, was reconciled
-- to 80 as of 30 September — and then the 20 was subtracted again, leaving 60.
-- Confirming a figure that agreed with the app made the app disagree with the
-- bank by exactly one day of movement. That was F02.
--
-- Two ways to fix it were available and one of them is wrong. Flipping the
-- comparison to `>` everywhere would move the statement boundary into the
-- right place and move every manually stated balance out of it, silently
-- changing the number on every account whose anchor day has a transaction on
-- it. So the convention becomes explicit instead: each account records which
-- of the two its anchor is, existing rows keep the one they were entered under,
-- and the statement path writes the other.
--
-- The third reading — «موجودی همین لحظه» — is not a stored thing at all. It is
-- what `account_balances()` returns, and it has no column because it has no
-- anchor: it is derived from one, every time it is read.

alter table public.accounts
  add column if not exists opening_balance_basis text not null
    default 'start_of_day';

-- Added after the default so the backfill is the default: every row that
-- exists was entered through the account form, which asks the start-of-day
-- question, and every balance those rows produce stays the number it was.
alter table public.accounts
  drop constraint if exists accounts_opening_balance_basis_check;

alter table public.accounts
  add constraint accounts_opening_balance_basis_check
  check (opening_balance_basis in ('start_of_day', 'end_of_day'));

comment on column public.accounts.opening_balance_basis is
  'Whether opening_balance is the balance BEFORE opening_balance_on''s transactions (start_of_day, what the account form asks) or AFTER them (end_of_day, what a bank statement''s closing balance is). Read by account_balances() to decide whether the anchor day''s rows still move the balance.';

-- ---------------------------------------- balances, with the basis in them --

-- Otherwise identical to 0009's version. The single change is the date bound,
-- which now asks the account which side of its anchor day it meant.
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
      -- Rows dated before the stated balance are already inside it. Whether
      -- the anchor day itself is inside it is the question this column answers:
      -- a figure read off a banking app in the morning has the day still to
      -- come, a statement's closing figure has it already spent.
      and case a.opening_balance_basis
        when 'end_of_day' then t.occurred_on > a.opening_balance_on
        else t.occurred_on >= a.opening_balance_on
      end
  ) m on true
  where a.user_id = (select auth.uid());
$$;

revoke execute on function public.account_balances() from public, anon;
grant execute on function public.account_balances() to authenticated;
