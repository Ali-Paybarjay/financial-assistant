-- System categories. user_id is null and is_system is true, so they are
-- readable by everyone and writable by no one through the client.
-- Icon names are Phosphor glyphs, per the design handoff.
--
-- cost_kind says whether a ceiling is a meaningful thing to ask for. «fixed»
-- is a committed amount on a committed date — rent, bills, instalments — and
-- carries no ceiling ever; see migration 0026.

insert into public.categories (user_id, name_fa, slug, kind, icon, is_system, sort_order, cost_kind)
values
  (null, 'خوراک و سوپرمارکت', 'groceries',     'expense', 'shopping-cart',       true,  1, 'variable'),
  (null, 'رستوران و کافه',    'dining',        'expense', 'fork-knife',          true,  2, 'variable'),
  (null, 'مسکن و اجاره',      'housing',       'expense', 'house-line',          true,  3, 'fixed'),
  (null, 'قبوض',              'utilities',     'expense', 'lightning',           true,  4, 'fixed'),
  (null, 'حمل‌ونقل',           'transport',     'expense', 'bus',                 true,  5, 'variable'),
  (null, 'خودرو و سوخت',      'car',           'expense', 'car',                 true,  6, 'variable'),
  (null, 'سلامت و درمان',     'health',        'expense', 'heartbeat',           true,  7, 'variable'),
  (null, 'پوشاک',             'clothing',      'expense', 't-shirt',             true,  8, 'variable'),
  (null, 'سرگرمی',            'entertainment', 'expense', 'ticket',              true,  9, 'variable'),
  (null, 'اشتراک‌ها',          'subscriptions', 'expense', 'repeat',              true, 10, 'fixed'),
  (null, 'آموزش',             'education',     'expense', 'graduation-cap',      true, 11, 'variable'),
  (null, 'هدیه',              'gifts',         'expense', 'gift',                true, 12, 'variable'),
  (null, 'بیمه',              'insurance',     'expense', 'shield-check',        true, 13, 'fixed'),
  (null, 'بازپرداخت وام',     'loan-repay',    'expense', 'hand-coins',          true, 14, 'fixed'),
  (null, 'متفرقه',            'misc',          'expense', 'dots-three-circle',   true, 15, 'variable'),
  -- Income side: transactions of type 'income' need somewhere to land too.
  -- cost_kind is meaningless here and left at its default; nothing reads it
  -- for an income category.
  (null, 'حقوق',              'salary',        'income',  'wallet',              true, 16, 'variable'),
  (null, 'درآمد آزاد',        'freelance',     'income',  'briefcase',           true, 17, 'variable'),
  (null, 'سایر درآمد',        'other-income',  'income',  'coins',               true, 18, 'variable'),
  -- The two «دنگ و دونگ» writes into the personal ledger, by trigger — see
  -- migration 0017. Kept out of what the AI is offered (lib/ai/prompts.ts):
  -- the model cannot know whether a receipt was a shared bill.
  (null, 'دنگ و دونگ',        'dong',          'expense', 'users-three',         true, 19, 'variable'),
  (null, 'برگشتی دنگ و دونگ', 'dong-refund',   'income',  'users-three',         true, 20, 'variable')
on conflict do nothing;
