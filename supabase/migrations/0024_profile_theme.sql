-- ------------------------------------------------------------------ theme --

-- Which theme the user chose, so a second device agrees with the first.
--
-- This is the *durable* copy and not the one the stylesheet reads. The page
-- is painted from a cookie, because `<html data-theme>` has to be right
-- before any query runs — a theme that arrives one round trip late is a white
-- flash on a dark phone at night. The cookie is the fast path; this column is
-- what refills it when the user signs in somewhere else.
--
-- 'system' rather than 'light' as the default: the honest first answer is the
-- one the device already gives, and someone whose phone is dark at midnight
-- has effectively already told us.
--
-- The rest of migration 00xx_envelopes_and_theme.sql in the v3 package is
-- category_budgets, envelope_status() and insight_dismissals, which shipped
-- in 0019 and 0020 — with a soft-delete filter, an empty search_path and the
-- board's own preferences, none of which the package's copy has. Only this
-- column was new.
alter table public.profiles
  add column if not exists theme text not null default 'system'
  check (theme in ('light', 'dark', 'system'));
