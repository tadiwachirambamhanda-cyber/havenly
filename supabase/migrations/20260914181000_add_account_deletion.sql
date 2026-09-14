-- Lets a signed-in user permanently delete their own account from Settings.

-- conversations.initiator_id had no "on delete" behavior, so deleting a
-- user who had ever started a conversation would fail outright with a
-- foreign key violation (found while testing this migration). The
-- conversation and the other participant's messages should survive account
-- deletion — only initiator_id itself needs to go null, same pattern as
-- posts.community_id on delete set null when a community disappears.
alter table conversations drop constraint conversations_initiator_id_fkey;
alter table conversations add constraint conversations_initiator_id_fkey
  foreign key (initiator_id) references profiles(id) on delete set null;

-- Runs as the table owner (security definer) because deleting from
-- auth.users needs privileges the authenticated role doesn't have — same
-- reason handle_new_user() needs it, just in reverse. Deleting the
-- auth.users row cascades to profiles and, from there, to every table that
-- references profiles(id) on delete cascade (posts, comments, likes, saved
-- posts, follows, blocks, community memberships, messages, read state).
-- Storage files (avatar, post images/videos) aren't touched by cascade —
-- the client removes those first, while its session can still write to
-- storage, before calling this.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
