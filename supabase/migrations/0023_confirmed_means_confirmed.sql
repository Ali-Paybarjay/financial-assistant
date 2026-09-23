-- ------------------------------------------- confirmed means confirmed --

-- Rows recorded through the confirm card before the flag was fixed.
--
-- `is_confirmed` used to be written as «was the model sure about every
-- field», which is a different question from «did the person approve this».
-- Every row with source 'text' or 'receipt' passed through the confirm card:
-- the card renders each guessed field under a dashed rule, tells the user to
-- tap any of them to change it, and only writes when they press «ثبت
-- تراکنش». There is no path that stores one of these without that.
--
-- So these rows were approved, were stored as though they were not, and have
-- been telling their owner ever since that the app is «مطمئن نیستم» about
-- figures they confirmed themselves. Fixing the code without this leaves the
-- complaint intact for every row already recorded.
--
-- Deliberately not touched:
--
--   source = 'statement' — ticking forty lines off a bank file is not the
--     same act as reading one card, and those rows are meant to stay marked.
--   source = 'recurring' — generated from a standing bill, and confirmed by
--     the user in the missed-bill review when it needs to be.
--
-- This clears `needs_review` along with the flag, matching what
-- `confirmTransaction` has always written when a user accepts a row. Which
-- fields the model originally guessed is not recoverable afterwards; it was
-- not a durable fact once the user had approved them, and `ai_confidence`
-- and `source` still record that the row came from a model at all.
update public.transactions
set is_confirmed = true,
    needs_review = '{}'
where source in ('text', 'receipt')
  and is_confirmed = false;
