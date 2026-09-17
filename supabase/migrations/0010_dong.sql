-- دنگ و دونگ — shared expenses, and who owes whom.
--
-- The rest of this app answers "where did my money go". This answers a
-- different question: a trip, a flat, a dinner — several people paying for
-- things at different times, and at the end one list of who pays whom.
--
-- Two things make that more than a running total:
--
--   * A purchase is not split by who paid for it. One person puts the whole
--     hotel on their card; five people consumed it. So an expense carries an
--     explicit set of shares, and the shares — not the payment — are what a
--     person actually owes.
--   * Money also moves without anything being bought: a loan mid-trip, a
--     deposit into the kitty, the final settling up. Those are payments, and
--     they move the same balance the shares do.
--
-- Everything else here follows from keeping those two separate.

-- ------------------------------------------------------------ dong_groups --

-- A «دوره»: one trip, one flat, one month of shared meals.
create table public.dong_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  -- Chosen per group rather than inherited from the profile, because the
  -- reason to open one of these is often a trip abroad. It is still one
  -- currency for the whole group: this app does no rate conversion anywhere,
  -- and a group whose expenses were in three currencies could not be summed,
  -- balanced, or settled without inventing a rate.
  currency text not null check (char_length(currency) = 3),
  note text,
  started_on date not null,
  -- Set when the user declares the group finished. Kept rather than deleted:
  -- last summer's trip is the thing you go back and look at.
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dong_groups_user_idx on public.dong_groups (user_id);
create index dong_groups_user_open_idx on public.dong_groups (user_id)
  where settled_at is null;

create trigger dong_groups_set_updated_at before update on public.dong_groups
  for each row execute function public.set_updated_at();

alter table public.dong_groups enable row level security;

create policy dong_groups_select on public.dong_groups for select to authenticated
  using (user_id = (select auth.uid()));
create policy dong_groups_insert on public.dong_groups for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dong_groups_update on public.dong_groups for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dong_groups_delete on public.dong_groups for delete to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------- dong_members --

-- The people in a group. They are names, not accounts: the other five people
-- on the trip do not have a login here, and requiring one would mean this
-- feature only works when everybody installs the app. The one member that is
-- the viewer is marked, so the app can say «تو» and put their balance first.
create table public.dong_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.dong_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Which row is the person holding the phone.
  is_me boolean not null default false,
  -- The kitty. Everyone pays into it up front, it pays for things, and at the
  -- end its balance is what is left over. Modelling it as a member rather than
  -- a special case is what keeps the arithmetic below free of special cases:
  -- paying into it is a payment, and it paying for dinner is an expense.
  is_fund boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The two roles are exclusive; the kitty is not a person.
  check (not (is_me and is_fund))
);

-- Two people called «علی» in one group makes every balance ambiguous to the
-- one person who has to read it.
create unique index dong_members_group_name_key on public.dong_members
  (group_id, name);
create unique index dong_members_one_me_key on public.dong_members (group_id)
  where is_me;
create unique index dong_members_one_fund_key on public.dong_members (group_id)
  where is_fund;

create index dong_members_group_idx on public.dong_members (group_id);
create index dong_members_user_idx on public.dong_members (user_id);

create trigger dong_members_set_updated_at before update on public.dong_members
  for each row execute function public.set_updated_at();

alter table public.dong_members enable row level security;

create policy dong_members_select on public.dong_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy dong_members_insert on public.dong_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dong_members_update on public.dong_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dong_members_delete on public.dong_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- dong_expenses --

create table public.dong_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.dong_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount bigint not null check (amount > 0),
  -- Who actually handed over the money.
  --
  -- Deferred, and that is not decoration. Deleting a group cascades to its
  -- members and to its expenses, and the shares hang a second level down off
  -- the expenses; the reference check for a deleted member fires before that
  -- second level has been cleared, so an immediate constraint — RESTRICT or
  -- NO ACTION — refuses a group its own deletion. Checked at commit, the
  -- rows are all gone and it passes, while removing a member on their own
  -- still fails, which is the protection this is here for.
  paid_by_member_id uuid not null references public.dong_members(id)
    deferrable initially deferred,
  occurred_on date not null,
  -- Free text, offered from a suggested list. Drives the breakdown in the
  -- report the same way categories drive the dashboard's donut.
  tag text,
  note text,
  -- How the shares below were arrived at. The shares are authoritative either
  -- way; this is what the edit form reopens with, so that «مساوی» stays
  -- «مساوی» when a sixth person joins rather than becoming five fixed numbers.
  split_mode text not null default 'equal'
    check (split_mode in ('equal','shares','exact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dong_expenses_group_date_idx on public.dong_expenses
  (group_id, occurred_on desc);
create index dong_expenses_user_idx on public.dong_expenses (user_id);
create index dong_expenses_paid_by_idx on public.dong_expenses (paid_by_member_id);

create trigger dong_expenses_set_updated_at before update on public.dong_expenses
  for each row execute function public.set_updated_at();

alter table public.dong_expenses enable row level security;

create policy dong_expenses_select on public.dong_expenses for select to authenticated
  using (user_id = (select auth.uid()));
create policy dong_expenses_insert on public.dong_expenses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dong_expenses_update on public.dong_expenses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dong_expenses_delete on public.dong_expenses for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------- dong_expense_shares --

-- What each person consumed of one expense, as an amount rather than a ratio.
--
-- Resolved at write time on purpose, unlike account balances, which are
-- derived on every read. The difference is that a balance has one right
-- answer and this does not: splitting 10,000 three ways leaves a remainder of
-- 1 that has to land on somebody, and if that were decided at read time the
-- person carrying it could change between two screens. Deciding once, and
-- storing it, is what makes «سهم تو» the same number everywhere.
create table public.dong_expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.dong_expenses(id) on delete cascade,
  -- Deferred for the same reason as dong_expenses.paid_by_member_id.
  member_id uuid not null references public.dong_members(id)
    deferrable initially deferred,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Only meaningful under split_mode 'shares' — two units for the person who
  -- brought a guest. Left at 1 for the other two modes.
  units int not null default 1 check (units > 0),
  -- Zero is legal: someone in the group who did not eat is still listed, with
  -- nothing to pay, rather than silently dropped from the expense.
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

create index dong_expense_shares_expense_idx on public.dong_expense_shares (expense_id);
create index dong_expense_shares_member_idx on public.dong_expense_shares (member_id);
create index dong_expense_shares_user_idx on public.dong_expense_shares (user_id);

create trigger dong_expense_shares_set_updated_at before update
  on public.dong_expense_shares
  for each row execute function public.set_updated_at();

alter table public.dong_expense_shares enable row level security;

create policy dong_expense_shares_select on public.dong_expense_shares
  for select to authenticated using (user_id = (select auth.uid()));
create policy dong_expense_shares_insert on public.dong_expense_shares
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy dong_expense_shares_update on public.dong_expense_shares
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy dong_expense_shares_delete on public.dong_expense_shares
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- dong_payments --

-- Money moving between two members with nothing bought: a loan during the
-- trip, a deposit into the kitty, the transfer that settles up at the end.
-- All three move the balance identically; `kind` exists so the list can say
-- what happened, not so the arithmetic can branch on it.
create table public.dong_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.dong_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Deferred for the same reason as dong_expenses.paid_by_member_id.
  from_member_id uuid not null references public.dong_members(id)
    deferrable initially deferred,
  to_member_id uuid not null references public.dong_members(id)
    deferrable initially deferred,
  amount bigint not null check (amount > 0),
  kind text not null default 'settle' check (kind in ('settle','loan','deposit')),
  occurred_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);

create index dong_payments_group_date_idx on public.dong_payments
  (group_id, occurred_on desc);
create index dong_payments_user_idx on public.dong_payments (user_id);
create index dong_payments_from_idx on public.dong_payments (from_member_id);
create index dong_payments_to_idx on public.dong_payments (to_member_id);

create trigger dong_payments_set_updated_at before update on public.dong_payments
  for each row execute function public.set_updated_at();

alter table public.dong_payments enable row level security;

create policy dong_payments_select on public.dong_payments for select to authenticated
  using (user_id = (select auth.uid()));
create policy dong_payments_insert on public.dong_payments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dong_payments_update on public.dong_payments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dong_payments_delete on public.dong_payments for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------- the shares must cover the bill --

-- The one invariant this feature cannot survive without: if the shares of an
-- expense do not add up to the expense, every balance derived from them is
-- wrong, and wrong quietly — the list still renders, the numbers still look
-- like numbers. So it is checked in the database rather than only in the
-- action that happens to write it today.
--
-- DEFERRABLE INITIALLY DEFERRED because an expense and its shares are written
-- as several statements; the check has to happen once, at commit, when the set
-- is complete. That is also why the only supported writer is the RPC below,
-- which puts the whole set in one transaction.
create or replace function public.dong_shares_cover_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid := coalesce(new.expense_id, old.expense_id);
  v_amount bigint;
  v_shares bigint;
begin
  select e.amount into v_amount
  from public.dong_expenses e where e.id = v_expense_id;

  -- The expense was deleted in this same transaction and took its shares with
  -- it. There is no longer anything that could be inconsistent.
  if v_amount is null then return null; end if;

  select coalesce(sum(s.amount), 0) into v_shares
  from public.dong_expense_shares s where s.expense_id = v_expense_id;

  if v_shares <> v_amount then
    raise exception
      'shares (%) do not add up to the expense (%)', v_shares, v_amount
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger dong_expense_shares_cover
  after insert or update or delete on public.dong_expense_shares
  deferrable initially deferred
  for each row execute function public.dong_shares_cover_expense();

-- The same invariant from the other side: changing an expense's amount without
-- restating its shares breaks it just as thoroughly.
create or replace function public.dong_expense_covered_by_shares()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shares bigint;
begin
  select coalesce(sum(s.amount), 0) into v_shares
  from public.dong_expense_shares s where s.expense_id = new.id;

  if v_shares <> new.amount then
    raise exception
      'shares (%) do not add up to the expense (%)', v_shares, new.amount
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger dong_expenses_covered
  after insert or update on public.dong_expenses
  deferrable initially deferred
  for each row execute function public.dong_expense_covered_by_shares();

revoke execute on function public.dong_shares_cover_expense() from public, anon, authenticated;
revoke execute on function public.dong_expense_covered_by_shares() from public, anon, authenticated;

-- ---------------------------------------------- writing an expense atomically --

-- An expense and its shares are one fact and are written in one transaction.
-- Doing it from the application would mean two round trips, and the deferred
-- check above would fire at the end of the first one — correctly, because
-- after the first round trip the data really is inconsistent.
--
-- `p_shares` is [{"member_id": uuid, "units": int, "amount": bigint}, ...].
-- Passing the resolved amounts rather than a mode and a member list is
-- deliberate: the split arithmetic, including who carries the rounding
-- remainder, lives in lib/dong.ts where it is unit-tested, and the user sees
-- the resulting numbers in the form before saving them.
create or replace function public.dong_save_expense(
  p_group_id uuid,
  p_title text,
  p_amount bigint,
  p_paid_by uuid,
  p_occurred_on date,
  p_split_mode text,
  p_shares jsonb,
  p_tag text default null,
  p_note text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if p_id is null then
    insert into public.dong_expenses (
      group_id, user_id, title, amount, paid_by_member_id,
      occurred_on, tag, note, split_mode
    )
    values (
      p_group_id, v_user, p_title, p_amount, p_paid_by,
      p_occurred_on, p_tag, p_note, p_split_mode
    )
    returning id into v_id;
  else
    update public.dong_expenses set
      title = p_title,
      amount = p_amount,
      paid_by_member_id = p_paid_by,
      occurred_on = p_occurred_on,
      tag = p_tag,
      note = p_note,
      split_mode = p_split_mode
    where id = p_id
    returning id into v_id;

    -- RLS filtered it out, or it is not there any more.
    if v_id is null then
      raise exception 'expense not found' using errcode = 'no_data_found';
    end if;

    -- Replaced wholesale rather than diffed: a member dropped from the split
    -- must lose their share row, and an upsert would leave it behind holding
    -- an amount nobody owes.
    delete from public.dong_expense_shares where expense_id = v_id;
  end if;

  insert into public.dong_expense_shares (expense_id, member_id, user_id, units, amount)
  select
    v_id,
    (entry ->> 'member_id')::uuid,
    v_user,
    coalesce((entry ->> 'units')::int, 1),
    (entry ->> 'amount')::bigint
  from jsonb_array_elements(p_shares) as entry;

  return v_id;
end;
$$;

revoke execute on function public.dong_save_expense(
  uuid, text, bigint, uuid, date, text, jsonb, text, text, uuid
) from public, anon;
grant execute on function public.dong_save_expense(
  uuid, text, bigint, uuid, date, text, jsonb, text, text, uuid
) to authenticated;

-- ----------------------------------------------------------- the balances --

-- Where each member stands, in one round trip.
--
--   net = (what they put in) − (what they took out)
--       = (expenses they paid + payments they made)
--       − (their share of expenses + payments they received)
--
-- Positive is owed money, negative owes it. The kitty is in here like anyone
-- else, which is what makes deposits and its own spending cancel out: a fund
-- that has spent everything paid into it lands on exactly zero.
create or replace function public.dong_balances(p_group_id uuid)
returns table (
  member_id uuid,
  paid bigint,
  share bigint,
  sent bigint,
  received bigint,
  net bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    coalesce(p.total, 0)::bigint,
    coalesce(s.total, 0)::bigint,
    coalesce(o.total, 0)::bigint,
    coalesce(i.total, 0)::bigint,
    (coalesce(p.total, 0) + coalesce(o.total, 0)
      - coalesce(s.total, 0) - coalesce(i.total, 0))::bigint
  from public.dong_members m
  left join lateral (
    select sum(e.amount) as total from public.dong_expenses e
    where e.paid_by_member_id = m.id
  ) p on true
  left join lateral (
    select sum(sh.amount) as total from public.dong_expense_shares sh
    where sh.member_id = m.id
  ) s on true
  left join lateral (
    select sum(pay.amount) as total from public.dong_payments pay
    where pay.from_member_id = m.id
  ) o on true
  left join lateral (
    select sum(pay.amount) as total from public.dong_payments pay
    where pay.to_member_id = m.id
  ) i on true
  where m.group_id = p_group_id
    and m.user_id = (select auth.uid());
$$;

revoke execute on function public.dong_balances(uuid) from public, anon;
grant execute on function public.dong_balances(uuid) to authenticated;

-- ------------------------------------------------- the list page's numbers --

-- What the groups list shows on every row. A per-group subquery from the page
-- would be one round trip per row; this is one for the page.
create or replace function public.dong_group_totals()
returns table (
  group_id uuid,
  member_count int,
  expense_count int,
  total_spent bigint,
  last_activity_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    coalesce(m.count, 0)::int,
    coalesce(e.count, 0)::int,
    coalesce(e.total, 0)::bigint,
    greatest(e.last_on, p.last_on)
  from public.dong_groups g
  left join lateral (
    select count(*) as count from public.dong_members dm
    where dm.group_id = g.id and not dm.is_fund
  ) m on true
  left join lateral (
    select count(*) as count, sum(de.amount) as total, max(de.occurred_on) as last_on
    from public.dong_expenses de where de.group_id = g.id
  ) e on true
  left join lateral (
    select max(dp.occurred_on) as last_on
    from public.dong_payments dp where dp.group_id = g.id
  ) p on true
  where g.user_id = (select auth.uid());
$$;

revoke execute on function public.dong_group_totals() from public, anon;
grant execute on function public.dong_group_totals() to authenticated;
