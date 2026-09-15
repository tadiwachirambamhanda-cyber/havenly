-- Real events for Discover's "This week on campus" section, replacing the
-- static mock EVENTS array in DiscoverScreen.tsx. Editorial-only, same
-- reasoning as posts.is_editorial: there's no insert policy for
-- authenticated users at all, so the only way a row gets in is a migration
-- seeding it server-side (see the seed migration that follows this one).
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text not null,
  tag text not null,
  event_date timestamptz not null,
  interested_count int not null default 0,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Events are viewable by everyone" on events for select using (true);

-- Who's marked themselves interested in an event — lets Discover show a
-- real count and cross-reference against `follows` to surface "people you
-- follow who are going". Viewable by everyone (same as post_likes/
-- community_members) so that friends-going lookup can run as a normal
-- client query instead of a security-definer function.
create table event_interests (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);
alter table event_interests enable row level security;
create policy "Event interest is viewable by everyone" on event_interests for select using (true);
create policy "Users can mark interest in events" on event_interests for insert with check (auth.uid() = user_id);
create policy "Users can remove their interest" on event_interests for delete using (auth.uid() = user_id);

-- Atomically toggles interest and keeps events.interested_count in sync,
-- same shape as toggle_post_like. security definer because there's no
-- update policy on events at all (nothing else should ever touch this
-- table's columns from the client).
create or replace function public.toggle_event_interest(event_id_input uuid)
returns table (interested boolean, interested_count int)
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

  select exists(select 1 from event_interests where event_id = event_id_input and user_id = uid) into already_interested;

  if already_interested then
    delete from event_interests where event_id = event_id_input and user_id = uid;
    update events set interested_count = greatest(events.interested_count - 1, 0) where id = event_id_input;
  else
    insert into event_interests (event_id, user_id) values (event_id_input, uid);
    update events set interested_count = events.interested_count + 1 where id = event_id_input;
  end if;

  return query select not already_interested, events.interested_count from events where events.id = event_id_input;
end;
$$;

grant execute on function public.toggle_event_interest(uuid) to authenticated;

create index events_date_idx on events (event_date);
create index event_interests_user_idx on event_interests (user_id);
create index event_interests_event_idx on event_interests (event_id);
