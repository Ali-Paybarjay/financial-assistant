-- Iran joins the supported countries, and with it the two units its money is
-- actually quoted in: the toman for everyday amounts and the rial for prices
-- printed on official paper.
--
-- "IRT" is not an ISO 4217 code — none exists for the toman — but the column
-- has never been an ISO list, only the set this app can format. The rial keeps
-- its real code. Neither has a fractional unit anyone uses, which is why
-- lib/money gives both a minor exponent of 0: one minor unit is one toman.
--
-- Amounts already recorded are untouched. Changing the base currency has never
-- converted anything, and this migration changes nobody's base currency.
alter table public.profiles
  drop constraint if exists profiles_base_currency_check;

alter table public.profiles
  add constraint profiles_base_currency_check
  check (base_currency in ('CAD','USD','EUR','GBP','AUD','IRT','IRR'));
