-- 00xx_envelopes_and_theme.sql
-- Renumber to follow the last migration in supabase/migrations/.

-- ---------------------------------------------------------------- budgets --
-- A budget is "from this month on", not one row per month: a row per month
-- would need a nightly job to carry unchanged budgets forward, and would let
-- last month's figures change when the user edits today's ceiling.

create table public.category_budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  amount_minor   bigint not null check (amount_minor > 0),
  currency       text   not null,
  effective_from date   not null,
  created_at     timestamptz not null default now(),
  unique (user_id, category_id, effective_from)
);

alter table public.category_budgets enable row level security;

create policy "own budgets" on public.category_budgets
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index category_budgets_lookup
  on public.category_budgets (user_id, category_id, effective_from desc);

-- ------------------------------------------------------- envelope status --
-- No sum is ever stored: the board is derived here, beside the ledger it
-- comes from — the same rule account_balances() follows.

create or replace function public.envelope_status(p_month_start date, p_month_end date)
returns table (
  category_id       uuid,
  name_fa           text,
  budget_minor      bigint,
  spent_minor       bigint,
  remaining_minor   bigint,
  unconfirmed_minor bigint
)
language sql
security invoker
stable
as $$
  with budget as (
    select distinct on (category_id) category_id, amount_minor
    from public.category_budgets
    where user_id = (select auth.uid())
      and effective_from <= p_month_start
    order by category_id, effective_from desc
  ),
  spend as (
    select category_id,
           sum(amount) as spent,
           sum(case when is_confirmed then 0 else amount end) as unconfirmed
    from public.transactions
    where user_id = (select auth.uid())
      and type = 'expense'
      and occurred_on between p_month_start and p_month_end
    group by category_id
  )
  select c.id,
         c.name_fa,
         b.amount_minor,
         coalesce(s.spent, 0),
         b.amount_minor - coalesce(s.spent, 0),
         coalesce(s.unconfirmed, 0)
  from public.categories c
  left join budget b on b.category_id = c.id
  left join spend  s on s.category_id = c.id
  where b.amount_minor is not null or coalesce(s.spent, 0) > 0
  order by (b.amount_minor is null), coalesce(s.spent, 0) desc;
$$;

-- --------------------------------------------------- dismissed insights ---
-- The insight itself is NOT stored: it is recomputed from the ledger every
-- time, so it can never disagree with a row the user edited afterwards. Only
-- the fact that this user has seen this one is durable.

create table public.insight_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  insight_key  text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, insight_key)
);

alter table public.insight_dismissals enable row level security;

create policy "own dismissals" on public.insight_dismissals
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------------ theme --

alter table public.profiles
  add column if not exists theme text not null default 'system'
  check (theme in ('light', 'dark', 'system'));
