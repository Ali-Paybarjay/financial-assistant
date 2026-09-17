-- Financial Assistant — initial schema.
--
-- Conventions enforced throughout:
--   * every money column is bigint in the currency's minor unit (cents)
--   * RLS uses (select auth.uid()), never a bare auth.uid(): the bare call is
--     re-evaluated per row, the wrapped one is evaluated once
--   * policies are per-operation and scoped `to authenticated`
--   * every column referenced by a policy, and every FK, is indexed

-- ---------------------------------------------------------------- helpers --

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles --

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC',
  base_currency text not null default 'CAD'
    check (base_currency in ('CAD','USD','EUR','GBP','AUD')),
  -- The real rule is "at least 13 years old", which depends on the current
  -- year and so cannot live in a CHECK (must be immutable). Zod enforces it.
  birth_year int check (birth_year between 1930 and 2100),
  employment_status text check (employment_status in
    ('employed','self_employed','student','retired','unemployed','other')),
  risk_score int check (risk_score between 1 and 10),
  risk_label text check (risk_label in ('conservative','balanced','growth')),
  monthly_income_estimate bigint check (monthly_income_estimate >= 0),
  has_debt boolean,
  debt_amount bigint check (debt_amount >= 0),
  emergency_fund_months numeric(4,1) check (emergency_fund_months >= 0),
  savings_rate_estimate int check (savings_rate_estimate between 0 and 100),
  onboarding_step int not null default 0 check (onboarding_step between 0 and 7),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Every auth user gets a profile row immediately, so no code path ever has to
-- handle "signed in but no profile".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions must not be reachable through PostgREST. Triggers check
-- EXECUTE at CREATE TRIGGER time, not per firing, so this does not disarm them.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ------------------------------------------------------------- categories --

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = system row
  name_fa text not null,
  slug text not null,
  kind text not null check (kind in ('expense','income')),
  icon text,
  color text,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_user_slug_key on public.categories
  (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index categories_user_id_idx on public.categories (user_id);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

-- The one table whose read policy is not "own rows": system categories have a
-- null user_id and must be visible to everyone, or no one can log anything.
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()) and is_system = false);
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- income_sources --

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in
    ('salary','freelance','business','investment','rental','pension','other')),
  amount bigint not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  frequency text not null check (frequency in
    ('monthly','biweekly','weekly','yearly','one_time')),
  is_active boolean not null default true,
  started_on date,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index income_sources_user_idx on public.income_sources (user_id);
create index income_sources_user_active_idx on public.income_sources (user_id)
  where is_active;

create trigger income_sources_set_updated_at before update on public.income_sources
  for each row execute function public.set_updated_at();

alter table public.income_sources enable row level security;

create policy income_sources_select on public.income_sources for select to authenticated
  using (user_id = (select auth.uid()));
create policy income_sources_insert on public.income_sources for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy income_sources_update on public.income_sources for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy income_sources_delete on public.income_sources for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------ recurring_expenses --

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount bigint not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  frequency text not null check (frequency in ('monthly','quarterly','yearly')),
  due_day int not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  auto_post boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_expenses_user_idx on public.recurring_expenses (user_id);
create index recurring_expenses_category_idx on public.recurring_expenses (category_id);
create index recurring_expenses_autopost_idx on public.recurring_expenses (user_id)
  where is_active and auto_post;

create trigger recurring_expenses_set_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

create policy recurring_expenses_select on public.recurring_expenses for select to authenticated
  using (user_id = (select auth.uid()));
create policy recurring_expenses_insert on public.recurring_expenses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy recurring_expenses_update on public.recurring_expenses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recurring_expenses_delete on public.recurring_expenses for delete to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------- media_assets --

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('audio','image')),
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0),
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','parsed','failed')),
  transcript text,
  extracted jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_assets_user_status_idx on public.media_assets (user_id, status);

create trigger media_assets_set_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

alter table public.media_assets enable row level security;

create policy media_assets_select on public.media_assets for select to authenticated
  using (user_id = (select auth.uid()));
create policy media_assets_insert on public.media_assets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy media_assets_update on public.media_assets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy media_assets_delete on public.media_assets for delete to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------- transactions --

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  amount bigint not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  category_id uuid references public.categories(id) on delete set null,
  merchant text,
  note text,
  occurred_on date not null,
  source text not null check (source in ('form','text','voice','receipt','recurring')),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  -- Present only on rows generated from a recurring expense. Together with
  -- posted_month they carry the idempotency guarantee below.
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  posted_month date,
  ai_confidence numeric(3,2) check (ai_confidence between 0 and 1),
  ai_raw jsonb,
  -- Drives the confidence rule in the UI. needs_review names the specific
  -- fields the model guessed, because the rule is per-field, not per-row.
  is_confirmed boolean not null default true,
  needs_review text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recurring_expense_id is null) = (posted_month is null)),
  check (posted_month is null or date_trunc('month', posted_month) = posted_month)
);

-- Running the recurring job twice must not create a second row.
create unique index transactions_recurring_month_key on public.transactions
  (recurring_expense_id, posted_month)
  where recurring_expense_id is not null and deleted_at is null;

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc)
  where deleted_at is null;
create index transactions_user_category_idx on public.transactions (user_id, category_id)
  where deleted_at is null;
-- The composite above leads with user_id, so it cannot serve the category_id-only
-- lookup Postgres runs when a category is deleted and ON DELETE SET NULL fires.
create index transactions_category_idx on public.transactions (category_id);
create index transactions_media_idx on public.transactions (media_asset_id);
create index transactions_recurring_idx on public.transactions (recurring_expense_id);

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy transactions_select on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------------ goals --

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in
    ('emergency_fund','home','travel','debt_payoff','education','investment','other')),
  target_amount bigint not null check (target_amount > 0),
  saved_amount bigint not null default 0 check (saved_amount >= 0),
  target_date date,
  priority int not null default 0,
  status text not null default 'active'
    check (status in ('active','achieved','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_status_idx on public.goals (user_id, status);

create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

create policy goals_select on public.goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy goals_insert on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy goals_update on public.goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_delete on public.goals for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------ variable_expense_baselines --

-- Onboarding step 4 collects a monthly estimate per major category. These are
-- a baseline for the financial picture, never transactions.
create table public.variable_expense_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_estimate bigint not null check (monthly_estimate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index variable_expense_baselines_user_idx
  on public.variable_expense_baselines (user_id);
create index variable_expense_baselines_category_idx
  on public.variable_expense_baselines (category_id);

create trigger variable_expense_baselines_set_updated_at
  before update on public.variable_expense_baselines
  for each row execute function public.set_updated_at();

alter table public.variable_expense_baselines enable row level security;

create policy veb_select on public.variable_expense_baselines for select to authenticated
  using (user_id = (select auth.uid()));
create policy veb_insert on public.variable_expense_baselines for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy veb_update on public.variable_expense_baselines for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy veb_delete on public.variable_expense_baselines for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- ai_usage_logs --

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_cents int,
  latency_ms int,
  status text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_logs_user_created_idx
  on public.ai_usage_logs (user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;

-- Readable by its owner; writable only by the server (service role bypasses RLS).
-- The deliberate absence of an insert policy is what stops a client forging usage.
create policy ai_usage_logs_select on public.ai_usage_logs for select to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------- recurring posting job --

-- Idempotent by construction: the unique index above absorbs a second run,
-- including two concurrent ones. security invoker keeps the caller's RLS.
create or replace function public.post_recurring_for_month(p_month date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_inserted integer;
begin
  insert into public.transactions (
    user_id, type, amount, currency, category_id, merchant, note,
    occurred_on, source, recurring_expense_id, posted_month, is_confirmed
  )
  select
    r.user_id,
    'expense',
    r.amount,
    r.currency,
    r.category_id,
    null,
    r.title,
    -- A due_day of 31 in a 30-day month lands on the last day, not next month.
    least(
      v_month + (r.due_day - 1),
      (v_month + interval '1 month - 1 day')::date
    ),
    'recurring',
    r.id,
    v_month,
    true
  from public.recurring_expenses r
  where r.user_id = (select auth.uid())
    and r.is_active
    and r.auto_post
    and r.frequency = 'monthly'
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.post_recurring_for_month(date) from public, anon;
grant execute on function public.post_recurring_for_month(date) to authenticated;
