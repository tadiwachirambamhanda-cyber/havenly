-- communities.member_count was a static seeded number with nothing keeping
-- it in sync with community_members — joining or leaving a community never
-- changed the number shown, ever. Same bug class as like_count/comment_count
-- before those got triggers; this is the same fix. Existing seeded values
-- are left as-is (they represent a starting size) and now grow/shrink from
-- there as real joins/leaves happen.
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
