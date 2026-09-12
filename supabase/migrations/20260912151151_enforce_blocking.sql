-- blocked_users existed already but enforced nothing — a block was just a
-- database row with no effect. This makes it actually do something: blocked
-- users' posts disappear from view, and neither side can start or continue
-- messaging the other, all enforced at the RLS level (not just hidden by the
-- UI, so it can't be bypassed by a modified client).
--
-- security definer because "Users can view their own blocks" only lets a
-- user see rows where they're the blocker — correct for privacy (you can't
-- casually query who's blocked you), but it means a plain RLS subquery
-- couldn't see the other direction. This function checks both directions
-- without needing to loosen blocked_users' own visibility.
create or replace function public.is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from blocked_users
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

drop policy if exists "Posts are viewable by everyone" on posts;
create policy "Posts are viewable unless blocked" on posts for select using (
  not public.is_blocked_between(auth.uid(), author_id)
);

drop policy if exists "Users can create conversations they're part of" on conversations;
create policy "Users can create conversations they're part of" on conversations for insert with check (
  auth.uid() = any(participant_ids) and auth.uid() = initiator_id
  and not public.is_blocked_between(participant_ids[1], participant_ids[2])
);

drop policy if exists "Users can send messages in their conversations" on messages;
create policy "Users can send messages in their conversations" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = messages.conversation_id
      and auth.uid() = any(c.participant_ids)
      and (c.status = 'accepted' or (c.status = 'pending' and c.initiator_id = auth.uid()))
      and not public.is_blocked_between(c.participant_ids[1], c.participant_ids[2])
  )
);
