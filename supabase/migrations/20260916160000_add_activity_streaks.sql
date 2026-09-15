-- Daily activity streak — how many consecutive days in a row someone has
-- opened the app. last_active_date is the UTC date (matching the daily-pick
-- feature's own day-boundary convention) bump_streak() last extended the
-- streak for; current_streak resets to 1 whenever a day gets skipped.
alter table profiles add column current_streak int not null default 0;
alter table profiles add column longest_streak int not null default 0;
alter table profiles add column last_active_date date;

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
