-- ==================== LOCATION ====================
-- Real coordinates for offers/events, so they can be sorted by distance and
-- pinned on a map. Nullable — existing rows (and any future editorial
-- content without a specific place) just don't show up on the map or in
-- "near me" sorting.
alter table offers add column latitude double precision;
alter table offers add column longitude double precision;
alter table offers add column address text;

alter table events add column latitude double precision;
alter table events add column longitude double precision;

-- A check-in is a deliberate, expiring "I'm here right now" — never
-- continuous/ambient GPS tracking. Defaults to a 4-hour lifetime so stale
-- check-ins don't linger; a user can also delete their own early.
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  place_type text not null check (place_type in ('offer', 'event')),
  place_id uuid not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

-- Who's allowed to see whose check-ins — deliberately tighter than
-- "followers", since following here is one-directional and doesn't imply
-- any real-world trust (anyone can follow anyone). Visible only to: the
-- user themself, a mutual follow (both sides follow each other), a fellow
-- member of a group chat they're both in, or a fellow member of the same
-- community. security definer + stable, same reasoning and shape as
-- is_blocked_between — the RLS policy below needs this to read
-- follows/conversations/community_members regardless of whose row it's
-- evaluating.
create or replace function public.can_see_checkin(viewer uuid, target uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    viewer = target
    or (
      exists (select 1 from follows where follower_id = viewer and following_id = target)
      and exists (select 1 from follows where follower_id = target and following_id = viewer)
    )
    or exists (
      select 1 from conversations c
      where c.is_group and viewer = any(c.participant_ids) and target = any(c.participant_ids)
    )
    or exists (
      select 1 from community_members cm1 join community_members cm2 on cm1.community_id = cm2.community_id
      where cm1.user_id = viewer and cm2.user_id = target
    );
$$;
grant execute on function public.can_see_checkin(uuid, uuid) to authenticated;

alter table check_ins enable row level security;
create policy "Users can view check-ins they're allowed to see" on check_ins for select using (
  expires_at > now() and public.can_see_checkin(auth.uid(), user_id)
);
create policy "Users can create their own check-ins" on check_ins for insert with check (auth.uid() = user_id);
create policy "Users can delete their own check-ins" on check_ins for delete using (auth.uid() = user_id);
create index check_ins_place_idx on check_ins (place_type, place_id);

-- ==================== PINGS ====================
-- A ping is a deliberate nudge ("come join me"), not automatic like
-- follow/like/comment notifications — there's no trigger here, just an RPC
-- a user calls directly. It reuses the notifications table (a new type)
-- rather than a parallel one, so it shows up in the same list with the
-- same read-state handling.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in ('follow', 'like', 'comment', 'ping'));
alter table notifications add column check_in_id uuid references check_ins(id) on delete cascade;

-- Re-verifies visibility server-side rather than trusting that the client
-- only shows a Ping button where it should — same reasoning as
-- claim_offer() re-checking streak eligibility itself.
create or replace function public.send_ping(check_in_id_input uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
  checkin_expires timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, expires_at into target_id, checkin_expires from check_ins where id = check_in_id_input;
  if target_id is null then
    raise exception 'This check-in no longer exists.';
  end if;
  if checkin_expires < now() then
    raise exception 'This check-in has expired.';
  end if;
  if target_id = uid then
    raise exception 'You can’t ping yourself.';
  end if;
  if not public.can_see_checkin(uid, target_id) then
    raise exception 'You can’t ping this person.';
  end if;

  insert into notifications (recipient_id, actor_id, type, check_in_id) values (target_id, uid, 'ping', check_in_id_input);
end;
$$;

grant execute on function public.send_ping(uuid) to authenticated;
