-- delete_own_account (20261106170000) recomputed each conversation's
-- last_message only for conversations the user was STILL in, but it had
-- already removed them from every group, so a group's inbox preview kept the
-- deleted user's last message text. Remember which conversations were
-- affected up front and recompute those.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  affected uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  affected := array(select id from conversations where uid = any(participant_ids) or initiator_id = uid);

  delete from messages where sender_id = uid;

  update conversations
    set participant_ids = array_remove(participant_ids, uid),
        initiator_id = case when initiator_id = uid then null else initiator_id end
    where is_group and uid = any(participant_ids);
  delete from conversations where is_group and coalesce(array_length(participant_ids, 1), 0) < 2;

  update conversations c set
    last_message = (select m.body from messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    last_message_at = (select m.created_at from messages m where m.conversation_id = c.id order by m.created_at desc limit 1)
  where c.id = any(affected);

  delete from conversations c
    where not c.is_group and c.id = any(affected)
      and not exists (select 1 from messages m where m.conversation_id = c.id);

  delete from auth.users where id = uid;
end;
$$;
grant execute on function public.delete_own_account() to authenticated;
