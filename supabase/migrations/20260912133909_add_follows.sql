-- Backs Profile's followers/following stats and (later) the PostDetail Follow
-- button and mutual-follow DM gating (PROJECT_BRIEF.md section 2, Messages).
create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table follows enable row level security;
create policy "Follows are viewable by everyone" on follows for select using (true);
create policy "Users can follow others" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);

create index follows_follower_idx on follows (follower_id);
create index follows_following_idx on follows (following_id);
