-- SECURITY: the group insert policy only needed 3+ ids with the creator
-- among them. It never checked that the other ids were real people, were
-- not blocked, or had any relationship with the creator. A user could drop
-- a stranger, or someone who had blocked them, into a group that was
-- 'accepted' immediately (groups have no request step), giving that person
-- live messages with no way to leave (there is no leave-group yet).
--
-- Rule now enforced by the database (not just the picker in the app): you
-- can only add someone to a new group if you follow each other and neither
-- of you has blocked the other. Mutual follow is the consent signal.
create or replace function public.can_add_to_group(adder uuid, member uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not public.is_blocked_between(adder, member)
    and exists (select 1 from follows where follower_id = adder and following_id = member)
    and exists (select 1 from follows where follower_id = member and following_id = adder);
$$;
grant execute on function public.can_add_to_group(uuid, uuid) to authenticated;

drop policy "Users can create groups they're part of" on public.conversations;
create policy "Users can create groups they're part of" on public.conversations for insert with check (
  is_group
  and auth.uid() = any(participant_ids)
  and auth.uid() = initiator_id
  and status = 'accepted'
  and array_length(participant_ids, 1) >= 3
  -- no duplicate ids, and every id is a real profile
  and (select count(distinct m) from unnest(participant_ids) m) = array_length(participant_ids, 1)
  and (select count(*) from public.profiles p where p.id = any(participant_ids)) = array_length(participant_ids, 1)
  -- everyone else must be a mutual follow of the creator and unblocked
  and not exists (
    select 1 from unnest(participant_ids) m
    where m <> auth.uid() and not public.can_add_to_group(auth.uid(), m)
  )
);
