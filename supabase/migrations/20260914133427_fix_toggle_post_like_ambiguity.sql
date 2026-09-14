-- RETURNS TABLE (..., like_count int) implicitly declares `like_count` as a
-- plpgsql variable in the function body, which collided with the unqualified
-- posts.like_count column in the UPDATE statements below ("column reference
-- 'like_count' is ambiguous") and made every like/unlike fail at runtime.
-- Fix: qualify every reference to the table column as posts.like_count.
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
