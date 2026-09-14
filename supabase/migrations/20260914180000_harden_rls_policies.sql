-- Hardens a few RLS policies that only checked row ownership, not which
-- columns were being changed — letting a user tamper with fields no app
-- screen ever legitimately touches. Found during a full security pass.

-- ==================== POSTS ====================
-- No screen in the app ever calls posts.update() — likes go through
-- toggle_post_like() and comment_count through a trigger, both security
-- definer. Without dropping this, a user could set like_count,
-- comment_count, or is_editorial to anything on their own posts, since a
-- plain "using (auth.uid() = author_id)" with no with check doesn't
-- restrict which columns change.
drop policy "Users can update their own posts" on posts;

-- Editorial posts are only ever inserted directly in the database (see
-- 20260912160509_seed_editorial_posts.sql), never through the app, so it's
-- safe to require is_editorial = false on any client-submitted post —
-- closing the self-publish-as-editorial gap the original comment here
-- flagged as a TODO but never enforced.
drop policy "Users can create their own posts" on posts;
create policy "Users can create their own posts" on posts for insert with check (
  auth.uid() = author_id
  and is_editorial = false
  and (
    community_id is null
    or exists (select 1 from community_members where community_id = posts.community_id and user_id = auth.uid())
  )
);

-- ==================== CONVERSATIONS ====================
-- ChatScreen only ever updates status, last_message and last_message_at —
-- never participant_ids or initiator_id. Column-level grants make that the
-- actually enforced boundary; without this, either participant could add an
-- uninvited third person into participant_ids and hand them live read
-- access to the whole message history via the existing select policy.
revoke update on conversations from authenticated;
grant update (status, last_message, last_message_at) on conversations to authenticated;

-- Also stops the initiator from self-accepting/declining their own pending
-- request — only the other participant (the recipient) should be able to
-- move status off 'pending', matching what the UI already only shows them
-- (ChatScreen's showAcceptDecline = isPending && !isInitiator).
drop policy "Participants can update conversation status" on conversations;
create policy "Participants can update conversation status" on conversations for update
  using (auth.uid() = any(participant_ids))
  with check (
    auth.uid() = any(participant_ids)
    and (status = 'pending' or auth.uid() <> initiator_id)
  );

-- ==================== FOLLOWS ====================
-- blockUser() tries to delete the follow relationship in both directions,
-- but "Users can unfollow" only allows auth.uid() = follower_id — so the
-- direction where the *other* person follows *you* silently fails to
-- delete (0 rows affected, no error). security definer lets a block cleanly
-- remove both sides in one call, same pattern as is_blocked_between.
create or replace function public.unfollow_both_directions(user_a uuid, user_b uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is distinct from user_a and auth.uid() is distinct from user_b then
    raise exception 'Not authorized';
  end if;
  delete from follows
  where (follower_id = user_a and following_id = user_b)
     or (follower_id = user_b and following_id = user_a);
end;
$$;

grant execute on function public.unfollow_both_directions(uuid, uuid) to authenticated;
