-- SECURITY: the 1:1 conversation insert policy did not check `status` or
-- `is_group`, so a client could insert a conversation already 'accepted'
-- (skipping the message-request step) or re-create one after the recipient
-- declined. Its block check also only looked at participant_ids[1] and [2]
-- without validating the array, so [A, A, B] slipped past a block between
-- A and B.
--
-- A 1:1 conversation must now: be non-group, start 'pending', have exactly
-- two distinct real participants including the initiator, not involve a
-- block, and not already exist between the same two people (so a declined
-- request can't be restarted).
drop policy "Users can create conversations they're part of" on public.conversations;
create policy "Users can create conversations they're part of" on public.conversations for insert with check (
  not is_group
  and status = 'pending'
  and auth.uid() = initiator_id
  and array_length(participant_ids, 1) = 2
  and auth.uid() = any(participant_ids)
  and participant_ids[1] <> participant_ids[2]
  and (select count(*) from public.profiles p where p.id = any(participant_ids)) = 2
  and not public.is_blocked_between(participant_ids[1], participant_ids[2])
  and not exists (
    select 1 from public.conversations c
    where not c.is_group and c.participant_ids @> participant_ids and c.participant_ids <@ participant_ids
  )
);
