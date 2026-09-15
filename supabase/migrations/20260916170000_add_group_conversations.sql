-- Group chats, alongside the existing 1:1 conversations (which keep working
-- exactly as before — everything here is additive). A group has no
-- request/accept step the way an unsolicited 1:1 DM does (you're just
-- added, like joining a group chat anywhere else), so it's created
-- directly at status='accepted' and stays there for its whole lifetime in
-- this first version — no leave/kick/rename yet.
alter table conversations add column is_group boolean not null default false;
alter table conversations add column name text;
alter table conversations add constraint conversations_group_status_check check (not is_group or status = 'accepted');

-- Additive, not a replacement for "Users can create conversations they're
-- part of": that policy's is_blocked_between(participant_ids[1],
-- participant_ids[2]) check only makes sense for a 2-person DM and would
-- misfire against arbitrary array positions in a group, so groups get their
-- own policy instead of trying to make one expression cover both shapes.
-- Blocking isn't enforced for groups at all here — same as most chat apps,
-- being blocked by someone doesn't remove you from a group you're both in,
-- it only affects 1:1 DMs and post/comment visibility.
create policy "Users can create groups they're part of" on conversations for insert with check (
  is_group and auth.uid() = any(participant_ids) and auth.uid() = initiator_id and status = 'accepted'
  and array_length(participant_ids, 1) >= 3
);

-- Also additive. The existing "Participants can update conversation status"
-- policy has a with-check of (status = 'pending' or auth.uid() <>
-- initiator_id) — for a group, status is permanently 'accepted' and the
-- creator (who IS the initiator) needs to update last_message/
-- last_message_at when they send, which that expression would otherwise
-- block. Scoping a second policy to is_group sidesteps that without
-- touching the 1:1 policy at all.
create policy "Group participants can update conversation" on conversations for update
  using (is_group and auth.uid() = any(participant_ids))
  with check (is_group and auth.uid() = any(participant_ids) and status = 'accepted');

-- Same reasoning as the conversations insert policy above — the existing
-- messages insert policy's is_blocked_between check only makes sense for
-- 2-person participant_ids, so groups get their own additive policy.
create policy "Group participants can send messages" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = messages.conversation_id and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
