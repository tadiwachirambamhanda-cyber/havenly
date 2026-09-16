-- "I'm down to go" — a lighter-weight, forward-looking signal than a
-- check-in: you haven't arrived yet, you're just saying you'd go. Same
-- visibility rule as check-ins (mutual follows + shared groups/communities),
-- reusing can_see_checkin() since the trust relationship is identical.
create table interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  place_type text not null check (place_type in ('offer', 'event')),
  place_id uuid not null,
  created_at timestamptz default now(),
  unique (user_id, place_type, place_id)
);

alter table interests enable row level security;
create policy "Users can view interests they're allowed to see" on interests for select using (
  public.can_see_checkin(auth.uid(), user_id)
);
create policy "Users can mark their own interest" on interests for insert with check (auth.uid() = user_id);
create policy "Users can remove their own interest" on interests for delete using (auth.uid() = user_id);
create index interests_place_idx on interests (place_type, place_id);
