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
  | "statement";
export type TransactionType = "expense" | "income";
export type CategoryKind = "expense" | "income";
/** A receipt photo, or a statement file (PDF, CSV, or a photographed page). */
export type MediaKind = "image" | "document";
export type MediaStatus = "uploaded" | "processing" | "parsed" | "failed";
export type GoalStatus = "active" | "achieved" | "paused" | "cancelled";
export type RiskLabel = "conservative" | "balanced" | "growth";
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

export type ProfileRow = {
  id: string;
  full_name: string | null;
  country_code: string | null;
  timezone: string;
  base_currency: string;
  birth_year: number | null;
  employment_status: string | null;
  risk_score: number | null;
  risk_label: RiskLabel | null;
  monthly_income_estimate: number | null;
  has_debt: boolean | null;
  debt_amount: number | null;
  emergency_fund_months: number | null;
  savings_rate_estimate: number | null;
  onboarding_step: number;
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
  merchant: string | null;
  note: string | null;
  occurred_on: string;
  source: TransactionSource;
  media_asset_id: string | null;
  recurring_expense_id: string | null;
  posted_month: string | null;
  statement_line_id: string | null;
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
  saved_amount: number;
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

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "timezone" | "base_currency" | "onboarding_step">;
      categories: Table<CategoryRow, "is_system" | "sort_order">;
      accounts: Table<
        AccountRow,
        "opening_balance" | "is_default" | "is_active" | "sort_order"
      >;
      income_sources: Table<IncomeSourceRow, "is_active">;
      recurring_expenses: Table<RecurringExpenseRow, "is_active" | "auto_post">;
      media_assets: Table<MediaAssetRow, "status">;
      transactions: Table<TransactionRow, "is_confirmed" | "needs_review">;
      goals: Table<GoalRow, "saved_amount" | "priority" | "status">;
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
      >;
      statement_lines: Table<StatementLineRow, "needs_review" | "match_status">;
    };
    Views: Record<never, never>;
    Functions: {
      post_recurring_for_month: {
        Args: { p_month: string };
        Returns: number;
      };
      account_balances: {
        Args: Record<never, never>;
        Returns: AccountBalanceRow[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
