-- Codex review round 2 (plans/2026-11-25-v2-foundation.md): reports on the same item arriving at the same
-- moment could each count before seeing the others, so a third report might not hide it. They now wait for
-- each other per item.

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

  -- Reports on the same item wait for each other, so the count below always sees the earlier ones.
  perform pg_advisory_xact_lock(hashtext('report:' || p_type || ':' || p_id::text));

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
