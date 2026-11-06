-- like_count was kept in step only by the toggle_post_like function, while
-- users could also insert/delete post_likes rows directly (RLS allowed
-- their own). Deleting your own like row directly left the count
-- unchanged, so toggling through the function afterwards added +1 again,
-- inflating any post without limit. Deleting an account cascade-deleted
-- that user's likes with no decrement, leaving every post they liked
-- permanently inflated.
--
-- Now the count is driven by a trigger on post_likes, so every insert or
-- delete (including cascades) adjusts it exactly once, and clients can no
-- longer write post_likes directly: liking goes through toggle_post_like.
drop policy "Users can like posts" on public.post_likes;
drop policy "Users can unlike posts" on public.post_likes;
revoke insert, update, delete on public.post_likes from authenticated, anon;

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
  after insert or delete on public.post_likes
  for each row execute procedure public.sync_post_like_count();

-- The trigger now owns the counter, so the function only changes the row.
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

-- Bring any drifted counts back to the real number of like rows.
update public.posts p
set like_count = (select count(*) from public.post_likes l where l.post_id = p.id)
where like_count <> (select count(*) from public.post_likes l where l.post_id = p.id);
