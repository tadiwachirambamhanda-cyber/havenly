-- Private profile fields: gender, budget, move-in month and housemate preference.
--
-- Profiles are readable by everyone (names and photos are shown around the app), so these four fields must not
-- live on that table: anyone could have read another student's gender or budget directly and bypassed the
-- matching rule. They move to their own table that only the student can read and write. The housemate board
-- and the team's review function read them with security definer, after applying the rules.

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  budget_aed int check (budget_aed between 1 and 100000),
  move_in_month date check (move_in_month = date_trunc('month', move_in_month)::date),
  housemate_pref text check (housemate_pref in ('any', 'female_only', 'male_only')),
  gender text check (gender in ('female', 'male')),
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
create policy "Students read their own private profile" on public.profile_private
  for select using (auth.uid() = user_id);
create policy "Students create their own private profile" on public.profile_private
  for insert with check (auth.uid() = user_id);
create policy "Students edit their own private profile" on public.profile_private
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.profile_private from anon, authenticated;
grant select on public.profile_private to authenticated;
grant insert (user_id, budget_aed, move_in_month, housemate_pref, gender) on public.profile_private to authenticated;
grant update (budget_aed, move_in_month, housemate_pref, gender) on public.profile_private to authenticated;

-- Keep anything already saved.
insert into public.profile_private (user_id, budget_aed, move_in_month, housemate_pref, gender)
select id, budget_aed, move_in_month, housemate_pref, gender from public.profiles
where budget_aed is not null or move_in_month is not null or housemate_pref is not null or gender is not null;

-- The matching rule, now reading the private table. A student with no row has no gender and no preference:
-- only "anyone" matches.
create or replace function private.housemate_compatible(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (o.housemate_pref is null or o.housemate_pref = 'any'
      or (o.housemate_pref = 'female_only' and v.gender = 'female')
      or (o.housemate_pref = 'male_only' and v.gender = 'male'))
    and
    (v.housemate_pref is null or v.housemate_pref = 'any'
      or (v.housemate_pref = 'female_only' and o.gender = 'female')
      or (v.housemate_pref = 'male_only' and o.gender = 'male')),
    false)
  from profiles vp
  left join profile_private v on v.user_id = vp.id
  cross join profiles op
  left join profile_private o on o.user_id = op.id
  where vp.id = viewer and op.id = owner;
$$;

create or replace function private.housemate_card_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b int;
  m date;
  home_ok boolean;
begin
  new.updated_at := now();

  if new.residence_id is not null then
    select (listing_type = 'home' and is_active) into home_ok from residences where id = new.residence_id;
    if home_ok is distinct from true then
      raise exception 'A housemate card can only be tied to a whole home that is listed.' using errcode = 'check_violation';
    end if;
  end if;

  if new.active and (tg_op = 'INSERT' or old.active is distinct from new.active or not private.is_admin()) then
    select budget_aed, move_in_month into b, m from profile_private where user_id = new.user_id;
    if b is null or m is null then
      raise exception 'Set your monthly budget and move-in month in Edit profile first.' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and not private.is_admin()
     and (new.area is distinct from old.area or new.lifestyle is distinct from old.lifestyle
          or new.note is distinct from old.note or new.residence_id is distinct from old.residence_id) then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create or replace function public.housemate_board(
  p_university text default null,
  p_max_budget int default null,
  p_move_in date default null,
  p_area text default null,
  p_residence uuid default null
)
returns table (
  user_id uuid, display_name text, university text, gender text, budget_aed int, move_in_month date,
  area text, lifestyle text[], note text, residence_id uuid, residence_name text, spots_needed int, updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.user_id, p.display_name, p.university, pp.gender, pp.budget_aed, pp.move_in_month,
         c.area, c.lifestyle, c.note,
         case when r.is_active and r.listing_type = 'home' then c.residence_id end,
         case when r.is_active and r.listing_type = 'home' then r.name end,
         case when r.is_active and r.listing_type = 'home' then c.spots_needed end,
         c.updated_at
  from housemate_cards c
  join profiles p on p.id = c.user_id
  join profile_private pp on pp.user_id = c.user_id
  left join residences r on r.id = c.residence_id
  where auth.uid() is not null
    and c.status = 'approved' and c.active
    and c.user_id <> auth.uid()
    and pp.budget_aed is not null and pp.move_in_month is not null
    and not private.is_blocked_between(auth.uid(), c.user_id)
    and private.housemate_compatible(auth.uid(), c.user_id)
    and (p_university is null or p.university = p_university)
    and (p_max_budget is null or pp.budget_aed <= p_max_budget)
    and (p_move_in is null or pp.move_in_month = p_move_in)
    and (p_area is null or c.area ilike '%' || p_area || '%')
    and (p_residence is null or (c.residence_id = p_residence and r.is_active and r.listing_type = 'home'))
  order by c.updated_at desc
  limit 100;
$$;

-- The team's queue: pending cards with the fields needed to check them. Admins only.
create or replace function public.pending_housemate_cards()
returns table (
  user_id uuid, display_name text, university text, gender text, budget_aed int, move_in_month date,
  area text, lifestyle text[], note text, active boolean, residence_name text, spots_needed int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can review housemate cards.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select c.user_id, p.display_name, p.university, pp.gender, pp.budget_aed, pp.move_in_month,
         c.area, c.lifestyle, c.note, c.active, r.name, c.spots_needed
  from housemate_cards c
  join profiles p on p.id = c.user_id
  left join profile_private pp on pp.user_id = c.user_id
  left join residences r on r.id = c.residence_id
  where c.status = 'pending'
  order by c.updated_at asc;
end;
$$;
revoke all on function public.pending_housemate_cards() from public, anon;
grant execute on function public.pending_housemate_cards() to authenticated;

-- Last: take the private fields off the publicly readable table (also drops their checks and column grants).
alter table public.profiles
  drop column budget_aed,
  drop column move_in_month,
  drop column housemate_pref,
  drop column gender;
