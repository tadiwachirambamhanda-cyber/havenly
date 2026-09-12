-- Havenly database schema for Supabase (Postgres)
-- Run this in the Supabase SQL editor, or via `supabase db push` once linked.

-- ==================== PROFILES ====================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  university text,
  interests text[] default '{}',
  has_completed_onboarding boolean not null default false,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row the moment someone signs up, so the app never has
-- an authenticated user with no matching profiles row. Runs as the table
-- owner (security definer) so it isn't blocked by the RLS policies above.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if base_username = '' then
    base_username := 'user';
  end if;
  final_username := base_username || '_' || substr(new.id::text, 1, 6);

  insert into public.profiles (id, username, display_name, has_completed_onboarding)
  values (new.id, final_username, initcap(base_username), false);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==================== POSTS ====================
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  body text,
  image_url text,
  tag text not null,
  is_editorial boolean default false,
  like_count int default 0,
  created_at timestamptz default now()
);
alter table posts enable row level security;
create policy "Posts are viewable by everyone" on posts for select using (true);
create policy "Users can create their own posts" on posts for insert with check (auth.uid() = author_id);
create policy "Users can update their own posts" on posts for update using (auth.uid() = author_id);
create policy "Users can delete their own posts" on posts for delete using (auth.uid() = author_id);

-- Editorial posts should only be insertable by an admin/editor role.
-- Recommended: add an `is_editor` boolean to profiles, checked here:
-- create policy "Only editors can post editorial content" on posts for insert with check (
--   (is_editorial = false) or
--   (is_editorial = true and exists (select 1 from profiles where id = auth.uid() and is_editor = true))
-- );

create table post_likes (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;
create policy "Likes are viewable by everyone" on post_likes for select using (true);
create policy "Users can like posts" on post_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike posts" on post_likes for delete using (auth.uid() = user_id);

-- ==================== COMMUNITIES ====================
create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  description text,
  category text not null check (category in ('interest', 'campus')),
  -- Only set for category='interest' communities — lets the Communities screen surface
  -- ones matching the interests a user picked in onboarding.
  related_interest text check (related_interest in (
    'cafes','fashion','nightlife','fitness','beach','study','travel','events','padel','beauty'
  )),
  member_count int default 0,
  created_at timestamptz default now()
);
alter table communities enable row level security;
create policy "Communities are viewable by everyone" on communities for select using (true);

create table community_members (
  community_id uuid references communities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (community_id, user_id)
);
alter table community_members enable row level security;
create policy "Memberships are viewable by everyone" on community_members for select using (true);
create policy "Users can join communities" on community_members for insert with check (auth.uid() = user_id);
create policy "Users can leave communities" on community_members for delete using (auth.uid() = user_id);

-- ==================== MESSAGING ====================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  participant_ids uuid[] not null,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz default now()
);
alter table conversations enable row level security;
create policy "Users can view their own conversations" on conversations for select using (auth.uid() = any(participant_ids));
create policy "Users can create conversations they're part of" on conversations for insert with check (auth.uid() = any(participant_ids));

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy "Users can view messages in their conversations" on messages for select using (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and auth.uid() = any(conversations.participant_ids))
);
create policy "Users can send messages in their conversations" on messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from conversations where conversations.id = messages.conversation_id and auth.uid() = any(conversations.participant_ids))
);

-- SAFETY LAYER (flagged in planning — implement before public launch)
create table blocked_users (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocked_users enable row level security;
create policy "Users can view their own blocks" on blocked_users for select using (auth.uid() = blocker_id);
create policy "Users can block others" on blocked_users for insert with check (auth.uid() = blocker_id);
create policy "Users can unblock others" on blocked_users for delete using (auth.uid() = blocker_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','user','message','community')),
  target_id uuid not null,
  reason text not null,
  status text default 'pending' check (status in ('pending','reviewed','actioned','dismissed')),
  created_at timestamptz default now()
);
alter table reports enable row level security;
create policy "Users can create reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "Users can view their own reports" on reports for select using (auth.uid() = reporter_id);

-- ==================== INDEXES ====================
create index posts_created_at_idx on posts (created_at desc);
create index posts_author_idx on posts (author_id);
create index messages_conversation_idx on messages (conversation_id, created_at);
