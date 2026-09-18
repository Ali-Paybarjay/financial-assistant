-- Deleting a fixed bill that had ever been generated failed, silently.
--
-- transactions.recurring_expense_id is `on delete set null`, and the table
-- also required that the id and posted_month were null together. So deleting
-- the bill nulled one of the pair and tripped the check, Postgres refused the
-- delete, and the sheet closed as though it had worked — the row was still
-- there when the page reloaded.
--
-- The biconditional was stronger than the invariant it was protecting. What
-- has to hold is that a generated row always says which month it was
-- generated for, because the unique index behind the idempotency guarantee is
-- on (recurring_expense_id, posted_month). The other direction — a month
-- without a bill — is exactly the state a deleted bill leaves behind, and it
-- is a truthful one: the expense really was generated for that month, and the
-- bill really is gone.

alter table public.transactions drop constraint if exists transactions_check;

alter table public.transactions
  add constraint transactions_recurring_month_pairing
  check (recurring_expense_id is null or posted_month is not null);
