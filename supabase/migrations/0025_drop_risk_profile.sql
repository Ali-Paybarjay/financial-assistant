-- The risk questions are gone, and their two columns with them.
--
-- Five screens of «your portfolio drops 20%, what do you do» produced a score
-- of 1–10 and a label of conservative/balanced/growth. Nothing ever read
-- either one. The label was printed in the sidebar's subtitle, on a settings
-- row and on the onboarding summary, and that was the whole of its life: no
-- budget, no goal plan, no insight and no prompt was different because of it.
--
-- Keeping unread columns is not free — they are asked for in a form, carried
-- through a schema, selected in a layout and typed in three files — so they go
-- with the flow that filled them. If a risk profile is wanted again it should
-- arrive with the thing that uses it.

alter table public.profiles
  drop column if exists risk_score,
  drop column if exists risk_label;

-- Onboarding is six steps now: the risk step was step 6, and what was step 7
-- (the three figures about where someone stands today) took its number.
--
-- Anyone already carrying a 7 finished the old flow, so 6 is where they are in
-- the new one. The clamp runs before the constraint, or the constraint is
-- refused by the rows it is meant to describe.
alter table public.profiles
  drop constraint if exists profiles_onboarding_step_check;

update public.profiles
   set onboarding_step = 6
 where onboarding_step > 6;

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step >= 0 and onboarding_step <= 6);
