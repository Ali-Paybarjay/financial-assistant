-- ------------------------------------------------------- category budgets --

-- A ceiling per category, and the month it starts applying from.
--
-- Not a row per category per month: that is twelve rows a year per category,
-- and every month the user does not touch would have to be filled in by
-- something — a nightly job, or a backfill on first read. With «from this
-- month onwards», the ceiling for any month is simply the newest row whose
-- effective_from is not after it, and a month nobody edited needs no row at
-- all. It also makes history free: raising a ceiling in October cannot
-- silently redraw September, which is the whole reason the user trusts the
-- number.
create table public.category_budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  -- Cents, never float. Rule 1.
  amount_minor   bigint not null check (amount_minor > 0),
  currency       text not null check (char_length(currency) = 3),
  -- Always a month start, so «the newest row at or before this month» has one
  -- unambiguous answer and the unique index below means «one ceiling per
  -- category per month». Same shape as transactions.posted_month.
  effective_from date not null check (date_trunc('month', effective_from) = effective_from),
  created_at     timestamptz not null default now(),
  unique (user_id, category_id, effective_from)
);

alter table public.category_budgets enable row level security;

create policy category_budgets_all on public.category_budgets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Serves the distinct-on lookup in envelope_status(): seek to the category,
-- read the first row at or before the month.
create index category_budgets_lookup_idx on public.category_budgets
  (user_id, category_id, effective_from desc);

-- ------------------------------------------------------- envelope status --

-- What each envelope is worth this month. In SQL beside the ledger it derives
-- from, like account_balances() and goal_progress(), because rule 6 says no
-- total is ever stored in a column: two places computing one sum eventually
-- disagree, and the one the user happens to be looking at is the wrong one.
--
-- security invoker, so the reader's own RLS applies. That matters most on
-- categories, whose select policy is the one policy in the schema that is not
-- «own rows» — system categories have a null user_id and belong to everyone.
-- Invoker rights get that for free; definer rights would have had to
-- reimplement it here and would leak every other user's custom categories the
-- first time the reimplementation drifted.
create or replace function public.envelope_status(p_month_start date, p_month_end date)
returns table (
  category_id       uuid,
  name_fa           text,
  -- null = no ceiling set. Distinct from a ceiling of zero, which is a
  -- decision the user made and cannot be expressed anyway (amount_minor > 0).
  budget_minor      bigint,
  spent_minor       bigint,
  -- Negative = over the ceiling. null when there is no ceiling to be over.
  remaining_minor   bigint,
  -- How much of spent is still a guess the user has not confirmed.
  unconfirmed_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select distinct on (cb.category_id) cb.category_id, cb.amount_minor
    from public.category_budgets cb
    where cb.user_id = (select auth.uid())
      and cb.effective_from <= p_month_start
    order by cb.category_id, cb.effective_from desc
  ),
  s as (
    select t.category_id,
           sum(t.amount) as spent,
           sum(case when t.is_confirmed then 0 else t.amount end) as unconfirmed
    from public.transactions t
    where t.user_id = (select auth.uid())
      and t.type = 'expense'
      -- Soft deletes are the rule in this schema. Without this a deleted
      -- purchase would go on counting against its envelope, and the board
      -- would keep saying so until the month turned over.
      and t.deleted_at is null
      and t.occurred_on between p_month_start and p_month_end
    group by t.category_id
  )
  select c.id,
         c.name_fa,
         b.amount_minor,
         coalesce(s.spent, 0)::bigint,
         (b.amount_minor - coalesce(s.spent, 0))::bigint,
         coalesce(s.unconfirmed, 0)::bigint
  from public.categories c
  left join b on b.category_id = c.id
  left join s on s.category_id = c.id
  -- An envelope is a category you have decided about or spent in. Everything
  -- else would be a card reading zero, and a board of those buries the four
  -- that mean something.
  where c.kind = 'expense'
    and (b.amount_minor is not null or coalesce(s.spent, 0) > 0)
  -- Ceilings first, then by spend: the cards that can be over budget lead,
  -- and the unset ones fall to the end where the board puts them full-width.
  order by (b.amount_minor is null), coalesce(s.spent, 0) desc;
$$;

revoke execute on function public.envelope_status(date, date) from public, anon;
grant execute on function public.envelope_status(date, date) to authenticated;
