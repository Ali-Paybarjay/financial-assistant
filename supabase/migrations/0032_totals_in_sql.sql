-- ------------------------------------- totals that cannot be cut in half --
--
-- Every figure on the dashboard was built by selecting the month's rows into
-- JavaScript and adding them up there. `lib/queries/transactions.ts` had no
-- pagination and PostgREST answers with at most `db.max_rows` rows — 1000 by
-- default. Past that the response is simply shorter, with no error and no flag,
-- so the month's income, the month's spending, the donut, the six-month chart
-- and the surplus the goals page plans against were all sums over however much
-- of the ledger happened to fit. A reproduction with 1001 rows against a
-- ceiling of 1000 lost one row and said nothing. That was F10.
--
-- Two functions, and the reason there are two rather than one is that they
-- group differently: the month wants a figure per category, and the chart wants
-- one per month. Both group by `currency` as well, because this app has no
-- exchange rate and a total that adds two currencies together is not a total —
-- see F01 and lib/money.ts.
--
-- Transfers are excluded here, in SQL, for the reason the comment in
-- lib/queries/transactions.ts gives: money moving between the user's own
-- accounts is not income and not a spend, and counting it as either is the one
-- way this product could quietly ruin the number it is judged on.
--
-- `security invoker`, so the owner policy on `transactions` is what limits the
-- rows. The `user_id` predicate is redundant under that policy and written
-- anyway: it is the index the planner wants, and it keeps the function readable
-- as «this user's month» rather than «whatever RLS left».

create or replace function public.month_totals(p_from date, p_to date)
returns table (
  currency          text,
  kind              text,
  category_id       uuid,
  amount            bigint,
  unconfirmed_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.currency,
    t.type,
    t.category_id,
    sum(t.amount)::bigint,
    -- Only unconfirmed *spending* is counted, which is what the dashboard's
    -- dashed rule has always meant: the expense total contains guesses. The
    -- caller ignores this column on income rows.
    count(*) filter (where not t.is_confirmed)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.deleted_at is null
    and t.type in ('income', 'expense')
    and t.occurred_on >= p_from
    and t.occurred_on <= p_to
  group by t.currency, t.type, t.category_id;
$$;

revoke execute on function public.month_totals(date, date) from public, anon;
grant execute on function public.month_totals(date, date) to authenticated;

comment on function public.month_totals(date, date) is
  'One row per (currency, income/expense, category) over an inclusive date range. Replaces adding the month up in JavaScript, which silently stopped at the PostgREST row ceiling. See F10.';

create or replace function public.monthly_series(p_from date, p_to date)
returns table (
  month    date,
  currency text,
  income   bigint,
  expense  bigint,
  logged   bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', t.occurred_on)::date,
    t.currency,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint,
    -- Rows the user actually recorded, as opposed to ones this app generated
    -- from a fixed bill. A month whose only entries are generated is a month
    -- nobody kept books in, and «what a typical month leaves over» must not be
    -- read from it — see observedSurplus in lib/cashflow.ts.
    count(*) filter (where t.source <> 'recurring')::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.deleted_at is null
    and t.type in ('income', 'expense')
    and t.occurred_on >= p_from
    and t.occurred_on <= p_to
  group by 1, 2;
$$;

revoke execute on function public.monthly_series(date, date) from public, anon;
grant execute on function public.monthly_series(date, date) to authenticated;

comment on function public.monthly_series(date, date) is
  'Income, spending and logged-row count per month per currency over an inclusive range. See F10.';

-- The index these two want: one user, ordered by date, live rows only. The
-- existing transactions_user_date_idx covers the common case; this one carries
-- `type` so the `in ('income','expense')` filter is satisfied from the index
-- rather than by a heap fetch per row.
create index if not exists transactions_user_date_type_idx
  on public.transactions (user_id, occurred_on, type)
  where deleted_at is null;
