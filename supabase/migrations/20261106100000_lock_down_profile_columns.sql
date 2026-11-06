-- SECURITY: the "Users can update their own profile" policy is row-level
-- only (auth.uid() = id), so a signed-in user could update ANY column of
-- their own row, including is_admin (making themselves an admin, which
-- unlocks housing enquiries, partner terms and referral fees) and the
-- streak columns (bypassing streak-gated perks).
--
-- Fix with column-level grants, the same pattern conversations uses:
-- clients may update only the profile fields the app actually edits.
-- is_admin, current_streak, longest_streak, last_active_date, created_at
-- and id become writable only by security definer functions (bump_streak,
-- delete_my_account) and by the owner/service role.
revoke update on public.profiles from authenticated, anon;
grant update (
  username, display_name, bio, avatar_url, cover_url, university,
  interests, has_completed_onboarding
) on public.profiles to authenticated;

-- Profiles are created only by the handle_new_user trigger (security
-- definer). Direct client inserts were never used, and the insert policy
-- would have let a client choose is_admin on a row it created.
revoke insert on public.profiles from authenticated, anon;
