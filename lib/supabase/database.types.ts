/**
 * Hand-written to match supabase/migrations/0001_init.sql. Once a Supabase
 * project exists this file is replaced wholesale by `pnpm gen:types`; the
 * shape below deliberately matches the generator's output so that swap is
 * a drop-in.
 */

type Generated =
  | "id"
  | "created_at"
  | "updated_at";

/** A column that accepts null can always be omitted on insert. */
type NullableKeys<Row> = {
  [K in keyof Row]-?: null extends Row[K] ? K : never;
}[keyof Row];

type Optional<Row, Defaulted extends keyof Row> = Extract<
  Generated | Defaulted | NullableKeys<Row>,
  keyof Row
>;

type Table<Row, Defaulted extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional<Row, Defaulted>> &
    Partial<Pick<Row, Optional<Row, Defaulted>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type TransactionSource =
  | "form"
  | "text"
  | "voice"
  | "receipt"
  | "recurring"
  | "statement"
  /** Mirrored from «دنگ و دونگ» by trigger. The dong row is the original. */
  | "dong";
/** "transfer" is money moving between two of the user's own accounts. */
export type TransactionType = "expense" | "income" | "transfer";
export type CategoryKind = "expense" | "income";
/**
 * Whether spending in a category is a decision or an obligation.
 *
 * «fixed» — rent, bills, instalments: the amount and the date are
 * already settled, so a ceiling would be a budget for something nobody
 * can spend differently. Only «variable» categories can carry one.
 */
export type CostKind = "fixed" | "variable";
/** A receipt photo, or a statement file (PDF, CSV, or a photographed page). */
export type MediaKind = "image" | "document";
export type MediaStatus = "uploaded" | "processing" | "parsed" | "failed";
export type GoalStatus = "active" | "achieved" | "paused" | "cancelled";
/** The two sides of the app. Mirrors WorkspaceId in lib/workspaces.ts. */
export type WorkspaceId = "personal" | "dong";
export type StatementImportStatus =
  | "uploading"
  | "parsing"
  | "review"
  | "applied"
  | "failed"
  | "discarded";
/** Money leaving the account, or arriving in it. */
export type StatementDirection = "in" | "out";
/** "cash" is a pocket, not a bank — it holds a balance the same way. */
export type AccountKind = "checking" | "savings" | "card" | "cash" | "other";
export type StatementMatchStatus = "new" | "matched" | "imported" | "skipped";

/** How an expense's shares were arrived at, so the form can reopen as it was. */
export type DongSplitMode = "equal" | "shares" | "exact";
/** Money moving between two members with nothing bought. */
export type DongPaymentKind = "settle" | "loan" | "deposit";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  country_code: string | null;
  timezone: string;
  base_currency: string;
  birth_year: number | null;
  employment_status: string | null;
  monthly_income_estimate: number | null;
  has_debt: boolean | null;
  debt_amount: number | null;
  emergency_fund_months: number | null;
  savings_rate_estimate: number | null;
  onboarding_step: number;
  /**
   * Where «/» redirects. null = ask every time. NOT the current workspace,
   * which is read from the url and never stored — see lib/workspaces.ts.
   */
  default_workspace: WorkspaceId | null;
  /**
   * The durable copy of the theme choice. The stylesheet reads a cookie
   * instead — `<html data-theme>` has to be right before any query runs — and
   * this is what refills that cookie on another device. See lib/theme.ts.
   */
  theme: "light" | "dark" | "system";
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  user_id: string | null;
  name_fa: string;
  slug: string;
  kind: CategoryKind;
  /**
   * Whether a ceiling is a meaningful thing to ask about this category.
   * «fixed» is a committed amount on a committed date — rent, bills,
   * instalments — and can never carry one. See migration 0026.
   */
  cost_kind: CostKind;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  user_id: string;
  title: string;
  kind: AccountKind;
  currency: string;
  /** May be negative: a credit card at 1,200 owed is -1200. */
  opening_balance: number;
  opening_balance_on: string;
  institution: string | null;
  reference: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  /** When the user last checked this account against a statement. */
  last_reconciled_at: string | null;
  created_at: string;
  updated_at: string;
};

/** One row of account_balances(). Derived on read, never stored. */
export type AccountBalanceRow = {
  account_id: string;
  opening_balance: number;
  movement: number;
  balance: number;
  transaction_count: number;
  last_activity_on: string | null;
};

export type RecurringSkippedMonthRow = {
  id: string;
  user_id: string;
  recurring_expense_id: string;
  month: string;
  created_at: string;
};

/**
 * A fixed bill that should have been generated for a past month and was not,
 * and that the user has neither confirmed nor waved away.
 */
export type MissedRecurringRow = {
  recurring_expense_id: string;
  month: string;
  amount: number;
  title: string;
};

/** What goal_progress() returns: a goal's standing, derived from the ledger. */
export type GoalProgressRow = {
  goal_id: string;
  /** Moved into savings for it. */
  funded: number;
  /** Spent on it. */
  spent: number;
  /** opening_saved + funded − spent. Negative when it was overspent. */
  saved: number;
};

/**
 * A ceiling on one category, from one month onwards. There is no row per
 * month: the ceiling that applies to any month is the newest row whose
 * effective_from is not after it. See migration 0019.
 */
export type CategoryBudgetRow = {
  id: string;
  user_id: string;
  category_id: string;
  amount_minor: number;
  currency: string;
  /** Always a month start, YYYY-MM-01. */
  effective_from: string;
  created_at: string;
};

/**
 * «I have seen this and I do not want it again.» The insight itself is never
 * stored — only this. See migration 0020.
 */
export type InsightDismissalRow = {
  user_id: string;
  /** «rule:scope», owned by lib/insights.ts. */
  insight_key: string;
  dismissed_at: string;
};

/** One row of envelope_status(). Derived on read, never stored. */
export type EnvelopeStatusRow = {
  category_id: string;
  name_fa: string;
  /** A fixed cost is a commitment, not an envelope, and never has a ceiling. */
  cost_kind: CostKind;
  /** null = no ceiling set for this month, and always null when fixed. */
  budget_minor: number | null;
  spent_minor: number;
  /** null without a ceiling; negative once the ceiling is passed. */
  remaining_minor: number | null;
  /** How much of spent_minor is still an unconfirmed guess. */
  unconfirmed_minor: number;
  /**
   * What the user said in onboarding this category costs per month. A
   * suggestion for the ceiling, never written as one — see migration 0022.
   */
  baseline_minor: number | null;
};

/**
 * Whether a category is on the board because the user put it there, or off it
 * because they took it off. No row means «decide from the evidence».
 */
export type EnvelopePreferenceRow = {
  user_id: string;
  category_id: string;
  state: "shown" | "hidden";
  updated_at: string;
};

export type IncomeSourceRow = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  amount: number;
  currency: string;
  frequency: string;
  is_active: boolean;
  started_on: string | null;
  ended_on: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringExpenseRow = {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  /** The account the posted transaction comes out of, if the user named one. */
  account_id: string | null;
  amount: number;
  currency: string;
  frequency: string;
  due_day: number;
  /**
   * Which month a non-monthly bill falls in: that month for a yearly one,
   * that month and every third after it for a quarterly one. Null exactly
   * when the frequency is monthly, which the database enforces.
   */
  due_month: number | null;
  is_active: boolean;
  auto_post: boolean;
  created_at: string;
  updated_at: string;
};

export type MediaAssetRow = {
  id: string;
  user_id: string;
  kind: MediaKind;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: MediaStatus;
  statement_import_id: string | null;
  extracted: unknown | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: string | null;
  /** Null is money that moved without touching a tracked account. */
  account_id: string | null;
  /** Only ever set on a transfer: the account the money arrived in. */
  to_account_id: string | null;
  merchant: string | null;
  note: string | null;
  occurred_on: string;
  source: TransactionSource;
  media_asset_id: string | null;
  recurring_expense_id: string | null;
  posted_month: string | null;
  statement_line_id: string | null;
  /**
   * Which goal this row is about. On a transfer it is money being set aside;
   * on an expense it is that money being spent. Never on income.
   */
  goal_id: string | null;
  /**
   * Set together, and only on a row «دنگ و دونگ» wrote: the group is what the
   * personal list links back to, and one of the other two is what it mirrors.
   * Kept in step by trigger — see migration 0017 — so nothing here is edited
   * from the personal side.
   */
  dong_group_id: string | null;
  dong_expense_id: string | null;
  dong_payment_id: string | null;
  ai_confidence: number | null;
  ai_raw: unknown | null;
  is_confirmed: boolean;
  needs_review: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  target_amount: number;
  /**
   * What was already set aside before the app knew. Everything since comes
   * from the ledger — read a goal's real progress through goal_progress(),
   * never from this column.
   */
  opening_saved: number;
  target_date: string | null;
  priority: number;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
};

export type VariableExpenseBaselineRow = {
  id: string;
  user_id: string;
  category_id: string;
  monthly_estimate: number;
  created_at: string;
  updated_at: string;
};

export type StatementImportRow = {
  id: string;
  user_id: string;
  status: StatementImportStatus;
  /** The account this statement is of. Null on imports predating accounts. */
  account_id: string | null;
  source_currency: string;
  target_currency: string;
  period_from: string | null;
  period_to: string | null;
  file_count: number;
  line_count: number;
  matched_count: number;
  new_count: number;
  imported_count: number;
  /** What the statement said the account held when the period ended. */
  closing_balance: number | null;
  closing_balance_on: string | null;
  /** Whether the user accepted that number as the account's balance. */
  balance_applied: boolean;
  error_message: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StatementLineRow = {
  id: string;
  import_id: string;
  user_id: string;
  row_index: number;
  occurred_on: string;
  direction: StatementDirection;
  amount: number;
  description: string | null;
  merchant: string | null;
  category_id: string | null;
  ai_confidence: number | null;
  needs_review: string[];
  match_status: StatementMatchStatus;
  matched_transaction_id: string | null;
  match_day_gap: number | null;
  created_at: string;
  updated_at: string;
};

export type AiUsageLogRow = {
  id: string;
  user_id: string;
  feature: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  latency_ms: number | null;
  status: string;
  created_at: string;
};

/* ------------------------------------------------------- دنگ و دونگ -- */

/** A «دوره»: one trip, one flat, one month of shared meals. */
export type DongGroupRow = {
  id: string;
  user_id: string;
  title: string;
  /** One currency for the whole group; this app converts nothing. */
  currency: string;
  note: string | null;
  started_on: string;
  /**
   * The account this group is run out of. Only a default for the rows below;
   * what a purchase actually cost the user is on the purchase.
   */
  account_id: string | null;
  /** Set when the user declares the group finished. */
  settled_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A person in a group — a name, not an account. `is_me` marks the viewer;
 * `is_fund` marks the kitty, which is a member so that paying into it and its
 * spending are ordinary payments and expenses.
 */
export type DongMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  name: string;
  is_me: boolean;
  is_fund: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DongExpenseRow = {
  id: string;
  group_id: string;
  user_id: string;
  title: string;
  amount: number;
  paid_by_member_id: string;
  /**
   * Which of the viewer's own accounts this left. Only ever set when the
   * payer is the viewer, and it is what makes the purchase appear in the
   * personal ledger.
   */
  account_id: string | null;
  occurred_on: string;
  tag: string | null;
  note: string | null;
  split_mode: DongSplitMode;
  created_at: string;
  updated_at: string;
};

/** What one member consumed of one expense. The set always covers the bill. */
export type DongExpenseShareRow = {
  id: string;
  expense_id: string;
  member_id: string;
  user_id: string;
  units: number;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type DongPaymentRow = {
  id: string;
  group_id: string;
  user_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  kind: DongPaymentKind;
  /** The viewer's own side of it, when one of the two ends is them. */
  account_id: string | null;
  occurred_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** One row of dong_balances(). Positive net is owed money. */
export type DongBalanceRow = {
  member_id: string;
  paid: number;
  share: number;
  sent: number;
  received: number;
  net: number;
};

/** One row of dong_my_balances(): the viewer's own net in one group. */
export type DongMyBalanceRow = {
  group_id: string;
  net: number;
};

/** One row of dong_group_totals(), for the groups list. */
export type DongGroupTotalRow = {
  group_id: string;
  member_count: number;
  expense_count: number;
  payment_count: number;
  total_spent: number;
  last_activity_on: string | null;
};

// ------------------------------------------------------------------ admin ---
// Migration 0027. The panel reads counts and metadata and never a ledger row,
// so nothing below carries an amount belonging to a user — the only money here
// is `cost_cents`, which is what the app paid OpenRouter.

/** What an admin did. Insert-only: there is no update or delete policy. */
export type AdminAuditLogRow = {
  id: string;
  /** Null once the admin's own account is deleted; `actor_email` outlives it. */
  actor_id: string | null;
  actor_email: string | null;
  /** `user.delete`, `guests.purge`, `category.save`, `settings.save`, … */
  action: string;
  target_type: string | null;
  /** Sometimes a uuid, sometimes a category slug — so text. */
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

/** One run of a scheduled job. Written with the service role, like usage logs. */
export type CronRunRow = {
  id: string;
  job: string;
  triggered_by: "cron" | "admin";
  started_at: string;
  /** Null while running, and also when a run died part-way through. */
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};

/**
 * One runtime knob. `value` is jsonb of whatever shape that key's schema in
 * lib/settings.ts says, which is why it is unknown here rather than a union:
 * the parsing happens once, there.
 */
export type AppSettingRow = {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

/** The single row of admin_overview(). */
export type AdminOverviewRow = {
  users_total: number;
  users_guests: number;
  users_registered: number;
  users_onboarded: number;
  users_new_7d: number;
  users_active_7d: number;
  transactions_total: number;
  transactions_7d: number;
  dong_groups_total: number;
  dong_groups_open: number;
  ai_calls_today: number;
  ai_calls_7d: number;
  ai_calls_30d: number;
  /** Under-reports: logUsage rounds to whole cents and stores 0 as null. */
  ai_cost_cents_30d: number;
  ai_failures_7d: number;
  ai_rate_limited_7d: number;
  imports_open: number;
  imports_failed_7d: number;
  media_count: number;
  media_bytes: number;
  guests_stale: number;
  last_purge_at: string | null;
  last_purge_result: Record<string, unknown> | null;
};

export type AdminSignupDayRow = {
  day: string;
  guests: number;
  registered: number;
};

/** One row of admin_users(). `total_count` is the same on every row. */
export type AdminUserRow = {
  id: string;
  /** Null for a guest: an anonymous user's email is '', which is not an address. */
  email: string | null;
  full_name: string | null;
  /** «guest» for anonymous, otherwise the auth provider. */
  provider: string;
  is_anonymous: boolean;
  is_admin: boolean;
  onboarded: boolean;
  onboarding_step: number;
  country_code: string | null;
  base_currency: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  ai_calls_30d: number;
  total_count: number;
};

/** The single row of admin_user_detail(). Counts and dates; never an amount. */
export type AdminUserDetailRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  provider: string;
  is_anonymous: boolean;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  country_code: string | null;
  timezone: string | null;
  base_currency: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  default_workspace: WorkspaceId | null;
  theme: string | null;
  transactions_count: number;
  accounts_count: number;
  goals_count: number;
  dong_groups_count: number;
  imports_count: number;
  media_count: number;
  media_bytes: number;
  ai_calls_30d: number;
  ai_cost_cents_30d: number;
  /** «Are they still using it», answered without naming a sum. */
  last_transaction_on: string | null;
};

/** One (day, feature, status, model) bucket. The page folds these itself. */
export type AdminAiDayRow = {
  day: string;
  feature: string;
  status: string;
  model: string;
  calls: number;
  cost_cents: number;
  input_tokens: number;
  output_tokens: number;
};

/** Percentiles over completed calls only — a timeout measures the budget. */
export type AdminAiLatencyRow = {
  feature: string;
  p50: number | null;
  p95: number | null;
  calls: number;
};

export type AdminAiTopUserRow = {
  user_id: string;
  email: string | null;
  is_anonymous: boolean;
  calls: number;
  cost_cents: number;
  /** Refused before spending: over the ceiling, or the model switched off. */
  rejected: number;
  failed: number;
};

/** Import metadata. No `closing_balance`: that one figure is the user's money. */
export type AdminImportRow = {
  id: string;
  user_id: string;
  email: string | null;
  is_anonymous: boolean;
  status: StatementImportStatus;
  source_currency: string;
  target_currency: string;
  period_from: string | null;
  period_to: string | null;
  file_count: number;
  line_count: number;
  matched_count: number;
  new_count: number;
  imported_count: number;
  error_message: string | null;
  /** Open, and untouched for over an hour — the state nothing else reports. */
  is_stuck: boolean;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  total_count: number;
};

export type AdminGuestRow = {
  id: string;
  created_at: string;
  last_sign_in_at: string | null;
  /** Idle, not age: a guest who keeps coming back is still using the app. */
  idle_days: number;
  is_stale: boolean;
  transactions_count: number;
  media_count: number;
  total_count: number;
};

/** Across every user, which is why the function needs definer rights. */
export type AdminCategoryUsageRow = {
  category_id: string;
  transactions: number;
  statement_lines: number;
  recurring: number;
  budgets: number;
  baselines: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        "timezone" | "base_currency" | "onboarding_step" | "theme"
      >;
      categories: Table<CategoryRow, "is_system" | "sort_order" | "cost_kind">;
      accounts: Table<
        AccountRow,
        "opening_balance" | "is_default" | "is_active" | "sort_order"
      >;
      income_sources: Table<IncomeSourceRow, "is_active">;
      recurring_expenses: Table<RecurringExpenseRow, "is_active" | "auto_post">;
      media_assets: Table<MediaAssetRow, "status">;
      transactions: Table<TransactionRow, "is_confirmed" | "needs_review">;
      goals: Table<GoalRow, "opening_saved" | "priority" | "status">;
      variable_expense_baselines: Table<VariableExpenseBaselineRow>;
      ai_usage_logs: Table<AiUsageLogRow>;
      statement_imports: Table<
        StatementImportRow,
        | "status"
        | "file_count"
        | "line_count"
        | "matched_count"
        | "new_count"
        | "imported_count"
        | "balance_applied"
      >;
      statement_lines: Table<StatementLineRow, "needs_review" | "match_status">;
      recurring_skipped_months: Table<RecurringSkippedMonthRow>;
      dong_groups: Table<DongGroupRow>;
      dong_members: Table<DongMemberRow, "is_me" | "is_fund" | "sort_order">;
      dong_expenses: Table<DongExpenseRow, "split_mode">;
      dong_expense_shares: Table<DongExpenseShareRow, "units">;
      dong_payments: Table<DongPaymentRow, "kind">;
      category_budgets: Table<CategoryBudgetRow>;
      insight_dismissals: Table<InsightDismissalRow, "dismissed_at">;
      envelope_preferences: Table<EnvelopePreferenceRow, "updated_at">;
      admin_audit_log: Table<AdminAuditLogRow>;
      /** Select-only through the API; the service role writes it. */
      cron_runs: Table<CronRunRow, "triggered_by" | "started_at">;
      app_settings: Table<AppSettingRow, "updated_at">;
    };
    Views: Record<never, never>;
    Functions: {
      post_recurring_for_month: {
        /** `p_only` aims it at one bill, for confirming a single missed month. */
        Args: { p_month: string; p_only?: string | null };
        Returns: number;
      };
      missed_recurring_months: {
        Args: { p_before: string };
        Returns: MissedRecurringRow[];
      };
      account_balances: {
        Args: Record<never, never>;
        Returns: AccountBalanceRow[];
      };
      goal_progress: {
        Args: Record<never, never>;
        Returns: GoalProgressRow[];
      };
      /** Both bounds inclusive, and both are the user's month, never UTC's. */
      envelope_status: {
        Args: { p_month_start: string; p_month_end: string };
        Returns: EnvelopeStatusRow[];
      };
      dong_balances: {
        Args: { p_group_id: string };
        Returns: DongBalanceRow[];
      };
      dong_group_totals: {
        Args: Record<never, never>;
        Returns: DongGroupTotalRow[];
      };
      dong_my_balances: {
        Args: Record<never, never>;
        Returns: DongMyBalanceRow[];
      };
      /**
       * Guests whose last sign-in is older than `max_age`. Reporting only — the
       * deleting is done by the app, because an upload can only be removed
       * through the Storage API. Service role only.
       */
      stale_guest_ids: {
        Args: { max_age?: string };
        Returns: string[];
      };
      /** Writes an expense and its shares in one transaction. Returns the id. */
      dong_save_expense: {
        Args: {
          p_group_id: string;
          p_title: string;
          p_amount: number;
          p_paid_by: string;
          p_occurred_on: string;
          p_split_mode: DongSplitMode;
          p_shares: { member_id: string; units: number; amount: number }[];
          p_tag?: string | null;
          p_note?: string | null;
          p_id?: string | null;
          /** The viewer's account, when the viewer is the one who paid. */
          p_account_id?: string | null;
        };
        Returns: string;
      };

      // ------------------------------------------------------------ admin ---
      // Every one of these asserts admin first and raises 42501 otherwise, so
      // being callable by `authenticated` is not being readable by it. See
      // migration 0027.

      /** True when the caller's *token* carries the claim — see adminJwtIsFresh. */
      is_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      admin_overview: {
        Args: { p_tz?: string; p_retention_days?: number };
        Returns: AdminOverviewRow[];
      };
      admin_signups_daily: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: AdminSignupDayRow[];
      };
      admin_users: {
        Args: {
          p_q?: string | null;
          /** all · guest · registered · onboarded · pending */
          p_kind?: string;
          p_provider?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: AdminUserRow[];
      };
      admin_user_detail: {
        Args: { p_id: string };
        Returns: AdminUserDetailRow[];
      };
      admin_ai_usage_daily: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: AdminAiDayRow[];
      };
      admin_ai_latency: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: AdminAiLatencyRow[];
      };
      admin_ai_top_users: {
        Args: { p_from: string; p_to: string; p_tz?: string; p_limit?: number };
        Returns: AdminAiTopUserRow[];
      };
      admin_imports: {
        Args: {
          /** all · open · stuck · failed · applied · discarded */
          p_status?: string;
          p_user_id?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: AdminImportRow[];
      };
      admin_guests: {
        Args: { p_retention_days?: number; p_limit?: number };
        Returns: AdminGuestRow[];
      };
      admin_category_usage: {
        Args: Record<never, never>;
        Returns: AdminCategoryUsageRow[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
