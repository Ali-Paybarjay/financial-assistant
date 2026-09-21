-- «دنگ و دونگ» meets the personal ledger.
--
-- Until now the two halves of this app did not touch. A trip was names and
-- shares; the money it moved was the user's own, but no account ever felt it.
-- That is not how the money works. When the person holding the phone pays for
-- dinner, the whole bill leaves one of their accounts that evening, and when
-- the group pays them back it arrives in one. Leave those two movements out
-- and every balance the app derives is wrong by exactly what the trip cost --
-- wrong quietly, which is the only kind that survives.
--
-- So: a group names the account it is run out of, an expense or a payment may
-- name its own, and every row where the user's *own* money moved is mirrored
-- into `transactions`.
--
-- Three things this deliberately does not do:
--
--   * It does not mirror what other people paid. Someone else buying dinner
--     is not a movement in this user's ledger, however much of it they owe.
--   * It does not net anything off. The bill leaves the account in full and
--     the reimbursements arrive one by one, because that is what the bank
--     statement will say, and this ledger has to be able to face a statement.
--   * It does not convert. A group in euros cannot be run out of an account
--     in tomans, and the mirror refuses rather than inventing a rate.

-- ------------------------------------------------ where the money passes --

-- On the group: the account this trip is run out of, and therefore the one
-- each new purchase starts out proposing. Also per row, because one trip is
-- quite normally half card and half cash.
alter table public.dong_groups add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

-- On the expense: only ever meaningful when the payer is the viewer. Null is
-- the ordinary case -- somebody else paid, or the user paid in cash they are
-- not tracking -- and null is what stops a mirror existing.
alter table public.dong_expenses add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

-- On the payment: the viewer's own side of it. Settling up, lending mid-trip
-- and paying into the kitty all move real money out of a real account, and
-- being paid back moves it in.
alter table public.dong_payments add column if not exists account_id uuid
  references public.accounts(id) on delete set null;

create index if not exists dong_groups_account_idx on public.dong_groups (account_id);
create index if not exists dong_expenses_account_idx on public.dong_expenses (account_id);
create index if not exists dong_payments_account_idx on public.dong_payments (account_id);

-- ------------------------------------------ the two sides of the mirror --

-- Mirrored rows need somewhere to land in the breakdown. Without a category
-- of their own a trip arrives on the dashboard as one large «بدون دسته»
-- wedge, which tells the user nothing and hides what it displaced.
insert into public.categories (user_id, name_fa, slug, kind, icon, is_system, sort_order)
values
  (null, 'دنگ و دونگ', 'dong', 'expense', 'users-three', true, 19),
  (null, 'برگشتی دنگ و دونگ', 'dong-refund', 'income', 'users-three', true, 20)
on conflict do nothing;

-- ---------------------------------------------- the link, on the ledger --

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('form','text','voice','receipt','recurring','statement','dong'));

-- Cascade, all three: the dong row is the original and the transaction is its
-- shadow. A shadow that outlives what cast it is a row nobody can explain and
-- nobody can edit, sitting inside a balance for ever.
alter table public.transactions
  add column if not exists dong_group_id uuid
    references public.dong_groups(id) on delete cascade,
  add column if not exists dong_expense_id uuid
    references public.dong_expenses(id) on delete cascade,
  add column if not exists dong_payment_id uuid
    references public.dong_payments(id) on delete cascade;

-- One mirror per dong row, which is what lets the sync below be an update
-- followed by "and if that matched nothing, insert".
create unique index if not exists transactions_dong_expense_key
  on public.transactions (dong_expense_id) where dong_expense_id is not null;
create unique index if not exists transactions_dong_payment_key
  on public.transactions (dong_payment_id) where dong_payment_id is not null;
create index if not exists transactions_dong_group_idx
  on public.transactions (dong_group_id);

alter table public.transactions drop constraint if exists transactions_dong_shape;
alter table public.transactions add constraint transactions_dong_shape check (
  -- A mirror is of one thing: a purchase or a payment, never both.
  (dong_expense_id is null or dong_payment_id is null)
  -- And it always names its group, so a row in the personal list can offer
  -- the one thing the user will want from it: the way back to where it is
  -- edited. Which makes `source = 'dong'` and "has a dong link" the same
  -- statement, so the constraint says it once.
  and (
    (dong_expense_id is null and dong_payment_id is null)
    = (dong_group_id is null)
  )
  and ((source = 'dong') = (dong_group_id is not null))
);

-- ------------------------------------------------------------ the sync --

-- Both mirrors are kept by trigger rather than by the server action that
-- happens to write the row today, for the same reason the shares-cover-the-
-- bill check is a constraint rather than a validation: there is one fact here
-- -- money left this account on this date -- and two places that state it
-- will eventually disagree. By the time they do, the balance has been wrong
-- for a month.
--
-- Written as plain functions with the triggers as thin wrappers, because
-- three different events run the same sync: the row changing, and a member
-- being marked (or unmarked) as the viewer, which turns somebody else's
-- purchase into the user's own and back.

create or replace function public.dong_expense_mirror(p_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense public.dong_expenses%rowtype;
  v_group public.dong_groups%rowtype;
  v_is_me boolean;
  v_account_currency text;
  v_category uuid;
  v_note text;
begin
  select * into v_expense from public.dong_expenses where id = p_expense_id;
  if not found then return; end if;

  select * into v_group from public.dong_groups where id = v_expense.group_id;
  select m.is_me into v_is_me from public.dong_members m
    where m.id = v_expense.paid_by_member_id;

  -- Somebody else paid, or the user did not say from where. Either way this
  -- is not a movement in their ledger -- and if it used to be, it stops being
  -- one now.
  if v_expense.account_id is null or not coalesce(v_is_me, false) then
    delete from public.transactions where dong_expense_id = p_expense_id;
    return;
  end if;

  select a.currency into v_account_currency from public.accounts a
    where a.id = v_expense.account_id;

  -- Also the check that the account is the user's own: under RLS an id
  -- belonging to somebody else reads back as no row at all.
  if v_account_currency is distinct from v_group.currency then
    raise exception 'dong: account currency (%) is not the group currency (%)',
      coalesce(v_account_currency, 'unknown'), v_group.currency
      using errcode = 'check_violation';
  end if;

  select c.id into v_category from public.categories c
    where c.user_id is null and c.slug = 'dong';

  v_note := v_expense.title || ' · ' || v_group.title;

  update public.transactions set
    type = 'expense',
    amount = v_expense.amount,
    currency = v_group.currency,
    category_id = v_category,
    account_id = v_expense.account_id,
    occurred_on = v_expense.occurred_on,
    note = v_note,
    -- The dong row is the original. A mirror deleted from the personal list,
    -- on a purchase that is still in the trip, was a mistake either way: the
    -- delete is refused in the action, and anything that got around it is
    -- corrected here.
    deleted_at = null
  where dong_expense_id = p_expense_id;

  if not found then
    insert into public.transactions (
      user_id, type, amount, currency, category_id, account_id,
      note, occurred_on, source, dong_group_id, dong_expense_id, is_confirmed
    ) values (
      v_expense.user_id, 'expense', v_expense.amount, v_group.currency, v_category,
      v_expense.account_id, v_note, v_expense.occurred_on, 'dong',
      v_group.id, p_expense_id, true
    );
  end if;
end;
$$;

create or replace function public.dong_payment_mirror(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.dong_payments%rowtype;
  v_group public.dong_groups%rowtype;
  v_from_me boolean;
  v_to_me boolean;
  v_from_name text;
  v_to_name text;
  v_outgoing boolean;
  v_account_currency text;
  v_category uuid;
  v_note text;
begin
  select * into v_payment from public.dong_payments where id = p_payment_id;
  if not found then return; end if;

  select * into v_group from public.dong_groups where id = v_payment.group_id;
  select m.is_me, m.name into v_from_me, v_from_name from public.dong_members m
    where m.id = v_payment.from_member_id;
  select m.is_me, m.name into v_to_me, v_to_name from public.dong_members m
    where m.id = v_payment.to_member_id;

  -- Two other people settling between themselves moves nothing of the user's,
  -- and neither does a payment with no account named. (Both ends being the
  -- viewer cannot happen -- one member per group carries `is_me` -- and if it
  -- somehow did, there would be no direction to give it.)
  if v_payment.account_id is null
     or coalesce(v_from_me, false) = coalesce(v_to_me, false) then
    delete from public.transactions where dong_payment_id = p_payment_id;
    return;
  end if;

  v_outgoing := coalesce(v_from_me, false);

  select a.currency into v_account_currency from public.accounts a
    where a.id = v_payment.account_id;

  if v_account_currency is distinct from v_group.currency then
    raise exception 'dong: account currency (%) is not the group currency (%)',
      coalesce(v_account_currency, 'unknown'), v_group.currency
      using errcode = 'check_violation';
  end if;

  -- Money coming back is not income the way a salary is, and it must not be
  -- filed beside one. Its own category is what keeps «درآمد این ماه» honest.
  select c.id into v_category from public.categories c
    where c.user_id is null
      and c.slug = case when v_outgoing then 'dong' else 'dong-refund' end;

  v_note :=
    case v_payment.kind
      when 'settle' then 'تسویه'
      when 'loan' then 'قرض'
      else 'بیعانه'
    end
    || case when v_outgoing then ' به ' else ' از ' end
    || case when v_outgoing then v_to_name else v_from_name end
    || ' · ' || v_group.title;

  update public.transactions set
    type = case when v_outgoing then 'expense' else 'income' end,
    amount = v_payment.amount,
    currency = v_group.currency,
    category_id = v_category,
    account_id = v_payment.account_id,
    occurred_on = v_payment.occurred_on,
    note = v_note,
    deleted_at = null
  where dong_payment_id = p_payment_id;

  if not found then
    insert into public.transactions (
      user_id, type, amount, currency, category_id, account_id,
      note, occurred_on, source, dong_group_id, dong_payment_id, is_confirmed
    ) values (
      v_payment.user_id,
      case when v_outgoing then 'expense' else 'income' end,
      v_payment.amount, v_group.currency, v_category, v_payment.account_id,
      v_note, v_payment.occurred_on, 'dong', v_group.id, p_payment_id, true
    );
  end if;
end;
$$;

-- PERFORMed from the trigger wrappers below, and a function called inside a
-- trigger is still checked against the calling user's privileges. Safe to
-- hand to `authenticated` directly: both run as the invoker, so the worst a
-- hand-made call can do is re-sync a row the caller already owns.
revoke execute on function public.dong_expense_mirror(uuid) from public, anon;
revoke execute on function public.dong_payment_mirror(uuid) from public, anon;
grant execute on function public.dong_expense_mirror(uuid) to authenticated;
grant execute on function public.dong_payment_mirror(uuid) to authenticated;

create or replace function public.dong_expense_mirror_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.dong_expense_mirror(new.id);
  return null;
end;
$$;

create or replace function public.dong_payment_mirror_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.dong_payment_mirror(new.id);
  return null;
end;
$$;

-- Marking a different person as «من» re-answers the question every mirror in
-- the group was derived from. Without this, a trip the user paid for would go
-- on charging their account after they said the payer was somebody else.
create or replace function public.dong_member_mirror_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row record;
begin
  if new.is_me is not distinct from old.is_me then return null; end if;

  for v_row in
    select id from public.dong_expenses where paid_by_member_id = new.id
  loop
    perform public.dong_expense_mirror(v_row.id);
  end loop;

  for v_row in
    select id from public.dong_payments
    where from_member_id = new.id or to_member_id = new.id
  loop
    perform public.dong_payment_mirror(v_row.id);
  end loop;

  return null;
end;
$$;

drop trigger if exists dong_expenses_mirror on public.dong_expenses;
create trigger dong_expenses_mirror
  after insert or update on public.dong_expenses
  for each row execute function public.dong_expense_mirror_sync();

drop trigger if exists dong_payments_mirror on public.dong_payments;
create trigger dong_payments_mirror
  after insert or update on public.dong_payments
  for each row execute function public.dong_payment_mirror_sync();

drop trigger if exists dong_members_mirror on public.dong_members;
create trigger dong_members_mirror
  after update on public.dong_members
  for each row execute function public.dong_member_mirror_sync();

revoke execute on function public.dong_expense_mirror_sync()
  from public, anon, authenticated;
revoke execute on function public.dong_payment_mirror_sync()
  from public, anon, authenticated;
revoke execute on function public.dong_member_mirror_sync()
  from public, anon, authenticated;

-- ------------------------------------------- the writer, with an account --

-- The same function as 0010, plus the account the purchase was paid from. The
-- old signature is dropped rather than left beside this one: an overload that
-- still exists is an overload something will go on calling, and the thing
-- calling it would be writing purchases that never reach the ledger.
drop function if exists public.dong_save_expense(
  uuid, text, bigint, uuid, date, text, jsonb, text, text, uuid
);

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
  p_id uuid default null,
  p_account_id uuid default null
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
      occurred_on, tag, note, split_mode, account_id
    )
    values (
      p_group_id, v_user, p_title, p_amount, p_paid_by,
      p_occurred_on, p_tag, p_note, p_split_mode, p_account_id
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
      split_mode = p_split_mode,
      account_id = p_account_id
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
  uuid, text, bigint, uuid, date, text, jsonb, text, text, uuid, uuid
) from public, anon;
grant execute on function public.dong_save_expense(
  uuid, text, bigint, uuid, date, text, jsonb, text, text, uuid, uuid
) to authenticated;

-- ------------------------------------------------- one more count, listed --

-- `dong_group_totals` gains the payment count. The currency of a group is
-- locked once anything has been recorded in it -- not once an *expense* has,
-- which is all the old count could answer: a group whose only rows are
-- payments could still have its currency swapped out from under two mirrored
-- transactions.
--
-- Dropped first: `create or replace` cannot add a column to a function's
-- returned row type, and this one returns a table.
drop function if exists public.dong_group_totals();

create or replace function public.dong_group_totals()
returns table (
  group_id uuid,
  member_count int,
  expense_count int,
  payment_count int,
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
    coalesce(p.count, 0)::int,
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
    select count(*) as count, max(dp.occurred_on) as last_on
    from public.dong_payments dp where dp.group_id = g.id
  ) p on true
  where g.user_id = (select auth.uid());
$$;

revoke execute on function public.dong_group_totals() from public, anon;
grant execute on function public.dong_group_totals() to authenticated;
