-- System categories. user_id is null and is_system is true, so they are
-- readable by everyone and writable by no one through the client.
-- Icon names are Phosphor glyphs, per the design handoff.

insert into public.categories (user_id, name_fa, slug, kind, icon, is_system, sort_order)
values
  (null, 'خوراک و سوپرمارکت', 'groceries',     'expense', 'shopping-cart',       true,  1),
  (null, 'رستوران و کافه',    'dining',        'expense', 'fork-knife',          true,  2),
  (null, 'مسکن و اجاره',      'housing',       'expense', 'house-line',          true,  3),
  (null, 'قبوض',              'utilities',     'expense', 'lightning',           true,  4),
  (null, 'حمل‌ونقل',           'transport',     'expense', 'bus',                 true,  5),
  (null, 'خودرو و سوخت',      'car',           'expense', 'car',                 true,  6),
  (null, 'سلامت و درمان',     'health',        'expense', 'heartbeat',           true,  7),
  (null, 'پوشاک',             'clothing',      'expense', 't-shirt',             true,  8),
  (null, 'سرگرمی',            'entertainment', 'expense', 'ticket',              true,  9),
  (null, 'اشتراک‌ها',          'subscriptions', 'expense', 'repeat',              true, 10),
  (null, 'آموزش',             'education',     'expense', 'graduation-cap',      true, 11),
  (null, 'هدیه',              'gifts',         'expense', 'gift',                true, 12),
  (null, 'بیمه',              'insurance',     'expense', 'shield-check',        true, 13),
  (null, 'بازپرداخت وام',     'loan-repay',    'expense', 'hand-coins',          true, 14),
  (null, 'متفرقه',            'misc',          'expense', 'dots-three-circle',   true, 15),
  -- Income side: transactions of type 'income' need somewhere to land too.
  (null, 'حقوق',              'salary',        'income',  'wallet',              true, 16),
  (null, 'درآمد آزاد',        'freelance',     'income',  'briefcase',           true, 17),
  (null, 'سایر درآمد',        'other-income',  'income',  'coins',               true, 18),
  -- The two «دنگ و دونگ» writes into the personal ledger, by trigger — see
  -- migration 0017. Kept out of what the AI is offered (lib/ai/prompts.ts):
  -- the model cannot know whether a receipt was a shared bill.
  (null, 'دنگ و دونگ',        'dong',          'expense', 'users-three',         true, 19),
  (null, 'برگشتی دنگ و دونگ', 'dong-refund',   'income',  'users-three',         true, 20)
on conflict do nothing;
