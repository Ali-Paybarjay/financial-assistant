-- --------------------------------------- re-saving a step must not cost data --
--
-- Every collection step of onboarding saved itself the same way: delete
-- everything this user has, then insert what the form sent. Two round trips, no
-- transaction around them, and a window between them in which the user owns
-- nothing.
--
-- Four things went wrong with that, and the goals step had all four.
--
--  1. **A refused insert left an empty table.** `goals.target_amount` has a
--     `check (> 0)` and the form's validation only required a non-empty string,
--     so a target of «۰» passed the client, passed the action, and was refused
--     by Postgres — after the delete had already committed. The user submitted a
--     typo and lost every goal they had.
--
--  2. **A successful save also destroyed things.** New rows mean new ids, and
--     `transactions.goal_id` references goals with `on delete set null`. So
--     every transfer that had ever funded a goal came back unlabelled, and the
--     progress derived from those transfers reset to zero. The goal looked the
--     same and had forgotten everything that was put into it.
--
--  3. **`opening_saved` was not carried over.** What the user had already set
--     aside before the app knew about it lived on the row, and the row was gone.
--
--  4. It was reachable by anyone. A completed user can walk back into
--     `/onboarding/5` from settings to fix a typo in a title.
--
-- So each step gets one function that does the whole save in one statement
-- block — validated before anything is written, existing rows updated by id, and
-- only rows the user actually removed from the form deleted. A plpgsql function
-- body runs inside the caller's transaction, so «all of it or none of it» is the
-- default rather than something the action has to arrange.
--
-- `security invoker`, so RLS still decides what the caller may touch: these
-- functions are a way to make four writes atomic, not a way around the policies.
-- `user_id` comes from `auth.uid()` and never from the payload.
--
-- The contract each one takes is «this is the list», which is what re-submitting
-- a form means. A row whose id is not in the payload is a row the user deleted
-- with the bin button beside it.

-- ------------------------------------------------------------- who is asking --

create or replace function public.require_signed_in()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

comment on function public.require_signed_in() is
  'The caller''s user id, raising 42501 rather than returning null. Used by the onboarding save functions so an unauthenticated call cannot fall through to a no-op that looks like success.';

-- --------------------------------------------------------- income (step 2) --

create or replace function public.replace_income_sources(
  p_monthly_estimate bigint,
  p_currency text,
  p_sources jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_keep uuid[] := '{}';
  v_item jsonb;
  v_id uuid;
begin
  if p_monthly_estimate is null or p_monthly_estimate < 0 then
    raise exception 'monthly estimate must not be negative' using errcode = '23514';
  end if;

  -- Every amount is checked before the first write, so a bad row in the middle
  -- of the list cannot leave the first half replaced and the rest lost.
  for v_item in select value from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) loop
    if coalesce((v_item ->> 'amount')::bigint, -1) < 0 then
      raise exception 'income amount must not be negative' using errcode = '23514';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::uuid;

    if v_id is not null then
      update public.income_sources set
        title = v_item ->> 'title',
        type = v_item ->> 'type',
        amount = (v_item ->> 'amount')::bigint,
        currency = p_currency,
        frequency = v_item ->> 'frequency'
      where id = v_id and user_id = v_user
      returning id into v_id;
    end if;

    -- Either no id was sent, or the id was not this user's. Both mean «new row».
    if v_id is null then
      insert into public.income_sources
        (user_id, title, type, amount, currency, frequency)
      values (
        v_user,
        v_item ->> 'title',
        v_item ->> 'type',
        (v_item ->> 'amount')::bigint,
        p_currency,
        v_item ->> 'frequency'
      )
      returning id into v_id;
    end if;

    v_keep := v_keep || v_id;
  end loop;

  delete from public.income_sources
  where user_id = v_user and not (id = any (v_keep));

  update public.profiles
  set monthly_income_estimate = p_monthly_estimate,
      onboarding_step = greatest(coalesce(onboarding_step, 0), 2)
  where id = v_user;
end;
$$;

revoke execute on function public.replace_income_sources(bigint, text, jsonb)
  from public, anon;
grant execute on function public.replace_income_sources(bigint, text, jsonb)
  to authenticated;

-- --------------------------------------------------- fixed costs (step 3) --

create or replace function public.replace_recurring_expenses(
  p_currency text,
  p_expenses jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_keep uuid[] := '{}';
  v_item jsonb;
  v_id uuid;
begin
  for v_item in select value from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) loop
    if coalesce((v_item ->> 'amount')::bigint, -1) < 0 then
      raise exception 'expense amount must not be negative' using errcode = '23514';
    end if;
    if (v_item ->> 'due_day')::int not between 1 and 31 then
      raise exception 'due day out of range' using errcode = '23514';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::uuid;

    if v_id is not null then
      update public.recurring_expenses set
        title = v_item ->> 'title',
        category_id = nullif(v_item ->> 'category_id', '')::uuid,
        amount = (v_item ->> 'amount')::bigint,
        currency = p_currency,
        due_day = (v_item ->> 'due_day')::int
      where id = v_id and user_id = v_user
      returning id into v_id;
    end if;

    if v_id is null then
      insert into public.recurring_expenses
        (user_id, title, category_id, amount, currency, frequency, due_day)
      values (
        v_user,
        v_item ->> 'title',
        nullif(v_item ->> 'category_id', '')::uuid,
        (v_item ->> 'amount')::bigint,
        p_currency,
        'monthly',
        (v_item ->> 'due_day')::int
      )
      returning id into v_id;
    end if;

    v_keep := v_keep || v_id;
  end loop;

  -- This is the one that mattered most in practice. A fixed cost is the parent
  -- of every generated transaction for it: migration 0015 deletes those rows
  -- with it, and 0013's anchor month is what stops it generating them twice. A
  -- delete-and-reinsert therefore wiped the rent this app had posted and then
  -- posted it again under a new parent, which is how one month of rent becomes
  -- two.
  delete from public.recurring_expenses
  where user_id = v_user and not (id = any (v_keep));

  update public.profiles
  set onboarding_step = greatest(coalesce(onboarding_step, 0), 3)
  where id = v_user;
end;
$$;

revoke execute on function public.replace_recurring_expenses(text, jsonb) from public, anon;
grant execute on function public.replace_recurring_expenses(text, jsonb) to authenticated;

-- ----------------------------------------------------- baselines (step 4) --

create or replace function public.replace_expense_baselines(p_baselines jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_keep uuid[] := '{}';
  v_item jsonb;
begin
  for v_item in select value from jsonb_array_elements(coalesce(p_baselines, '[]'::jsonb)) loop
    if coalesce((v_item ->> 'monthly_estimate')::bigint, -1) < 0 then
      raise exception 'baseline must not be negative' using errcode = '23514';
    end if;
    if nullif(v_item ->> 'category_id', '') is null then
      raise exception 'baseline needs a category' using errcode = '23502';
    end if;
  end loop;

  -- Keyed by category rather than by id: the table's own unique constraint is
  -- (user_id, category_id), so the category *is* the identity here and an
  -- upsert on it needs no id from the form at all.
  for v_item in select value from jsonb_array_elements(coalesce(p_baselines, '[]'::jsonb)) loop
    insert into public.variable_expense_baselines (user_id, category_id, monthly_estimate)
    values (
      v_user,
      (v_item ->> 'category_id')::uuid,
      (v_item ->> 'monthly_estimate')::bigint
    )
    on conflict (user_id, category_id)
      do update set monthly_estimate = excluded.monthly_estimate;

    v_keep := v_keep || (v_item ->> 'category_id')::uuid;
  end loop;

  delete from public.variable_expense_baselines
  where user_id = v_user and not (category_id = any (v_keep));

  update public.profiles
  set onboarding_step = greatest(coalesce(onboarding_step, 0), 4)
  where id = v_user;
end;
$$;

revoke execute on function public.replace_expense_baselines(jsonb) from public, anon;
grant execute on function public.replace_expense_baselines(jsonb) to authenticated;

-- ---------------------------------------------------------- goals (step 5) --

create or replace function public.replace_goals(p_goals jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := public.require_signed_in();
  v_keep uuid[] := '{}';
  v_item jsonb;
  v_id uuid;
begin
  -- The whole of finding (1): the CHECK on target_amount is `> 0`, and this is
  -- the same rule asked before the first write instead of after the delete.
  for v_item in select value from jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) loop
    if coalesce((v_item ->> 'target_amount')::bigint, 0) <= 0 then
      raise exception 'goal target must be positive' using errcode = '23514';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) loop
    v_id := nullif(v_item ->> 'id', '')::uuid;

    if v_id is not null then
      -- Note what is *not* here: `opening_saved`, `status` and `created_at`.
      -- What was already set aside, and whether the goal is still open, are not
      -- this form's business — it collects a title, a type, a target and a date.
      -- Leaving them out is finding (3).
      update public.goals set
        title = v_item ->> 'title',
        type = v_item ->> 'type',
        target_amount = (v_item ->> 'target_amount')::bigint,
        target_date = nullif(v_item ->> 'target_date', '')::date,
        priority = (v_item ->> 'priority')::int
      where id = v_id and user_id = v_user
      returning id into v_id;
    end if;

    if v_id is null then
      insert into public.goals
        (user_id, title, type, target_amount, target_date, priority)
      values (
        v_user,
        v_item ->> 'title',
        v_item ->> 'type',
        (v_item ->> 'target_amount')::bigint,
        nullif(v_item ->> 'target_date', '')::date,
        (v_item ->> 'priority')::int
      )
      returning id into v_id;
    end if;

    v_keep := v_keep || v_id;
  end loop;

  -- Only what the user took out of the form. A goal that kept its id kept its
  -- funding transfers with it, which is finding (2).
  delete from public.goals
  where user_id = v_user and not (id = any (v_keep));

  update public.profiles
  set onboarding_step = greatest(coalesce(onboarding_step, 0), 5)
  where id = v_user;
end;
$$;

revoke execute on function public.replace_goals(jsonb) from public, anon;
grant execute on function public.replace_goals(jsonb) to authenticated;
