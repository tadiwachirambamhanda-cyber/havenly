-- Message requests: a new conversation starts 'pending' and the recipient
-- must accept before a real back-and-forth chat opens. The initiator can
-- send their opening message(s) while pending (that's the "request"
-- content the recipient previews); the recipient cannot send anything
-- until they accept — enforced below at the RLS level, not just in the UI.
alter table conversations add column status text not null default 'pending' check (status in ('pending', 'accepted', 'declined'));
alter table conversations add column initiator_id uuid references profiles(id);

drop policy if exists "Users can create conversations they're part of" on conversations;
create policy "Users can create conversations they're part of" on conversations for insert with check (
  auth.uid() = any(participant_ids) and auth.uid() = initiator_id
);

create policy "Participants can update conversation status" on conversations for update using (auth.uid() = any(participant_ids));

drop policy if exists "Users can send messages in their conversations" on messages;
create policy "Users can send messages in their conversations" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = messages.conversation_id
      and auth.uid() = any(c.participant_ids)
      and (c.status = 'accepted' or (c.status = 'pending' and c.initiator_id = auth.uid()))
  )
);
