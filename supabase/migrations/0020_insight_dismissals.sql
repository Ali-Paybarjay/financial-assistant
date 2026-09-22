-- ----------------------------------------------------- insight dismissals --

-- What the user has waved away, and nothing else.
--
-- The insight itself is never stored. It is derived on every request from the
-- ledger it describes, because a stored sentence and a transaction edited the
-- next morning come apart — and what the user is then shown is a confident
-- claim about a number that no longer exists. Deriving it costs one query
-- against figures the page has already read.
--
-- So the only durable fact here is «I have seen this and I do not want it
-- again», keyed by «rule:scope» — the scope being the month, the week, or the
-- category the rule repeats over, so dismissing this week's comparison does
-- not silence next week's. See lib/insights.ts, which owns those keys.
create table public.insight_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  insight_key  text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, insight_key)
);

alter table public.insight_dismissals enable row level security;

create policy insight_dismissals_all on public.insight_dismissals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The primary key already leads with user_id, so the read the stream does on
-- every load — «every key this user has dismissed» — is served by it. No
-- second index.
