-- What a student is looking for, saved once on their profile so enquiries can start pre-filled.
-- All three are optional and additive: nothing existing changes.
alter table public.profiles
  add column budget_aed int check (budget_aed between 1 and 100000),
  -- Always the first of a month, like an enquiry's move-in month.
  add column move_in_month date check (move_in_month = date_trunc('month', move_in_month)::date),
  add column housemate_pref text check (housemate_pref in ('any', 'female_only', 'male_only'));

-- Profile updates are limited to editable columns (see 20261106100000_lock_down_profile_columns.sql).
grant update (budget_aed, move_in_month, housemate_pref) on public.profiles to authenticated;
