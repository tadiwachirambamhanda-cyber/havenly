-- Fixes from the Codex review of the v2 community migration (plans/2026-11-25-v2-foundation.md, "Codex review").

-- 1. Memberships are private: a student sees only their own (member counts come from communities.member_count).
drop policy "Signed-in students see memberships" on public.community_members;
create policy "Students see their own memberships, the team all" on public.community_members
  for select to authenticated using (auth.uid() = user_id or private.is_admin());

-- 2. A comment is visible only while its post is (row security on posts applies inside the check:
--    hidden and blocked posts take their comments with them).
drop policy "Signed-in students see comments that are not hidden" on public.comments;
create policy "Signed-in students see comments that are not hidden" on public.comments
  for select to authenticated using (
    not private.is_blocked_between(auth.uid(), author_id)
    and (hidden_at is null or author_id = auth.uid() or private.is_admin())
    and exists (select 1 from posts p where p.id = comments.post_id)
  );

-- 3. The 20-community limit holds even when two joins arrive at once: joins by the same student wait for
--    each other, then count.
create function private.membership_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('community_members:' || new.user_id::text));
  if (select count(*) from community_members where user_id = new.user_id) >= 20 then
    raise exception 'You can be in up to 20 communities. Leave one to join another.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger community_members_limit before insert on public.community_members
  for each row execute function private.membership_limit();

-- 4. A report counts towards hiding only if the reporter's account was at least a day old WHEN they reported,
--    so reports from fresh accounts never start counting later.
create or replace function public.report_item(p_type text, p_id uuid, p_reason text)
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

  select count(distinct r.reporter_id) into counted
  from reports r join profiles pr on pr.id = r.reporter_id
  where r.target_type = p_type and r.target_id = p_id and r.status = 'pending'
    and pr.created_at <= r.created_at - interval '1 day';
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
