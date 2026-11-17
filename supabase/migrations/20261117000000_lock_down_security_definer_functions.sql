-- REVIEW BEFORE APPLYING. Not applied to any database yet.
--
-- Why: the Supabase security scan found 28 SECURITY DEFINER functions in the
-- public schema that the signed-out role (anon) and every signed-in user can call
-- through /rest/v1/rpc. These functions run with the owner's rights, so they should
-- only be callable by the people who need them.
--
-- What this does:
--   1. Trigger-only functions: nobody needs to call them directly. Revoke from
--      PUBLIC, anon and authenticated. Triggers keep firing as before.
--   2. App functions (called with supabase.rpc from the app): revoke from PUBLIC
--      and anon. Signed-in users keep access. Each one already needs auth.uid().
--   3. Policy helpers (is_admin, can_add_to_group, can_see_checkin,
--      is_blocked_between) are used inside row-level security policies, so they are
--      NOT touched here. Check which policies use them before changing them.
--
-- How to check after applying: sign in on the app, load the feed, like a post, send
-- a message, claim an offer. Then run the Supabase security scan again.
--
-- To undo: GRANT EXECUTE ON FUNCTION <name>(<args>) TO anon, authenticated;

-- 1. Trigger-only functions
revoke execute on function public.anonymise_enquiries_on_profile_delete() from public, anon, authenticated;
revoke execute on function public.block_delete_residence_with_signed_deals() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_admins_on_enquiry() from public, anon, authenticated;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;
revoke execute on function public.notify_on_follow() from public, anon, authenticated;
revoke execute on function public.notify_on_like() from public, anon, authenticated;
revoke execute on function public.notify_student_on_enquiry_status() from public, anon, authenticated;
revoke execute on function public.remove_follow_notification() from public, anon, authenticated;
revoke execute on function public.remove_like_notification() from public, anon, authenticated;
revoke execute on function public.sync_community_member_count() from public, anon, authenticated;
revoke execute on function public.sync_post_comment_count() from public, anon, authenticated;
revoke execute on function public.sync_post_like_count() from public, anon, authenticated;

-- 2. App functions: signed-in users only
revoke execute on function public.bump_streak() from public, anon;
revoke execute on function public.claim_offer(uuid) from public, anon;
revoke execute on function public.delete_own_account() from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.send_ping(uuid) from public, anon;
revoke execute on function public.set_enquiry_status(uuid, text, numeric) from public, anon;
revoke execute on function public.set_referral_fee_paid(uuid, boolean) from public, anon;
revoke execute on function public.toggle_interest(text, uuid) from public, anon;
revoke execute on function public.toggle_post_like(uuid) from public, anon;
revoke execute on function public.unfollow_both_directions(uuid, uuid) from public, anon;

-- Keep authenticated access explicit (it may have come only through PUBLIC).
grant execute on function public.bump_streak() to authenticated;
grant execute on function public.claim_offer(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.send_ping(uuid) to authenticated;
grant execute on function public.set_enquiry_status(uuid, text, numeric) to authenticated;
grant execute on function public.set_referral_fee_paid(uuid, boolean) to authenticated;
grant execute on function public.toggle_interest(text, uuid) to authenticated;
grant execute on function public.toggle_post_like(uuid) to authenticated;
grant execute on function public.unfollow_both_directions(uuid, uuid) to authenticated;

-- 3. Future functions: stop new public functions being callable by default.
alter default privileges in schema public revoke execute on functions from public, anon;
