-- ------------------------------------------------- what a ceiling is for --

-- A ceiling is a decision about money you could spend differently. Rent is
-- not that. Nor is the electricity bill, nor the loan instalment: the amount
-- is already decided by someone else, the date is decided by someone else,
-- and the only thing the user can do about it is pay it. Asking «how much do
-- you want to spend on rent this month?» is not a budgeting question — it is
-- a question with one possible answer, and putting it on the board teaches
-- the user that the board asks pointless things.
--
-- So expense categories now say which kind they are, and only the variable
-- ones can carry a ceiling.
--
-- Declared, not derived. The tempting shortcut is «fixed = has an active
-- recurring expense filed under it», and it is wrong in both directions:
-- «حمل‌ونقل» is offered as a recurring suggestion *and* as a variable
-- baseline — a monthly transit pass is fixed, the taxis around it are not —
-- and someone who has not got round to entering their rent yet would be
-- asked to budget for it. A category's nature does not change because a row
-- was or was not typed.
alter table public.categories
  add column if not exists cost_kind text not null default 'variable'
    check (cost_kind in ('fixed', 'variable'));

comment on column public.categories.cost_kind is
  'fixed = a committed amount on a committed date (rent, bills, instalments); it can never carry a ceiling. variable = discretionary spending, which can. User-made categories default to variable.';

-- The five system categories whose amounts are decided before the month
-- starts. «آموزش» is deliberately not among them: tuition is often an
-- instalment, but books and courses are not, and education was named as
-- something a ceiling *should* be allowed on.
update public.categories
   set cost_kind = 'fixed'
 where user_id is null
   and slug in ('housing', 'utilities', 'loan-repay', 'insurance', 'subscriptions');

-- --------------------------------------------- ceilings already written --

-- Anyone who set one before this migration had it on a category the app is
-- about to stop drawing a ceiling for. Left in place it would be a number
-- nothing reads and nobody can find to delete, which is the worst state a
-- figure can be in. The spending is untouched; only the ceiling goes.
delete from public.category_budgets cb
 using public.categories c
 where c.id = cb.category_id
   and c.cost_kind = 'fixed';

-- -------------------------------------------------------- and no new ones --

-- In the database rather than only in the server action, because «a fixed
-- cost has no ceiling» is a fact about the data and not about one code path.
-- The action still checks first so the user gets a sentence rather than a
-- stack trace; this is what happens when anything else tries.
--
-- security definer, unlike envelope_status(): this asks what a category *is*,
-- not what the caller is allowed to see. Under invoker rights a category the
-- writer cannot select would read as «not fixed» and the check would pass by
-- accident, which is exactly backwards for a constraint.
create or replace function public.reject_ceiling_on_fixed_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if exists (
    select 1 from public.categories c
     where c.id = new.category_id
       and c.cost_kind = 'fixed'
  ) then
    raise exception
      'category % is a fixed cost and cannot carry a ceiling', new.category_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

-- A trigger function is not an API. Same revoke as every other one in this
-- schema — and it matters more here, because this one is security definer.
revoke execute on function public.reject_ceiling_on_fixed_cost()
  from public, anon, authenticated;

drop trigger if exists category_budgets_variable_only on public.category_budgets;
create trigger category_budgets_variable_only
  before insert or update on public.category_budgets
  for each row execute function public.reject_ceiling_on_fixed_cost();

-- ---------------------------------------------- envelope status, take 3 --

-- Same contract as take 2, plus `cost_kind`, so the board can draw a fixed
-- cost as what it is — a commitment, with what has been paid against it —
-- rather than as an envelope waiting for a ceiling nobody should be asked
-- for.
--
-- `b` now joins categories and keeps only the variable ones. Belt and braces
-- with the trigger above, and it also settles what happens if a category is
-- ever turned from variable to fixed with a ceiling already on it: the
-- ceiling stops counting from that moment rather than lingering as a figure
-- every card silently ignores.
--
-- Dropped rather than replaced: the return type gains a column.
drop function if exists public.envelope_status(date, date);

create function public.envelope_status(p_month_start date, p_month_end date)
returns table (
  category_id       uuid,
  name_fa           text,
  -- 'fixed' or 'variable'. budget_minor is always null for the first kind —
  -- not «unset», because there is nothing to set.
  cost_kind         text,
  budget_minor      bigint,
  spent_minor       bigint,
  remaining_minor   bigint,
  unconfirmed_minor bigint,
  -- For a variable category: what onboarding suggests the ceiling could be.
  -- For a fixed one: what the user said this costs every month, which is the
  -- figure the commitment card is read against.
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
    join public.categories c
      on c.id = cb.category_id and c.cost_kind = 'variable'
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
         c.cost_kind,
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
    and coalesce(p.state, '') <> 'hidden'
    and (
      p.state = 'shown'
      or b.amount_minor is not null
      or coalesce(s.spent, 0) > 0
      or d.amount is not null
    )
  -- Fixed costs sort after every envelope: the board groups them separately,
  -- and a bill that has to be paid is not what the month is about. Within
  -- each group the old order stands — ceilings first, then by spend.
  order by (c.cost_kind = 'fixed'),
           (b.amount_minor is null),
           coalesce(s.spent, 0) desc,
           c.sort_order;
$$;

revoke execute on function public.envelope_status(date, date) from public, anon;
grant execute on function public.envelope_status(date, date) to authenticated;
