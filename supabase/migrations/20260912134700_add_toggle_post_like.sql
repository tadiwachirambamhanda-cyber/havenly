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
    update posts set like_count = greatest(like_count - 1, 0) where id = post_id_input;
  else
    insert into post_likes (post_id, user_id) values (post_id_input, uid);
    update posts set like_count = like_count + 1 where id = post_id_input;
  end if;

  return query select not already_liked, posts.like_count from posts where posts.id = post_id_input;
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;
