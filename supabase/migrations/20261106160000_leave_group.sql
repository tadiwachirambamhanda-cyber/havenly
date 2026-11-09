-- Groups had no way out: once someone was added they were in for good, and
-- participant_ids can't be edited by clients (only by security definer
-- functions). leave_group() lets a member remove themselves.
--  * Their earlier messages stay in the chat (it's the group's history).
--  * They lose access immediately: read access to a group's messages comes
--    from being in participant_ids.
--  * Their read/hidden markers are cleared.
--  * If fewer than two people remain, the group is deleted (with its
--    messages) since it is no longer a conversation.
create or replace function public.leave_group(conversation_id_input uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  convo conversations%rowtype;
  remaining uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into convo from conversations where id = conversation_id_input;
  if convo.id is null or not convo.is_group or not (uid = any(convo.participant_ids)) then
    raise exception 'You''re not in this group.';
  end if;

  remaining := array_remove(convo.participant_ids, uid);
  delete from conversation_reads where conversation_id = convo.id and user_id = uid;
  delete from conversation_hidden_for where conversation_id = convo.id and user_id = uid;

  if coalesce(array_length(remaining, 1), 0) < 2 then
    delete from conversations where id = convo.id;
  else
    update conversations set
      participant_ids = remaining,
      initiator_id = case when initiator_id = uid then null else initiator_id end
    where id = convo.id;
  end if;
end;
$$;
grant execute on function public.leave_group(uuid) to authenticated;
