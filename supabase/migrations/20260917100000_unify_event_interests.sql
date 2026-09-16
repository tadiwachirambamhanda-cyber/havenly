-- Events had grown two separate "who's interested" systems: the original
-- event_interests table (Discover's heart button + interested_count) and
-- the newer generic interests table (offers + the map's "down to go",
-- added this session) — toggling one never showed up in the other. This
-- unifies everything onto interests, the more general of the two, since it
-- already covers both offers and events with one shape.
insert into public.interests (user_id, place_type, place_id, created_at)
select user_id, 'event', event_id, created_at from public.event_interests
on conflict (user_id, place_type, place_id) do nothing;

-- Replaces toggle_event_interest() with a generic version both offers and
-- events use — also makes toggling atomic. The client-side toggleInterest()
-- this replaced did a plain delete-then-insert with no transaction, a real
-- (if small) race window between two rapid taps.
create or replace function public.toggle_interest(place_type_input text, place_id_input uuid)
returns table (interested boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  already_interested boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from interests where place_type = place_type_input and place_id = place_id_input and user_id = uid
  ) into already_interested;

  if already_interested then
    delete from interests where place_type = place_type_input and place_id = place_id_input and user_id = uid;
  else
    insert into interests (user_id, place_type, place_id) values (uid, place_type_input, place_id_input);
  end if;

  return query select not already_interested;
end;
$$;
grant execute on function public.toggle_interest(text, uuid) to authenticated;

drop function if exists public.toggle_event_interest(uuid);
drop table if exists public.event_interests;
alter table public.events drop column if exists interested_count;
