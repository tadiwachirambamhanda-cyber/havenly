-- Havenly v2 community (plans/2026-11-25-v2-foundation.md): communities anyone can join, posts inside
-- communities with photos and area tags, reports with auto-hide and a team review queue, events with
-- Going, and perk codes without streaks. Old rows are kept as they are.

-- ===== Joining and reading =====
-- Anyone signed in may join any community, up to 20 at once (the old rule allowed only your own
-- university's campus community).
create function private.membership_count(uid uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int from community_members where user_id = uid;
$$;
revoke all on function private.membership_count(uuid) from public, anon, authenticated;
grant execute on function private.membership_count(uuid) to authenticated;

drop policy "Users can join communities" on public.community_members;
create policy "Students can join any community, up to 20" on public.community_members
  for insert to authenticated with check (auth.uid() = user_id and private.membership_count(auth.uid()) < 20);

drop policy "Memberships are viewable by everyone" on public.community_members;
create policy "Signed-in students see memberships" on public.community_members
  for select to authenticated using (true);

-- ===== Posts =====
alter table public.posts
  add column image_paths text[],
  add column area text check (area is null or char_length(area) between 2 and 60),
  add column residence_id uuid references public.residences(id) on delete set null,
  add column hidden_at timestamptz;
-- v2 posts are text and photos, with no title or tag (old posts keep theirs).
alter table public.posts alter column title drop not null;
alter table public.posts alter column tag set default 'community';
alter table public.posts add constraint posts_body_length check (body is not null and char_length(body) between 1 and 2000) not valid;

-- Photos are object paths in the post-images store, each inside the author's own folder, 4 at most.
create function private.post_images_ok(paths text[], author uuid)
returns boolean
language sql
immutable
as $$
  select paths is null or (
    cardinality(paths) <= 4
    and not exists (
      select 1 from unnest(paths) p
      where p not like author::text || '/%' or p like '%..%' or char_length(p) > 200
    )
  );
$$;
revoke all on function private.post_images_ok(text[], uuid) from public, anon;
grant execute on function private.post_images_ok(text[], uuid) to authenticated;
alter table public.posts add constraint posts_image_paths_ok check (private.post_images_ok(image_paths, author_id));
create index if not exists posts_community_created_idx on public.posts (community_id, created_at desc);
create index posts_area_idx on public.posts (lower(area)) where area is not null;
create index posts_residence_idx on public.posts (residence_id) where residence_id is not null;

-- Seen by signed-in students only; a hidden post only by its author and the team.
drop policy "Posts are viewable unless blocked" on public.posts;
create policy "Signed-in students see posts that are not hidden" on public.posts
  for select to authenticated using (
    not private.is_blocked_between(auth.uid(), author_id)
    and (hidden_at is null or author_id = auth.uid() or private.is_admin())
  );

-- New posts only inside a community you have joined. Old posts without a community stay as they are.
drop policy "Users can create their own posts" on public.posts;
create policy "Members post in their communities" on public.posts
  for insert to authenticated with check (
    auth.uid() = author_id
    and is_editorial = false
    and hidden_at is null
    and community_id is not null
    and exists (select 1 from community_members m where m.community_id = posts.community_id and m.user_id = auth.uid())
  );

-- ===== Comments and likes =====
alter table public.comments add column hidden_at timestamptz;
alter table public.comments add constraint comments_body_length check (char_length(body) between 1 and 1000) not valid;

drop policy "Comments are viewable unless blocked" on public.comments;
create policy "Signed-in students see comments that are not hidden" on public.comments
  for select to authenticated using (
    not private.is_blocked_between(auth.uid(), author_id)
    and (hidden_at is null or author_id = auth.uid() or private.is_admin())
  );

drop policy "Users can add comments" on public.comments;
create policy "Students comment on posts they can see" on public.comments
  for insert to authenticated with check (
    auth.uid() = author_id
    and hidden_at is null
    and exists (select 1 from posts p where p.id = comments.post_id and p.hidden_at is null)
  );

drop policy "Likes are viewable by everyone" on public.post_likes;
create policy "Signed-in students see likes" on public.post_likes
  for select to authenticated using (true);

-- The like function skips row security, so it checks itself that the post can be seen.
create or replace function public.toggle_post_like(post_id_input uuid)
returns table(liked boolean, like_count integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  already_liked boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from posts p
    where p.id = post_id_input and p.hidden_at is null and not private.is_blocked_between(uid, p.author_id)
  ) then
    raise exception 'This post is no longer available.';
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

-- Posts for a listing page: tagged with the listing or its area, newest first. Runs with the caller's
-- rights, so row security still applies (signed-out visitors get nothing; hidden and blocked are left out).
create function public.area_posts(p_residence uuid, p_limit int default 3)
returns setof public.posts
language sql
stable
set search_path to 'public'
as $$
  select p.* from posts p
  join residences r on r.id = p_residence
  where (p.residence_id = r.id or (p.area is not null and lower(p.area) = lower(r.area)))
    and p.hidden_at is null
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;
revoke all on function public.area_posts(uuid, int) from public, anon;
grant execute on function public.area_posts(uuid, int) to authenticated;

-- ===== Events =====
alter table public.events
  add column community_id uuid references public.communities(id) on delete cascade,
  add column hidden_at timestamptz,
  add column going_count int not null default 0;

drop policy "Events are viewable by everyone" on public.events;
create policy "Signed-in students see events that are not hidden" on public.events
  for select to authenticated using (hidden_at is null or private.is_admin());
create policy "Admins can update events" on public.events
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- Going: one row per student per event. Each student sees only their own rows; the count is on the event.
create table public.event_going (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_going enable row level security;
create policy "Students see their own Going" on public.event_going
  for select to authenticated using (auth.uid() = user_id);
create policy "Students say they are going to a visible event" on public.event_going
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from events e where e.id = event_going.event_id and e.hidden_at is null)
  );
create policy "Students take back their Going" on public.event_going
  for delete to authenticated using (auth.uid() = user_id);
revoke all on public.event_going from anon;

create function private.sync_event_going_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    update events set going_count = going_count + 1 where id = new.event_id;
  else
    update events set going_count = greatest(going_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end;
$$;
create trigger event_going_count after insert or delete on public.event_going
  for each row execute function private.sync_event_going_count();

-- ===== Perks =====
-- Same function name and result as before; the activity-streak rule is gone.
create or replace function public.claim_offer(offer_id_input uuid)
returns table(code text, already_claimed boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  offer_row offers%rowtype;
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

  select oc.code into existing_code from offer_claims oc where oc.offer_id = offer_id_input and oc.user_id = uid;
  if existing_code is not null then
    return query select existing_code, true;
    return;
  end if;

  -- Short, human-typeable code that staff read off the student's screen.
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into offer_claims (offer_id, user_id, code) values (offer_id_input, uid, new_code)
  on conflict (offer_id, user_id) do nothing;
  return query select oc.code, oc.code <> new_code from offer_claims oc where oc.offer_id = offer_id_input and oc.user_id = uid;
end;
$$;

-- ===== Reports =====
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'user', 'message', 'community', 'comment', 'event'));
create unique index reports_one_per_student on public.reports (reporter_id, target_type, target_id)
  where target_type in ('post', 'comment', 'event');

-- Users and messages are still reported directly (Chat, housemates). Posts, comments and events go
-- through report_item below, which checks them.
drop policy "Users can create reports" on public.reports;
create policy "Students report people and messages" on public.reports
  for insert to authenticated with check (auth.uid() = reporter_id and target_type in ('user', 'message'));

create function public.report_item(p_type text, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  found boolean;
  counted int;
begin
  if uid is null then
    raise exception 'Sign in to report something.' using errcode = 'insufficient_privilege';
  end if;
  if p_reason not in ('spam', 'harassment', 'hate', 'inappropriate', 'scam', 'not_student_life', 'other') then
    raise exception 'Choose a reason for the report.' using errcode = 'check_violation';
  end if;

  if p_type = 'post' then
    select true, author_id into found, owner from posts where id = p_id;
  elsif p_type = 'comment' then
    select true, author_id into found, owner from comments where id = p_id;
  elsif p_type = 'event' then
    select true, null::uuid into found, owner from events where id = p_id;
  else
    raise exception 'This cannot be reported here.' using errcode = 'check_violation';
  end if;
  if not coalesce(found, false) then
    raise exception 'This is no longer available.' using errcode = 'no_data_found';
  end if;
  if owner = uid then
    raise exception 'You cannot report your own post or comment.' using errcode = 'check_violation';
  end if;

  insert into reports (reporter_id, target_type, target_id, reason)
  values (uid, p_type, p_id, p_reason)
  on conflict (reporter_id, target_type, target_id) where target_type in ('post', 'comment', 'event') do nothing;

  -- Three different students with accounts older than a day: hide it until the team decides.
  select count(distinct r.reporter_id) into counted
  from reports r join profiles pr on pr.id = r.reporter_id
  where r.target_type = p_type and r.target_id = p_id and r.status = 'pending'
    and pr.created_at < now() - interval '1 day';
  if counted >= 3 then
    if p_type = 'post' then
      update posts set hidden_at = coalesce(hidden_at, now()) where id = p_id;
    elsif p_type = 'comment' then
      update comments set hidden_at = coalesce(hidden_at, now()) where id = p_id;
    else
      update events set hidden_at = coalesce(hidden_at, now()) where id = p_id;
    end if;
  end if;
end;
$$;
revoke all on function public.report_item(text, uuid, text) from public, anon;
grant execute on function public.report_item(text, uuid, text) to authenticated;

-- The team's queue: each reported post, comment or event with open reports. Never names the reporters.
create function public.review_queue()
returns table (
  target_type text, target_id uuid, reports int, reasons text[], hidden_at timestamptz,
  author_id uuid, author_name text, content text, community_name text, first_reported timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can review reports.' using errcode = 'insufficient_privilege';
  end if;
  return query
  with pending_items as (
    select r.target_type t, r.target_id i, count(distinct r.reporter_id)::int n,
           array_agg(distinct r.reason) rs, min(r.created_at) first_at
    from reports r
    where r.status = 'pending' and r.target_type in ('post', 'comment', 'event')
    group by r.target_type, r.target_id
  )
  select o.t, o.i, o.n, o.rs,
    coalesce(p.hidden_at, c.hidden_at, e.hidden_at),
    coalesce(p.author_id, c.author_id),
    pr.display_name,
    coalesce(p.body, p.title, c.body, e.title),
    coalesce(pc.name, cpc.name, ec.name),
    o.first_at
  from pending_items o
  left join posts p on o.t = 'post' and p.id = o.i
  left join comments c on o.t = 'comment' and c.id = o.i
  left join posts cp on c.post_id = cp.id
  left join events e on o.t = 'event' and e.id = o.i
  left join profiles pr on pr.id = coalesce(p.author_id, c.author_id)
  left join communities pc on pc.id = p.community_id
  left join communities cpc on cpc.id = cp.community_id
  left join communities ec on ec.id = e.community_id
  where coalesce(p.id, c.id, e.id) is not null
  order by (coalesce(p.hidden_at, c.hidden_at, e.hidden_at) is not null) desc, o.n desc, o.first_at;
end;
$$;
revoke all on function public.review_queue() from public, anon;
grant execute on function public.review_queue() to authenticated;

-- The team decides: hide (stays hidden, reports closed as actioned) or keep (visible, reports dismissed).
create function public.decide_report(p_type text, p_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can review reports.' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('hide', 'keep') or p_type not in ('post', 'comment', 'event') then
    raise exception 'Unknown decision.' using errcode = 'check_violation';
  end if;
  if p_type = 'post' then
    update posts set hidden_at = case when p_decision = 'hide' then coalesce(hidden_at, now()) end where id = p_id;
  elsif p_type = 'comment' then
    update comments set hidden_at = case when p_decision = 'hide' then coalesce(hidden_at, now()) end where id = p_id;
  else
    update events set hidden_at = case when p_decision = 'hide' then coalesce(hidden_at, now()) end where id = p_id;
  end if;
  update reports set status = case when p_decision = 'hide' then 'actioned' else 'dismissed' end
  where target_type = p_type and target_id = p_id and status = 'pending';
end;
$$;
revoke all on function public.decide_report(text, uuid, text) from public, anon;
grant execute on function public.decide_report(text, uuid, text) to authenticated;
