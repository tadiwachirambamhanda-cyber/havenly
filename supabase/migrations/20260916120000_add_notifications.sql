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

-- Needed for the nav bar's unread badge to update live, same as messages/
-- conversations/conversation_reads.
alter publication supabase_realtime add table notifications;
