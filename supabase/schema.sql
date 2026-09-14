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

-- ==================== SAFETY: BLOCKING ====================
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

-- security definer because "Users can view their own blocks" only lets a
-- user see rows where they're the blocker — correct for privacy (you can't
-- casually query who's blocked you), but it means a plain RLS subquery
-- elsewhere couldn't see the other direction. This checks both directions
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

-- ==================== FOLLOWS ====================
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

-- ==================== POSTS ====================
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  body text,
  -- For a video post, image_url holds the generated poster/thumbnail frame
  -- (used anywhere a thumbnail already renders — Feed grid, Profile grid,
  -- Discover) and video_url holds the actual clip, played only from
  -- PostDetail. Client enforces a 60s cap at pick time.
  image_url text,
  video_url text,
  tag text not null,
  is_editorial boolean default false,
  like_count int default 0,
  comment_count int not null default 0,
  created_at timestamptz default now()
);
alter table posts enable row level security;
create policy "Posts are viewable unless blocked" on posts for select using (
  not public.is_blocked_between(auth.uid(), author_id)
);
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

-- Atomically toggles a like: inserts/deletes the post_likes row and keeps
-- posts.like_count in sync in one transaction. security definer because the
-- "Users can update their own posts" RLS policy would otherwise block anyone
-- but the post's author from touching like_count.
create or replace function public.toggle_post_like(post_id_input uuid)
returns table (liked boolean, like_count int)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  already_liked boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists(select 1 from post_likes where post_id = post_id_input and user_id = uid) into already_liked;

  if already_liked then
    delete from post_likes where post_id = post_id_input and user_id = uid;
    update posts set like_count = greatest(posts.like_count - 1, 0) where id = post_id_input;
  else
    insert into post_likes (post_id, user_id) values (post_id_input, uid);
    update posts set like_count = posts.like_count + 1 where id = post_id_input;
  end if;

  return query select not already_liked, posts.like_count from posts where posts.id = post_id_input;
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;

-- ==================== COMMENTS ====================
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
alter table comments enable row level security;
create policy "Comments are viewable unless blocked" on comments for select using (
  not public.is_blocked_between(auth.uid(), author_id)
);
create policy "Users can add comments" on comments for insert with check (auth.uid() = author_id);
create policy "Users can delete their own comments" on comments for delete using (auth.uid() = author_id);

-- Keeps posts.comment_count in sync regardless of insert/delete path.
-- security definer because "Users can update their own posts" would
-- otherwise block anyone but the post's author from touching this count.
create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_comment_change
  after insert or delete on comments
  for each row execute procedure public.sync_post_comment_count();

-- ==================== SAVED POSTS ====================
create table saved_posts (
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);
alter table saved_posts enable row level security;
create policy "Users can view their own saved posts" on saved_posts for select using (auth.uid() = user_id);
create policy "Users can save posts" on saved_posts for insert with check (auth.uid() = user_id);
create policy "Users can unsave posts" on saved_posts for delete using (auth.uid() = user_id);

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
  -- Only set for category='campus' communities — same personalization
  -- pattern as related_interest, matched against profiles.university.
  related_university text,
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

-- Keeps communities.member_count in sync with actual joins/leaves. Existing
-- seeded values are a starting size and grow/shrink from there.
create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update communities set member_count = member_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end;
$$;

create trigger on_community_member_change
  after insert or delete on community_members
  for each row execute procedure public.sync_community_member_count();

-- ==================== MESSAGING ====================
-- Message requests: a new conversation starts 'pending' and the recipient
-- must accept before a real back-and-forth chat opens. The initiator can
-- send their opening message(s) while pending (that's the "request"
-- content the recipient previews); the recipient cannot send anything
-- until they accept — enforced below at the RLS level, not just in the UI.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  participant_ids uuid[] not null,
  last_message text,
  last_message_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  initiator_id uuid references profiles(id),
  created_at timestamptz default now()
);
alter table conversations enable row level security;
create policy "Users can view their own conversations" on conversations for select using (auth.uid() = any(participant_ids));
create policy "Users can create conversations they're part of" on conversations for insert with check (
  auth.uid() = any(participant_ids) and auth.uid() = initiator_id
  and not public.is_blocked_between(participant_ids[1], participant_ids[2])
);
create policy "Participants can update conversation status" on conversations for update using (auth.uid() = any(participant_ids));

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
  auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = messages.conversation_id
      and auth.uid() = any(c.participant_ids)
      and (c.status = 'accepted' or (c.status = 'pending' and c.initiator_id = auth.uid()))
      and not public.is_blocked_between(c.participant_ids[1], c.participant_ids[2])
  )
);

-- Tracks the last time each user viewed each conversation, so Inbox can show
-- a real per-thread unread indicator (and the nav bar a real unread dot).
create table conversation_reads (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table conversation_reads enable row level security;
create policy "Users can view their own read state" on conversation_reads for select using (auth.uid() = user_id);
create policy "Users can set their own read state" on conversation_reads for insert with check (auth.uid() = user_id);
create policy "Users can update their own read state" on conversation_reads for update using (auth.uid() = user_id);

-- Postgres tables are NOT broadcast to Supabase Realtime unless explicitly
-- added here — required for ChatScreen's live message/status subscriptions
-- and the Inbox/nav-bar unread indicators to actually receive events.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_reads;

-- ==================== SAFETY: REPORTING ====================
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
create index follows_follower_idx on follows (follower_id);
create index follows_following_idx on follows (following_id);
create index comments_post_idx on comments (post_id, created_at);
create index saved_posts_user_idx on saved_posts (user_id);

-- ==================== STORAGE ====================
-- Path convention for both buckets: <user_id>/<filename>, checked against
-- auth.uid() via storage.foldername(name)[1].
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;
create policy "Post images are publicly viewable" on storage.objects for select using (bucket_id = 'post-images');
create policy "Users can upload their own post images" on storage.objects for insert with check (
  bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own post images" on storage.objects for delete using (
  bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
);

-- file_size_limit is a backstop against an unexpectedly high-bitrate file
-- slipping past the client's 60s duration cap, not the primary cost control.
insert into storage.buckets (id, name, public, file_size_limit) values ('post-videos', 'post-videos', true, 104857600)
on conflict (id) do nothing;
create policy "Post videos are publicly viewable" on storage.objects for select using (bucket_id = 'post-videos');
create policy "Users can upload their own post videos" on storage.objects for insert with check (
  bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own post videos" on storage.objects for delete using (
  bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Separate from post-images (one profile photo per user vs. many post
-- photos) even though the RLS pattern is identical.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy "Avatars are publicly viewable" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload their own avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can update their own avatar" on storage.objects for update using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
