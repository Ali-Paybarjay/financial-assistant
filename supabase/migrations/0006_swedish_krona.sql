-- Sweden was mapped to the euro, which it does not use. Its currency is the
-- krona, and no country in the list was carrying it, so the code had to be
-- added before the country could be corrected.
--
-- The whole set is restated because a CHECK cannot be amended in place; this
-- list is the one lib/money.ts declares.
alter table public.profiles
  drop constraint if exists profiles_base_currency_check;

alter table public.profiles
  add constraint profiles_base_currency_check
  check (base_currency in ('CAD','USD','EUR','GBP','AUD','SEK','IRT','IRR'));

-- No existing profile is rewritten, and deliberately so. Nobody holds
-- country_code = 'SE' yet, but had anyone signed up under the old mapping,
-- flipping their currency to SEK without converting would multiply every
-- amount they can see by about eleven — and converting would be worse, since
-- there is no way to know whether they typed krona or euro into a field
-- labelled "€". Settings already warns before a currency change; that is the
-- right place for a human to make this call.
