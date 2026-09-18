-- Saving is not spending.
--
-- Money set aside for a goal is still the user's money. It has only moved out
-- of the account they spend from and into one they do not touch, and the whole
-- point of a goal is that this move actually happens rather than being typed
-- into a box. It becomes a spend on the day it is spent on the goal, and not
-- one day earlier.
--
-- So a goal is funded by transfers and drawn down by expenses, both of which
-- name the goal they belong to. What a goal holds is derived from the ledger
-- exactly the way an account balance is — never from a column that can drift
-- away from the rows underneath it.

-- ----------------------------------------------- which goal a row is about --

alter table public.transactions add column if not exists goal_id uuid
  references public.goals(id) on delete set null;

-- Deleting a goal must not delete the money. The transfer really happened and
-- the account balance depends on it; only the label goes, hence set null.

-- Income is never goal money: it is money arriving, not money set aside. A
-- transfer funds a goal, an expense spends it, and nothing else may claim one.
alter table public.transactions drop constraint if exists transactions_goal_type_check;
alter table public.transactions add constraint transactions_goal_type_check
  check (goal_id is null or type in ('expense', 'transfer'));

create index if not exists transactions_goal_idx on public.transactions (goal_id)
  where goal_id is not null;

-- ------------------------------------------- what was already put aside --

-- saved_amount used to be the whole truth, typed in by hand and corrected by
-- hand forever. It becomes what accounts.opening_balance is: the amount that
-- was already set aside before this app knew about it, with everything since
-- coming from the ledger.
--
-- Renamed rather than repurposed in place, so that every read of it fails to
-- compile until it has been looked at. A column that quietly changes meaning
-- is how a progress bar ends up showing a number nobody can explain.
--
-- Guarded because a rename is the one statement here with no `if not exists`
-- of its own, and a migration that cannot be run twice is a migration that
-- breaks the second time anyone replays the folder.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'goals'
      and column_name = 'saved_amount'
  ) then
    alter table public.goals rename column saved_amount to opening_saved;
  end if;
end
$$;

comment on column public.goals.opening_saved is
  'What was already set aside before the app knew. Everything after it is derived from transactions.goal_id; use goal_progress().';

-- ------------------------------------------------- what a goal holds now --

-- The mirror of account_balances(): one definition of what a goal holds, in
-- SQL, beside the ledger it comes from.
create or replace function public.goal_progress()
returns table (
  goal_id uuid,
  funded bigint,
  spent bigint,
  saved bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    coalesce(p.funded, 0)::bigint,
    coalesce(p.spent, 0)::bigint,
    -- Can go negative, and says so rather than clamping: spending more on a
    -- goal than was ever set aside for it is a real thing that happened, and
    -- hiding it here would only move the confusion somewhere with less
    -- context to explain it.
    (g.opening_saved + coalesce(p.funded, 0) - coalesce(p.spent, 0))::bigint
  from public.goals g
  left join lateral (
    select
      sum(t.amount) filter (where t.type = 'transfer') as funded,
      sum(t.amount) filter (where t.type = 'expense') as spent
    from public.transactions t
    where t.goal_id = g.id
      and t.deleted_at is null
  ) p on true
  where g.user_id = (select auth.uid());
$$;

revoke execute on function public.goal_progress() from public, anon;
grant execute on function public.goal_progress() to authenticated;
