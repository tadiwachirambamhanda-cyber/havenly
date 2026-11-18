-- Havenly database schema for Supabase (Postgres)
-- Run this in the Supabase SQL editor, or via `supabase db push` once linked.

-- ==================== PROFILES ====================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  -- Shown behind the avatar on the profile header; falls back to a fixed
  -- gradient when null, same fallback pattern as a missing avatar_url.
  cover_url text,
  university text,
  interests text[] default '{}',
  -- What the student is looking for (all optional); see 20261118400000_profile_housing_preferences.sql.
  budget_aed int check (budget_aed between 1 and 100000),
  move_in_month date check (move_in_month = date_trunc('month', move_in_month)::date),
  housemate_pref text check (housemate_pref in ('any', 'female_only', 'male_only')),
  -- Daily activity streak — see bump_streak() below for how these advance.
  -- last_active_date is the UTC date it was last extended, matching the
  -- daily-pick feature's own day-boundary convention.
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
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
-- Row policy alone lets a user edit every column of their own row (including
-- is_admin and streaks), so updates are limited to editable columns and
-- direct inserts are closed (see 20261106100000_lock_down_profile_columns.sql).
revoke update on profiles from authenticated, anon;
grant update (username, display_name, bio, avatar_url, cover_url, university, interests, has_completed_onboarding, budget_aed, move_in_month, housemate_pref) on profiles to authenticated;
revoke insert on profiles from authenticated, anon;
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- Called once per app session (see RootNavigator). security definer so a
-- client can't just set current_streak directly to whatever it wants via a
-- plain update — this is the only path that actually advances it, and the
-- day-by-day comparison here is what keeps it honest.
create or replace function public.bump_streak()
returns table (current_streak int, longest_streak int, is_new_day boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := current_date;
  last_date date;
  streak int;
  longest int;
  new_day boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select last_active_date, profiles.current_streak, profiles.longest_streak
    into last_date, streak, longest
    from profiles where id = uid;

  if last_date is null or last_date < today - 1 then
    -- First-ever activity, or a day (or more) was missed — restart at 1.
    streak := 1;
    new_day := true;
  elsif last_date = today - 1 then
    -- Picked up again the very next day — extend it.
    streak := streak + 1;
    new_day := true;
  elsif last_date = today then
    -- Already counted today; leave everything as-is.
    new_day := false;
  end if;

  if new_day then
    longest := greatest(longest, streak);
    update profiles set current_streak = streak, longest_streak = longest, last_active_date = today where id = uid;
  end if;

  return query select streak, longest, new_day;
end;
$$;

grant execute on function public.bump_streak() to authenticated;

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
-- Also clears the user's chat traces (messages, group membership, last_message):
-- see 20261106170000_account_deletion_cleans_chats.sql.
-- Also clears the user's chat traces (messages, group membership, last_message):
-- see 20261106170000_account_deletion_cleans_chats.sql and
-- 20261106180000_account_deletion_group_preview.sql.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  affected uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  affected := array(select id from conversations where uid = any(participant_ids) or initiator_id = uid);

  delete from messages where sender_id = uid;

  update conversations
    set participant_ids = array_remove(participant_ids, uid),
        initiator_id = case when initiator_id = uid then null else initiator_id end
    where is_group and uid = any(participant_ids);
  delete from conversations where is_group and coalesce(array_length(participant_ids, 1), 0) < 2;

  update conversations c set
    last_message = (select m.body from messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    last_message_at = (select m.created_at from messages m where m.conversation_id = c.id order by m.created_at desc limit 1)
  where c.id = any(affected);

  delete from conversations c
    where not c.is_group and c.id = any(affected)
      and not exists (select 1 from messages m where m.conversation_id = c.id);

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
-- No client insert/delete policies: likes are written only by
-- toggle_post_like, and posts.like_count is kept by a trigger on this table
-- (see 20261106120000_like_count_by_trigger.sql).
revoke insert, update, delete on post_likes from authenticated, anon;

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
  else
    insert into post_likes (post_id, user_id) values (post_id_input, uid);
  end if;

  return query select not already_liked, posts.like_count from posts where posts.id = post_id_input;
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;

-- posts.like_count follows the post_likes rows by trigger, so cascades
-- (account deletion) and every other write adjust it exactly once.
create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  else
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger sync_post_like_count
  after insert or delete on post_likes
  for each row execute procedure public.sync_post_like_count();

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
  type text not null check (type in ('follow', 'like', 'comment', 'ping')),
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  -- Only set for type='ping' — see send_ping() further down, in the
  -- LOCATION section (check_ins has to exist first).
  check_in_id uuid,
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
-- counts start from real joins (see 20261019120000_real_engagement_counts.sql,
-- which replaced invented seed numbers) and grow/shrink from there.
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

-- Optional place a post is about; the app links it to Maps (see 20261110100000_post_location.sql).
alter table posts add column location text check (location is null or char_length(location) <= 120);
create index posts_community_idx on posts (community_id, created_at);

-- is_editorial = false because editorial posts are only ever inserted
-- directly in the database (the original demo set from
-- 20260912160509_seed_editorial_posts.sql was removed in
-- 20261019140000_remove_demo_editorial_posts.sql),
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
  -- A group has no request/accept step the way an unsolicited 1:1 DM does
  -- (you're just added), so it's created directly at status='accepted' and
  -- stays there for its whole lifetime in this first version — no
  -- leave/kick yet, though any member can rename it or change its icon.
  -- name/icon_url are only ever set for groups; a 1:1's display name and
  -- photo are always just the other participant's.
  is_group boolean not null default false,
  name text,
  icon_url text,
  check (not is_group or status = 'accepted'),
  created_at timestamptz default now()
);
alter table conversations enable row level security;
create policy "Users can view their own conversations" on conversations for select using (auth.uid() = any(participant_ids));
-- Tightened in 20261106110000_harden_conversation_creation.sql: must be a
-- non-group, 'pending', exactly two distinct real people, no block, and no
-- existing 1:1 between them (a declined request can't be restarted).
create policy "Users can create conversations they're part of" on conversations for insert with check (
  not is_group
  and status = 'pending'
  and auth.uid() = initiator_id
  and array_length(participant_ids, 1) = 2
  and auth.uid() = any(participant_ids)
  and participant_ids[1] <> participant_ids[2]
  and (select count(*) from profiles p where p.id = any(participant_ids)) = 2
  and not public.is_blocked_between(participant_ids[1], participant_ids[2])
  and not exists (
    select 1 from conversations c
    where not c.is_group and c.participant_ids @> participant_ids and c.participant_ids <@ participant_ids
  )
);
-- Additive, not a replacement for the policy above: its is_blocked_between
-- check only makes sense for a 2-person DM and would misfire against
-- arbitrary array positions in a group, so groups get their own policy
-- instead of trying to make one expression cover both shapes. Blocking
-- isn't enforced for groups at all here — same as most chat apps, being
-- blocked by someone doesn't remove you from a group you're both in, it
-- only affects 1:1 DMs and post/comment visibility.
-- Consent: you can only add people you follow and who follow you back, and
-- neither side may have blocked the other (20261106150000_group_chat_consent.sql).
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

create policy "Users can create groups they're part of" on conversations for insert with check (
  is_group
  and auth.uid() = any(participant_ids)
  and auth.uid() = initiator_id
  and status = 'accepted'
  and array_length(participant_ids, 1) >= 3
  and (select count(distinct m) from unnest(participant_ids) m) = array_length(participant_ids, 1)
  and (select count(*) from profiles p where p.id = any(participant_ids)) = array_length(participant_ids, 1)
  and not exists (
    select 1 from unnest(participant_ids) m
    where m <> auth.uid() and not public.can_add_to_group(auth.uid(), m)
  )
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
-- Also additive. The policy above has a with-check of (status = 'pending'
-- or auth.uid() <> initiator_id) — for a group, status is permanently
-- 'accepted' and the creator (who IS the initiator) needs to update
-- last_message/last_message_at when they send, which that expression would
-- otherwise block. Scoping a second policy to is_group sidesteps that
-- without touching the 1:1 policy at all.
create policy "Group participants can update conversation" on conversations for update
  using (is_group and auth.uid() = any(participant_ids))
  with check (is_group and auth.uid() = any(participant_ids) and status = 'accepted');
-- icon_url/name weren't in the column-scoped grant above — needed so a
-- group member can actually rename a group or set its icon from the
-- client. The policy above already allows any current member to write
-- these once granted; it doesn't restrict which columns, only the GRANT
-- does that.
grant update (icon_url, name) on conversations to authenticated;

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
-- Same reasoning as the conversations insert policy above — the policy
-- above's is_blocked_between check only makes sense for 2-person
-- participant_ids, so groups get their own additive policy.
create policy "Group participants can send messages" on messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from conversations c where c.id = messages.conversation_id and c.is_group and auth.uid() = any(c.participant_ids)
  )
);

-- Lets a message carry a post alongside (or instead of) its own text, so
-- "Send to" can drop a post into a DM as a tappable preview card rather
-- than just a plain-text link. on delete set null (not cascade): if the
-- shared post is later deleted, the message itself should survive — it
-- just falls back to reading as a plain-text message, same reasoning as
-- conversations.initiator_id.
alter table messages add column shared_post_id uuid references posts(id) on delete set null;

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

-- Lets someone remove a conversation from just their own Inbox without
-- deleting it for the other participant(s) — the same "delete conversation"
-- behavior WhatsApp/iMessage use: it disappears from your list, but a new
-- message reappears it, since that's activity you'd want to see again.
-- Mirrors conversation_reads' shape (a small per-user marker table) rather
-- than adding a column to conversations, since conversations has no
-- per-user row to attach one to (participant_ids is a plain array).
create table conversation_hidden_for (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table conversation_hidden_for enable row level security;
create policy "Users can view their own hidden conversations" on conversation_hidden_for for select using (auth.uid() = user_id);
create policy "Users can hide their own conversations" on conversation_hidden_for for insert with check (auth.uid() = user_id);
create policy "Users can update their own hide marker" on conversation_hidden_for for update using (auth.uid() = user_id);
-- Un-hiding (e.g. if this is ever exposed as an explicit "undo") just
-- deletes the row — no separate policy needed beyond owning the row.
create policy "Users can un-hide their own conversations" on conversation_hidden_for for delete using (auth.uid() = user_id);

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
  -- Nullable — lets an event be pinned on the map, but doesn't require it
  -- (older/editorial rows just don't appear there).
  latitude double precision,
  longitude double precision,
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

-- ==================== BRAND OFFERS ====================
-- Phase one of monetization: brands are invoiced manually outside the app
-- (no Stripe yet), so there's no brand login or self-serve posting — an
-- admin creates the brand and its offers, same admin-only pattern already
-- used for events. Streak-gated: an offer only becomes claimable once a
-- user's current_streak meets min_streak.

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  category text not null,
  description text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table brands enable row level security;
create policy "Brands are viewable by everyone" on brands for select using (true);
create policy "Admins can create brands" on brands for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update brands" on brands for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete brands" on brands for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  title text not null,
  description text,
  image_url text,
  -- Free text ("20% off", "Free drink with any meal") rather than a
  -- structured discount type — simpler for a manually-curated v1, and
  -- brands' real offers rarely fit one clean shape anyway.
  discount_label text not null,
  -- 0 = open to everyone; a real streak requirement gates it behind
  -- current_streak, checked server-side in claim_offer() below.
  min_streak int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  -- Nullable — lets an offer be pinned on the map and sorted by distance,
  -- but doesn't require it (an app-wide/online offer just has none).
  latitude double precision,
  longitude double precision,
  address text,
  created_at timestamptz default now()
);
alter table offers enable row level security;
create policy "Offers are viewable by everyone" on offers for select using (true);
create policy "Admins can create offers" on offers for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update offers" on offers for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete offers" on offers for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- One claim per user per offer — claiming again just returns the same
-- code (see claim_offer()) rather than erroring, so a retry after a flaky
-- request doesn't need special-casing on the client.
create table offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  code text not null,
  claimed_at timestamptz default now(),
  -- Not written from the client anywhere yet — a place for a future
  -- "mark as redeemed" reconciliation step once brands have any way to
  -- report back, manual or otherwise.
  redeemed_at timestamptz,
  unique (offer_id, user_id)
);
alter table offer_claims enable row level security;
create policy "Users can view their own claims" on offer_claims for select using (auth.uid() = user_id);
-- No insert policy for authenticated — claim_offer() is the only path in,
-- since eligibility (streak, active window) needs server-side
-- verification, not just a client-side check before the insert.

-- Verifies eligibility and returns a redemption code — generates a new one
-- on first claim, or returns the existing one on a repeat call so this is
-- safe to retry.
create or replace function public.claim_offer(offer_id_input uuid)
returns table (code text, already_claimed boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  offer_row offers%rowtype;
  user_streak int;
  existing_code text;
  new_code text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into offer_row from offers where id = offer_id_input;
  if offer_row.id is null or not offer_row.is_active then
    raise exception 'This offer is not available.';
  end if;
  if offer_row.starts_at > now() then
    raise exception 'This offer isn''t live yet.';
  end if;
  if offer_row.ends_at is not null and offer_row.ends_at < now() then
    raise exception 'This offer has expired.';
  end if;

  select current_streak into user_streak from profiles where id = uid;
  if coalesce(user_streak, 0) < offer_row.min_streak then
    raise exception 'You need a %-day streak to unlock this.', offer_row.min_streak;
  end if;

  select oc.code into existing_code from offer_claims oc where oc.offer_id = offer_id_input and oc.user_id = uid;
  if existing_code is not null then
    return query select existing_code, true;
    return;
  end if;

  -- Short, human-typeable code — a staff member reads it off the user's
  -- screen for a manual reconciliation with the brand, no scanner needed.
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into offer_claims (offer_id, user_id, code) values (offer_id_input, uid, new_code);

  return query select new_code, false;
end;
$$;

grant execute on function public.claim_offer(uuid) to authenticated;

-- ==================== LOCATION ====================
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

-- notifications.check_in_id couldn't reference this table until now, since
-- check_ins didn't exist yet when notifications was created above.
alter table notifications add constraint notifications_check_in_id_fkey
  foreign key (check_in_id) references check_ins(id) on delete cascade;

-- A ping is a deliberate nudge ("come join me"), not automatic like
-- follow/like/comment notifications — there's no trigger here, just an RPC
-- a user calls directly. It reuses the notifications table (a new type)
-- rather than a parallel one, so it shows up in the same list with the
-- same read-state handling. Re-verifies visibility server-side rather than
-- trusting that the client only shows a Ping button where it should —
-- same reasoning as claim_offer() re-checking streak eligibility itself.
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
    raise exception 'You can''t ping yourself.';
  end if;
  if not public.can_see_checkin(uid, target_id) then
    raise exception 'You can''t ping this person.';
  end if;

  insert into notifications (recipient_id, actor_id, type, check_in_id) values (target_id, uid, 'ping', check_in_id_input);
end;
$$;

grant execute on function public.send_ping(uuid) to authenticated;

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
-- Public, not can_see_checkin()-restricted: events' pre-existing "interested"
-- count (Discover's heart button, e.g. "42 interested") shares this table
-- and has always been visible to everyone, not just the viewer's own
-- network. "I'm down to go" is a forward-looking intent, not a real-time
-- location, so treating it like a check-in's tighter visibility isn't
-- warranted here.
create policy "Interest is viewable by everyone" on interests for select using (true);
create policy "Users can mark their own interest" on interests for insert with check (auth.uid() = user_id);
create policy "Users can remove their own interest" on interests for delete using (auth.uid() = user_id);
create index interests_place_idx on interests (place_type, place_id);

-- Lets the Map screen react to new/removed check-ins and interest toggles
-- live instead of only on reopen — same reasoning as the messages/
-- conversations/notifications publication statements above (search doesn't
-- find them grouped there since check_ins/interests aren't defined until
-- here).
alter publication supabase_realtime add table check_ins;
alter publication supabase_realtime add table interests;
-- A DELETE's "old record" only carries primary-key columns by default —
-- check_ins.id is the primary key, so its deletes are fine as-is, but
-- interests.place_type/place_id aren't part of its primary key (just id
-- is), and the map needs both to know which pin's count to recompute.
alter table interests replica identity full;

-- Atomically toggles a user's interest in an offer or event — replaces the
-- old event-only toggle_event_interest() now that offers and events share
-- one interests table. security definer since a plain client-side
-- delete-then-insert (the original client-side toggleInterest()) has a
-- real, if small, race window between two rapid taps.
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

-- Same bucket/RLS shape as avatars — one cover photo per user, folder-scoped
-- to their own uid so the insert/update/delete policies can check it.
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
on conflict (id) do nothing;
create policy "Covers are publicly viewable" on storage.objects for select using (bucket_id = 'covers');
create policy "Users can upload their own cover" on storage.objects for insert with check (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can update their own cover" on storage.objects for update using (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own cover" on storage.objects for delete using (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Different shape from avatars/covers: those are folder-scoped by the
-- owning user's own uid, but a group icon has no single owner — any
-- current member should be able to set it. Objects are stored at
-- "<conversation_id>/<file>", so the check is membership in that specific
-- group rather than auth.uid() matching the folder name.
--
-- storage.objects.name is schema-qualified below rather than bare `name` —
-- conversations also has its own `name` column (the group's display name),
-- and inside this subquery a bare `name` resolves to the nearer c.name
-- instead of the file path, silently rejecting every upload.
insert into storage.buckets (id, name, public) values ('group-icons', 'group-icons', true)
on conflict (id) do nothing;
create policy "Group icons are publicly viewable" on storage.objects for select using (bucket_id = 'group-icons');
create policy "Group members can upload a group icon" on storage.objects for insert with check (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can update a group icon" on storage.objects for update using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can delete a group icon" on storage.objects for delete using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);

-- ==================== STUDENT HOUSING ====================
-- Havenly refers students to partner student residences, which pay a
-- referral fee per student who signs. Havenly never signs the tenancy
-- itself — the residence contracts directly with the student — so the app
-- only needs listings, enquiries, and a pipeline to track what each
-- residence owes. Listings are added by the Havenly team (admin-only
-- writes, same pattern as brands/offers); there's no provider login yet.

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;
grant execute on function public.is_admin() to authenticated;

create table residences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- The operator or licensed agency the student actually contracts with.
  provider_name text not null,
  description text,
  -- Neighbourhood students search by, e.g. "Dubai International Academic City".
  area text not null,
  address text,
  latitude double precision,
  longitude double precision,
  photo_urls text[] not null default '{}',
  amenities text[] not null default '{}',
  -- Names from the app's UNIVERSITIES list, curated by the team rather
  -- than computed from coordinates — "near" for a student means a short
  -- commute or a shuttle, which straight-line distance doesn't capture.
  nearby_universities text[] not null default '{}',
  gender_policy text not null default 'mixed' check (gender_policy in ('mixed', 'female_only', 'male_only')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  -- What kind of place this is. Only a whole home has a bedroom count (1 to 3).
  listing_type text not null default 'residence'
    check (listing_type in ('residence', 'shared_room', 'private_room', 'studio', 'home')),
  bedrooms int,
  -- Costs on top of rent, whole AED. Null means none.
  deposit_aed int check (deposit_aed is null or deposit_aed >= 0),
  move_in_fee_aed int check (move_in_fee_aed is null or move_in_fee_aed >= 0),
  -- Set by the Havenly team after checking the place.
  is_verified boolean not null default false,
  verified_at timestamptz,
  permit_number text check (permit_number is null or char_length(permit_number) <= 40),
  -- Bills: true = in the rent, false = not, null = not stated. The estimate is monthly, for the whole listing.
  bills_included boolean,
  bills_min_aed int check (bills_min_aed is null or bills_min_aed >= 0),
  bills_max_aed int check (bills_max_aed is null or bills_max_aed >= 0),
  -- Student offers on the listing; student_rate_aed is the discounted rent per MONTH.
  student_deal_types text[] not null default '{}'
    check (student_deal_types <@ array['student_rate', 'deposit_waived', 'fees_waived', 'free_first_month', 'group_discount']::text[]),
  student_rate_aed int check (student_rate_aed is null or student_rate_aed > 0),
  -- Other students already living there (rooms); null when unknown.
  housemates int check (housemates is null or housemates between 0 and 10),
  -- [{"university": "...", "minutes": 18, "mode": "bus"}], curated by the team.
  commutes jsonb not null default '[]'::jsonb check (jsonb_typeof(commutes) = 'array'),
  constraint residences_bills_range check (
    (bills_min_aed is null) = (bills_max_aed is null)
    and (bills_min_aed is null or bills_max_aed >= bills_min_aed)
  ),
  constraint residences_bedrooms_match_type check (
    (listing_type = 'home' and bedrooms is not null and bedrooms between 1 and 3)
    or (listing_type <> 'home' and bedrooms is null)
  )
);
alter table residences enable row level security;
create policy "Active residences are viewable by everyone" on residences for select using (is_active or public.is_admin());
create policy "Admins can create residences" on residences for insert with check (public.is_admin());
create policy "Admins can update residences" on residences for update using (public.is_admin());
create policy "Admins can delete residences" on residences for delete using (public.is_admin());

create table room_types (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid references residences(id) on delete cascade not null,
  name text not null,
  price_aed integer not null check (price_aed > 0),
  billing_period text not null check (billing_period in ('year', 'semester', 'month')),
  occupancy int not null default 1 check (occupancy between 1 and 6),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
alter table room_types enable row level security;
-- A room is visible only when its listing is (the residences policy shows active listings, and admins all).
create policy "Room types follow their listing's visibility" on room_types for select using (
  exists (select 1 from residences r where r.id = room_types.residence_id)
);
create policy "Admins can create room types" on room_types for insert with check (public.is_admin());
create policy "Admins can update room types" on room_types for update using (public.is_admin());
create policy "Admins can delete room types" on room_types for delete using (public.is_admin());
create index room_types_residence_idx on room_types (residence_id);

-- Commercial terms live apart from residences so students (who can read
-- every residence row) never see the fee or the partner's contacts.
create table residence_partner_terms (
  residence_id uuid primary key references residences(id) on delete cascade,
  referral_fee_percent numeric(5, 2) not null check (referral_fee_percent >= 0 and referral_fee_percent <= 100),
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  updated_at timestamptz default now()
);
alter table residence_partner_terms enable row level security;
create policy "Admins can view partner terms" on residence_partner_terms for select using (public.is_admin());
create policy "Admins can create partner terms" on residence_partner_terms for insert with check (public.is_admin());
create policy "Admins can update partner terms" on residence_partner_terms for update using (public.is_admin());
create policy "Admins can delete partner terms" on residence_partner_terms for delete using (public.is_admin());

create table saved_residences (
  user_id uuid references profiles(id) on delete cascade,
  residence_id uuid references residences(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, residence_id)
);
alter table saved_residences enable row level security;
create policy "Users can view their saved residences" on saved_residences for select using (auth.uid() = user_id);
create policy "Users can save residences" on saved_residences for insert with check (auth.uid() = user_id);
create policy "Users can unsave residences" on saved_residences for delete using (auth.uid() = user_id);

create table housing_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  residence_id uuid references residences(id) on delete cascade not null,
  room_type_id uuid references room_types(id) on delete set null,
  kind text not null check (kind in ('question', 'viewing')),
  -- Always the first of a month — students plan around a term start, not
  -- an exact day.
  move_in_month date not null,
  duration_months int not null check (duration_months between 1 and 24),
  budget_aed int check (budget_aed > 0),
  -- The residence needs a way to reach the student, and Supabase auth
  -- emails aren't readable from the client — so the student gives one here.
  contact_phone text not null,
  message text,
  preferred_viewing text,
  status text not null default 'new' check (status in ('new', 'contacted', 'viewing_booked', 'signed', 'lost')),
  contract_value_aed numeric(12, 2) check (contract_value_aed > 0),
  -- Snapshotted when the enquiry is marked signed, so a later change to a
  -- residence's fee % never rewrites what an existing deal is owed.
  referral_fee_aed numeric(12, 2),
  fee_paid_at timestamptz,
  status_updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table housing_enquiries enable row level security;
create policy "Users can view their own enquiries, admins all" on housing_enquiries for select using (
  auth.uid() = user_id or public.is_admin()
);
-- A student can only ever create a fresh enquiry — status and money fields
-- are set exclusively through the admin RPCs below.
create policy "Users can create their own enquiries" on housing_enquiries for insert with check (
  auth.uid() = user_id and status = 'new' and contract_value_aed is null
  and referral_fee_aed is null and fee_paid_at is null
);
create index housing_enquiries_user_idx on housing_enquiries (user_id);
create index housing_enquiries_status_idx on housing_enquiries (status);

-- Moves an enquiry through the pipeline. Marking it signed requires the
-- contract value and computes the referral fee from the residence's
-- current terms; moving it off 'signed' clears both so the totals stay true.
-- Signed deals keep their money record: see 20261106140000_protect_signed_deal_money.sql.
create or replace function public.set_enquiry_status(
  enquiry_id_input uuid,
  status_input text,
  contract_value_input numeric default null
)
returns housing_enquiries
language plpgsql
security definer set search_path = public
as $$
declare
  enquiry housing_enquiries%rowtype;
  fee_percent numeric;
  new_fee numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can update enquiries.';
  end if;
  if status_input not in ('new', 'contacted', 'viewing_booked', 'signed', 'lost') then
    raise exception 'Unknown status: %', status_input;
  end if;

  select * into enquiry from housing_enquiries where id = enquiry_id_input;
  if enquiry.id is null then
    raise exception 'This enquiry no longer exists.';
  end if;

  if status_input = 'signed' then
    if contract_value_input is null or contract_value_input <= 0 then
      raise exception 'Enter the contract value to mark this as signed.';
    end if;

    if enquiry.status = 'signed' and enquiry.referral_fee_aed is not null and enquiry.contract_value_aed is not null then
      -- Already signed: keep the fee as snapshotted unless the contract
      -- value itself changed, and then only at the rate it was signed at.
      if contract_value_input = enquiry.contract_value_aed then
        new_fee := enquiry.referral_fee_aed;
      else
        if enquiry.fee_paid_at is not null then
          raise exception 'This deal''s fee is marked as paid, so its contract value can''t be changed. Mark the fee as unpaid first.';
        end if;
        new_fee := round(contract_value_input * enquiry.referral_fee_aed / enquiry.contract_value_aed, 2);
      end if;
    else
      select referral_fee_percent into fee_percent from residence_partner_terms where residence_id = enquiry.residence_id;
      if fee_percent is null then
        raise exception 'Set this residence''s referral fee percentage first.';
      end if;
      new_fee := round(contract_value_input * fee_percent / 100, 2);
    end if;

    update housing_enquiries set
      status = 'signed',
      contract_value_aed = contract_value_input,
      referral_fee_aed = new_fee,
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  else
    if enquiry.status = 'signed' and enquiry.fee_paid_at is not null then
      raise exception 'This deal is signed and its fee is marked as paid. Mark the fee as unpaid before changing the status.';
    end if;
    update housing_enquiries set
      status = status_input,
      contract_value_aed = null,
      referral_fee_aed = null,
      fee_paid_at = null,
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  end if;

  return enquiry;
end;
$$;
grant execute on function public.set_enquiry_status(uuid, text, numeric) to authenticated;

create or replace function public.set_referral_fee_paid(enquiry_id_input uuid, paid boolean)
returns housing_enquiries
language plpgsql
security definer set search_path = public
as $$
declare
  enquiry housing_enquiries%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can update enquiries.';
  end if;
  update housing_enquiries set fee_paid_at = case when paid then now() else null end
  where id = enquiry_id_input and status = 'signed'
  returning * into enquiry;
  if enquiry.id is null then
    raise exception 'Only a signed enquiry can be marked as paid.';
  end if;
  return enquiry;
end;
$$;
grant execute on function public.set_referral_fee_paid(uuid, boolean) to authenticated;

insert into storage.buckets (id, name, public) values ('residence-photos', 'residence-photos', true)
on conflict (id) do nothing;
create policy "Residence photos are publicly viewable" on storage.objects for select using (bucket_id = 'residence-photos');
create policy "Admins can upload residence photos" on storage.objects for insert with check (
  bucket_id = 'residence-photos' and public.is_admin()
);
create policy "Admins can update residence photos" on storage.objects for update using (
  bucket_id = 'residence-photos' and public.is_admin()
);
create policy "Admins can delete residence photos" on storage.objects for delete using (
  bucket_id = 'residence-photos' and public.is_admin()
);

-- Saving a residence touches three tables (the listing, its room types,
-- and the private partner terms). Done as separate client writes, a
-- failure partway through left a half-saved listing behind, and retrying
-- the form then inserted a duplicate residence. One function means one
-- transaction: it all saves, or nothing does.
create or replace function public.save_residence(
  residence_id_input uuid,
  residence jsonb,
  rooms jsonb,
  terms jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  rid uuid := residence_id_input;
  room jsonb;
  kept_ids uuid[];
  idx int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can edit residences.';
  end if;

  if rid is null then
    insert into residences (
      name, provider_name, area, address, latitude, longitude, description,
      gender_policy, amenities, nearby_universities, photo_urls, is_active,
      listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, verified_at, permit_number,
      bills_included, bills_min_aed, bills_max_aed, student_deal_types, student_rate_aed, housemates, commutes
    ) values (
      residence->>'name', residence->>'provider_name', residence->>'area', residence->>'address',
      (residence->>'latitude')::double precision, (residence->>'longitude')::double precision,
      residence->>'description', coalesce(residence->>'gender_policy', 'mixed'),
      array(select jsonb_array_elements_text(coalesce(residence->'amenities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'nearby_universities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'photo_urls', '[]'::jsonb))),
      coalesce((residence->>'is_active')::boolean, true),
      coalesce(residence->>'listing_type', 'residence'),
      (residence->>'bedrooms')::int,
      (residence->>'deposit_aed')::int,
      (residence->>'move_in_fee_aed')::int,
      coalesce((residence->>'is_verified')::boolean, false),
      case when coalesce((residence->>'is_verified')::boolean, false) then now() else null end,
      nullif(trim(residence->>'permit_number'), ''),
      (residence->>'bills_included')::boolean,
      (residence->>'bills_min_aed')::int,
      (residence->>'bills_max_aed')::int,
      array(select jsonb_array_elements_text(coalesce(residence->'student_deal_types', '[]'::jsonb))),
      (residence->>'student_rate_aed')::int,
      (residence->>'housemates')::int,
      coalesce(residence->'commutes', '[]'::jsonb)
    )
    returning id into rid;
  else
    update residences set
      name = residence->>'name',
      provider_name = residence->>'provider_name',
      area = residence->>'area',
      address = residence->>'address',
      latitude = (residence->>'latitude')::double precision,
      longitude = (residence->>'longitude')::double precision,
      description = residence->>'description',
      gender_policy = coalesce(residence->>'gender_policy', 'mixed'),
      amenities = array(select jsonb_array_elements_text(coalesce(residence->'amenities', '[]'::jsonb))),
      nearby_universities = array(select jsonb_array_elements_text(coalesce(residence->'nearby_universities', '[]'::jsonb))),
      photo_urls = array(select jsonb_array_elements_text(coalesce(residence->'photo_urls', '[]'::jsonb))),
      is_active = coalesce((residence->>'is_active')::boolean, true),
      listing_type = coalesce(residence->>'listing_type', listing_type),
      bedrooms = case when residence ? 'bedrooms' then (residence->>'bedrooms')::int else bedrooms end,
      deposit_aed = case when residence ? 'deposit_aed' then (residence->>'deposit_aed')::int else deposit_aed end,
      move_in_fee_aed = case when residence ? 'move_in_fee_aed' then (residence->>'move_in_fee_aed')::int else move_in_fee_aed end,
      permit_number = case when residence ? 'permit_number' then nullif(trim(residence->>'permit_number'), '') else permit_number end,
      bills_included = case when residence ? 'bills_included' then (residence->>'bills_included')::boolean else bills_included end,
      bills_min_aed = case when residence ? 'bills_min_aed' then (residence->>'bills_min_aed')::int else bills_min_aed end,
      bills_max_aed = case when residence ? 'bills_max_aed' then (residence->>'bills_max_aed')::int else bills_max_aed end,
      student_deal_types = case when residence ? 'student_deal_types'
        then array(select jsonb_array_elements_text(coalesce(residence->'student_deal_types', '[]'::jsonb)))
        else student_deal_types end,
      student_rate_aed = case when residence ? 'student_rate_aed' then (residence->>'student_rate_aed')::int else student_rate_aed end,
      housemates = case when residence ? 'housemates' then (residence->>'housemates')::int else housemates end,
      commutes = case when residence ? 'commutes' then coalesce(residence->'commutes', '[]'::jsonb) else commutes end,
      -- Stamp the time the first time it becomes verified; clear it when it stops.
      is_verified = coalesce((residence->>'is_verified')::boolean, is_verified),
      verified_at = case
        when coalesce((residence->>'is_verified')::boolean, is_verified)
          then coalesce(verified_at, now())
        else null
      end
    where id = rid;
    if not found then
      raise exception 'This residence no longer exists.';
    end if;
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}') into kept_ids
  from jsonb_array_elements(coalesce(rooms, '[]'::jsonb)) r
  where r->>'id' is not null;
  delete from room_types where residence_id = rid and not (id = any(kept_ids));

  for room in select value from jsonb_array_elements(coalesce(rooms, '[]'::jsonb)) loop
    if room->>'id' is not null then
      update room_types set
        name = room->>'name',
        price_aed = (room->>'price_aed')::int,
        billing_period = room->>'billing_period',
        occupancy = (room->>'occupancy')::int,
        is_available = (room->>'is_available')::boolean,
        sort_order = idx
      where id = (room->>'id')::uuid and residence_id = rid;
    else
      insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
      values (
        rid, room->>'name', (room->>'price_aed')::int, room->>'billing_period',
        (room->>'occupancy')::int, (room->>'is_available')::boolean, idx
      );
    end if;
    idx := idx + 1;
  end loop;

  insert into residence_partner_terms (residence_id, referral_fee_percent, contact_name, contact_email, contact_phone, notes, updated_at)
  values (
    rid, (terms->>'referral_fee_percent')::numeric, terms->>'contact_name', terms->>'contact_email',
    terms->>'contact_phone', terms->>'notes', now()
  )
  on conflict (residence_id) do update set
    referral_fee_percent = excluded.referral_fee_percent,
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    notes = excluded.notes,
    updated_at = now();

  return rid;
end;
$$;
revoke execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;

-- ==================== HOUSING NOTIFICATIONS ====================
-- A lead goes cold fast: the team hears about a new enquiry the moment
-- it's sent, and the student hears back whenever it moves forward. Same
-- trigger-only pattern as follow/like/comment notifications, so neither
-- kind can be created or spoofed from the client.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'ping', 'enquiry_new', 'enquiry_status'));
alter table notifications add column enquiry_id uuid references housing_enquiries(id) on delete cascade;
-- What the enquiry moved to at the time, so the notification still reads
-- correctly after it moves on again ("Viewing booked", later "Signed").
alter table notifications add column enquiry_status text;

create or replace function public.notify_admins_on_enquiry()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into notifications (recipient_id, actor_id, type, enquiry_id)
  select p.id, new.user_id, 'enquiry_new', new.id
  from profiles p
  where p.is_admin = true and p.id <> new.user_id;
  return new;
end;
$$;

create trigger on_enquiry_notify_admins
  after insert on housing_enquiries
  for each row execute procedure public.notify_admins_on_enquiry();

-- Only the steps a student actually wants to hear about. 'lost' is left
-- out on purpose — the team can follow up personally instead of the app
-- announcing it.
create or replace function public.notify_student_on_enquiry_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('contacted', 'viewing_booked', 'signed') then
    insert into notifications (recipient_id, actor_id, type, enquiry_id, enquiry_status)
    values (new.user_id, coalesce(auth.uid(), new.user_id), 'enquiry_status', new.id, new.status);
  end if;
  return new;
end;
$$;

create trigger on_enquiry_status_notify_student
  after update of status on housing_enquiries
  for each row execute procedure public.notify_student_on_enquiry_status();

-- ==================== KEEP SIGNED REFERRALS ON ACCOUNT DELETION ====================
-- Deleting an account used to cascade away every housing enquiry the
-- student made, including signed ones — which are Havenly's only record of
-- what a residence owes. Now unsigned enquiries are still deleted with the
-- account, but a signed one is kept with everything that identifies the
-- student removed: the residence, room, dates, contract value and fee stay
-- so the referral fee can still be invoiced.
alter table housing_enquiries drop constraint housing_enquiries_user_id_fkey;
alter table housing_enquiries alter column user_id drop not null;
alter table housing_enquiries add constraint housing_enquiries_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;
alter table housing_enquiries alter column contact_phone drop not null;

create or replace function public.anonymise_enquiries_on_profile_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from housing_enquiries where user_id = old.id and status <> 'signed';
  update housing_enquiries set
    contact_phone = null,
    message = null,
    preferred_viewing = null,
    budget_aed = null
  where user_id = old.id and status = 'signed';
  -- user_id itself is cleared by the foreign key's ON DELETE SET NULL.
  return old;
end;
$$;

create trigger on_profile_delete_anonymise_enquiries
  before delete on profiles
  for each row execute procedure public.anonymise_enquiries_on_profile_delete();

-- An anonymised enquiry has no student to tell, and a notification with no
-- recipient would fail the insert — which would block the team from ever
-- changing that enquiry's status again.
create or replace function public.notify_student_on_enquiry_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.user_id is not null
     and new.status is distinct from old.status
     and new.status in ('contacted', 'viewing_booked', 'signed') then
    insert into notifications (recipient_id, actor_id, type, enquiry_id, enquiry_status)
    values (new.user_id, coalesce(auth.uid(), new.user_id), 'enquiry_status', new.id, new.status);
  end if;
  return new;
end;
$$;

-- A residence with signed deals can't be deleted (they're the only record of
-- what it owes); set it inactive instead. See
-- 20261106130000_protect_signed_deals_from_residence_delete.sql.
create or replace function public.block_delete_residence_with_signed_deals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from housing_enquiries where residence_id = old.id and status = 'signed') then
    raise exception 'This residence has signed deals, so it can''t be deleted. Set it to inactive instead.';
  end if;
  return old;
end;
$$;

create trigger block_delete_residence_with_signed_deals
  before delete on residences
  for each row execute procedure public.block_delete_residence_with_signed_deals();

-- A member can leave a group (20261106160000_leave_group.sql). Their earlier
-- messages stay; fewer than two members left deletes the group.
create or replace function public.leave_group(conversation_id_input uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  convo conversations%rowtype;
  remaining uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into convo from conversations where id = conversation_id_input;
  if convo.id is null or not convo.is_group or not (uid = any(convo.participant_ids)) then
    raise exception 'You''re not in this group.';
  end if;

  remaining := array_remove(convo.participant_ids, uid);
  delete from conversation_reads where conversation_id = convo.id and user_id = uid;
  delete from conversation_hidden_for where conversation_id = convo.id and user_id = uid;

  if coalesce(array_length(remaining, 1), 0) < 2 then
    delete from conversations where id = convo.id;
  else
    update conversations set
      participant_ids = remaining,
      initiator_id = case when initiator_id = uid then null else initiator_id end
    where id = convo.id;
  end if;
end;
$$;
grant execute on function public.leave_group(uuid) to authenticated;
