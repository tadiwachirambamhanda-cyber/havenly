-- Deleting an account cascade-deleted the user's messages but left traces
-- in other people's chats: conversations.last_message kept a copy of the
-- user's last message text (so the other person's inbox still showed it),
-- and the user stayed listed in every group's participant_ids. The privacy
-- policy says messages are deleted, so this finishes the job before the
-- account row is removed:
--  * the user's messages are deleted explicitly;
--  * they are removed from every group they were in (a group left with
--    fewer than two members is deleted);
--  * each remaining conversation's last_message / last_message_at is
--    recomputed from the messages that are left (empty if none);
--  * a 1:1 conversation with nothing left in it is deleted. A 1:1 that
--    still holds the other person's own messages is kept, as before.
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

  delete from messages where sender_id = uid;

  update conversations
    set participant_ids = array_remove(participant_ids, uid),
        initiator_id = case when initiator_id = uid then null else initiator_id end
    where is_group and uid = any(participant_ids);
  delete from conversations where is_group and coalesce(array_length(participant_ids, 1), 0) < 2;

  update conversations c set
    last_message = (select m.body from messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    last_message_at = (select m.created_at from messages m where m.conversation_id = c.id order by m.created_at desc limit 1)
  where uid = any(c.participant_ids) or c.initiator_id = uid;

  delete from conversations c
    where not c.is_group and uid = any(c.participant_ids)
      and not exists (select 1 from messages m where m.conversation_id = c.id);

  delete from auth.users where id = uid;
end;
$$;
grant execute on function public.delete_own_account() to authenticated;
