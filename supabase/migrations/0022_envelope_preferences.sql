-- --------------------------------------------------- envelope preferences --

-- Which categories the user has put on the board, and which they have taken
-- off it.
--
-- Until now the board's membership was entirely derived: a category appeared
-- if it had a ceiling or had been spent in this month. That reads the user's
-- behaviour and never their intention, so a board could not be arranged. It
-- also meant a brand-new account saw an empty board while its owner had just
-- spent a whole onboarding telling us what they spend on.
--
-- So membership is now derived *and* overridden:
--
--   shown  — the user added this from the picker. It stays even with no
--            ceiling and no spending, because they asked for it.
--   hidden — the user took it off. This beats every derived reason, which is
--            the point: removing «قبوض» has to remove it even though there is
--            a bill in it this month. The spending is not hidden — it is in
--            the ledger and in the month's total, as it was. What is gone is
--            the card.
--
-- No row means «decide from the evidence», which is what everyone starts with.
create table public.envelope_preferences (
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  state       text not null check (state in ('shown', 'hidden')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);

alter table public.envelope_preferences enable row level security;

create policy envelope_preferences_all on public.envelope_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------ envelope status, take 2 --

-- Same contract as before, plus two things.
--
-- `baseline_minor` is what the user said in onboarding — the monthly estimate
-- from `variable_expense_baselines`, plus their monthly fixed bills in this
-- category. It is a *suggestion* and nothing writes it as a ceiling: an
-- estimate of «what I spend» is not a decision about «what I want to spend»,
-- and the app does not make that decision on someone's behalf any more than
-- it saves a model's guess without asking.
--
-- And membership now honours envelope_preferences, so a board can be arranged
-- rather than only observed.
--
-- Dropped rather than replaced: the return type gains a column, and Postgres
-- will not change the row type of an existing function in place.
drop function if exists public.envelope_status(date, date);

create function public.envelope_status(p_month_start date, p_month_end date)
returns table (
  category_id       uuid,
  name_fa           text,
  budget_minor      bigint,
  spent_minor       bigint,
  remaining_minor   bigint,
  unconfirmed_minor bigint,
  -- What onboarding suggests this ceiling could be. null when they said
  -- nothing about this category.
  baseline_minor    bigint
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
      and t.deleted_at is null
      and t.occurred_on between p_month_start and p_month_end
    group by t.category_id
  ),
  -- What they told us in onboarding: the variable estimate, plus any fixed
  -- bill filed under the same category.
  --
  -- Monthly bills only, and not a twelfth of the yearly ones. A ceiling is a
  -- month's allowance, and a yearly insurance premium does not arrive in
  -- twelfths — it arrives once, in a month that would then blow a ceiling
  -- built from its average. Suggesting nothing there is better than
  -- suggesting a figure that is guaranteed to be wrong twice a year.
  declared as (
    select category_id, sum(amount)::bigint as amount from (
      select veb.category_id, veb.monthly_estimate as amount
      from public.variable_expense_baselines veb
      where veb.user_id = (select auth.uid()) and veb.monthly_estimate > 0
      union all
      select re.category_id, re.amount
      from public.recurring_expenses re
      where re.user_id = (select auth.uid())
        and re.is_active
        and re.category_id is not null
        and re.frequency = 'monthly'
    ) rows
    group by category_id
  ),
  prefs as (
    select ep.category_id, ep.state
    from public.envelope_preferences ep
    where ep.user_id = (select auth.uid())
  )
  select c.id,
         c.name_fa,
         b.amount_minor,
         coalesce(s.spent, 0)::bigint,
         (b.amount_minor - coalesce(s.spent, 0))::bigint,
         coalesce(s.unconfirmed, 0)::bigint,
         d.amount
  from public.categories c
  left join b on b.category_id = c.id
  left join s on s.category_id = c.id
  left join declared d on d.category_id = c.id
  left join prefs p on p.category_id = c.id
  where c.kind = 'expense'
    -- Taken off the board wins over every reason to show it.
    and coalesce(p.state, '') <> 'hidden'
    and (
      p.state = 'shown'
      or b.amount_minor is not null
      or coalesce(s.spent, 0) > 0
      or d.amount is not null
    )
  order by (b.amount_minor is null), coalesce(s.spent, 0) desc, c.sort_order;
$$;

revoke execute on function public.envelope_status(date, date) from public, anon;
grant execute on function public.envelope_status(date, date) to authenticated;
