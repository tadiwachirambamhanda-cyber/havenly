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
  -- Lets a small set of trusted accounts manage events (create/delete) from
  -- inside the app. Defaults false; nobody has it except an explicit grant
  -- (see README.md's "Getting started" for how to set the first one).
  is_admin boolean not null default false,
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

-- Lets a signed-in user permanently delete their own account from Settings.
-- Runs as the table owner (security definer) because deleting from
-- auth.users needs privileges the authenticated role doesn't have — same
-- reason handle_new_user() needs it, just in reverse. Deleting the
-- auth.users row cascades to profiles and, from there, to every table that
-- references profiles(id) on delete cascade (posts, comments, likes, saved
-- posts, follows, blocks, community memberships, messages, read state).
-- Storage files (avatar, post images/videos) aren't touched by cascade —
-- the client removes those first, while its session can still write to
-- storage, before calling this.
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
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

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

-- "Users can unfollow" only lets a user delete rows where they're the
-- follower — correct for normal unfollowing, but it means blockUser()'s
-- plain client-side deletes can't remove the *other* direction (them
-- following you) when you block someone. security definer lets a block
-- cleanly remove both sides in one call, same pattern as is_blocked_between.
create or replace function public.unfollow_both_directions(user_a uuid, user_b uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is distinct from user_a and auth.uid() is distinct from user_b then
    raise exception 'Not authorized';
  end if;
  delete from follows
  where (follower_id = user_a and following_id = user_b)
     or (follower_id = user_b and following_id = user_a);
end;
$$;

grant execute on function public.unfollow_both_directions(uuid, uuid) to authenticated;

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
create policy "Users can delete their own posts" on posts for delete using (auth.uid() = author_id);

-- No "update posts" policy: no screen ever edits a post after it's created
-- (likes go through toggle_post_like(), comment_count through a trigger,
-- both security definer). Leaving an unused, unscoped update policy around
-- would let any user set like_count/comment_count/is_editorial to whatever
-- they want on their own posts, since a plain "using (auth.uid() =
-- author_id)" doesn't restrict which columns change.

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

-- ==================== NOTIFICATIONS ====================
-- No insert/update-by-authenticated policy for the general case: rows are
-- only ever created by the security-definer triggers below (never directly
-- by a client), so nobody can spoof a notification as coming from someone
-- else. The one client-writable path is marking your own read.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('follow', 'like', 'comment')),
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;
create policy "Users can view their own notifications" on notifications for select using (auth.uid() = recipient_id);
create policy "Users can mark their own notifications read" on notifications for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

-- New follower. security definer because there's no insert policy letting
-- one user write a notifications row addressed to someone else.
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

create trigger on_follow_notify
  after insert on follows
  for each row execute procedure public.notify_on_follow();

-- Unfollowing removes the earlier "started following you" notification
-- rather than leaving a stale one behind.
create or replace function public.remove_follow_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from notifications
  where type = 'follow' and recipient_id = old.following_id and actor_id = old.follower_id;
  return old;
end;
$$;

create trigger on_unfollow_notify
  after delete on follows
  for each row execute procedure public.remove_follow_notification();

-- Post like — skips self-likes, which would otherwise notify you every time
-- you like your own post.
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  author uuid;
begin
  select author_id into author from posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into notifications (recipient_id, actor_id, type, post_id)
    values (author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$;

create trigger on_like_notify
  after insert on post_likes
  for each row execute procedure public.notify_on_like();

-- Unliking removes the earlier "liked your post" notification.
create or replace function public.remove_like_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from notifications
  where type = 'like' and post_id = old.post_id and actor_id = old.user_id;
  return old;
end;
$$;

create trigger on_unlike_notify
  after delete on post_likes
  for each row execute procedure public.remove_like_notification();

-- New comment — skips self-comments. No matching delete-cleanup trigger
-- needed: notifications.comment_id references comments(id) on delete
-- cascade, so deleting the comment removes the notification automatically.
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  author uuid;
begin
  select author_id into author from posts where id = new.post_id;
  if author is not null and author <> new.author_id then
    insert into notifications (recipient_id, actor_id, type, post_id, comment_id)
    values (author, new.author_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$$;

create trigger on_comment_notify
  after insert on comments
  for each row execute procedure public.notify_on_comment();

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
    'cafes','fashion','nightlife','fitness','beach','study','travel','events','padel','beauty',
    'football','running','art','gaming'
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
-- Campus communities are meant to be an authentic space for that specific
-- university's students, not open to anyone — you can still browse/see
-- every campus community, but can only join the one matching your own
-- profile.university. Interest communities (Padel, Cafés, etc.) stay open
-- to everyone.
create policy "Users can join communities" on community_members for insert with check (
  auth.uid() = user_id
  and (
    (select category from communities where id = community_id) = 'interest'
    or (select related_university from communities where id = community_id) = (select university from profiles where id = auth.uid())
  )
);
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

-- Lets a post optionally belong to a community, reusing the existing
-- post/comment/like system instead of building separate community
-- infrastructure. Nullable: most posts (editorial, general feed) belong to
-- no community. Posting into a community requires membership, enforced here
-- rather than just in the UI. (Column added here, after communities exists,
-- even though posts itself is defined earlier in this file.)
alter table posts add column community_id uuid references communities(id) on delete set null;
create index posts_community_idx on posts (community_id, created_at);

-- is_editorial = false because editorial posts are only ever inserted
-- directly in the database (see 20260912160509_seed_editorial_posts.sql),
-- never through the app — this closes the self-publish-as-editorial gap the
-- original comment on the first version of this policy above flagged as a
-- TODO but never enforced.
drop policy "Users can create their own posts" on posts;
create policy "Users can create their own posts" on posts for insert with check (
  auth.uid() = author_id
  and is_editorial = false
  and (
    community_id is null
    or exists (select 1 from community_members where community_id = posts.community_id and user_id = auth.uid())
  )
);

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
  -- on delete set null (not cascade): if the initiator later deletes their
  -- account, the conversation and the other participant's messages should
  -- survive — only this pointer needs to go null, same pattern as
  -- posts.community_id when a community disappears.
  initiator_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table conversations enable row level security;
create policy "Users can view their own conversations" on conversations for select using (auth.uid() = any(participant_ids));
create policy "Users can create conversations they're part of" on conversations for insert with check (
  auth.uid() = any(participant_ids) and auth.uid() = initiator_id
  and not public.is_blocked_between(participant_ids[1], participant_ids[2])
);
-- Column-scoped: ChatScreen only ever updates status, last_message and
-- last_message_at, never participant_ids or initiator_id. Without this
-- grant, either participant could add an uninvited third person into
-- participant_ids and hand them live read access to the whole message
-- history via the select policy above. The with check also stops the
-- initiator from self-accepting/declining their own pending request — only
-- the recipient should be able to move status off 'pending', matching what
-- the UI already only shows them (ChatScreen's isPending && !isInitiator).
revoke update on conversations from authenticated;
grant update (status, last_message, last_message_at) on conversations to authenticated;
create policy "Participants can update conversation status" on conversations for update
  using (auth.uid() = any(participant_ids))
  with check (
    auth.uid() = any(participant_ids)
    and (status = 'pending' or auth.uid() <> initiator_id)
  );

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
-- Same reasoning as above — needed for the nav bar's notifications badge to
-- update live.
alter publication supabase_realtime add table notifications;

-- ==================== EVENTS ====================
-- Editorial-only, same reasoning as posts.is_editorial: there's no insert
-- policy for authenticated users at all, so the only way a row gets in is a
-- migration seeding it server-side.
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
create policy "Admins can create events" on events for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete events" on events for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

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
create index events_date_idx on events (event_date);
create index event_interests_user_idx on event_interests (user_id);
create index event_interests_event_idx on event_interests (event_id);

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
