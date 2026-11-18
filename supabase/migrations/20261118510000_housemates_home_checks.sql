-- A housemate card may only show a home that is still a listed whole home. The save trigger checks this when a
-- card is written; these two functions check it again when cards are read, because a listing can change later.

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
  select c.user_id, p.display_name, p.university, p.gender, p.budget_aed, p.move_in_month,
         c.area, c.lifestyle, c.note,
         case when r.is_active and r.listing_type = 'home' then c.residence_id end,
         case when r.is_active and r.listing_type = 'home' then r.name end,
         case when r.is_active and r.listing_type = 'home' then c.spots_needed end,
         c.updated_at
  from housemate_cards c
  join profiles p on p.id = c.user_id
  left join residences r on r.id = c.residence_id
  where auth.uid() is not null
    and c.status = 'approved' and c.active
    and c.user_id <> auth.uid()
    and p.budget_aed is not null and p.move_in_month is not null
    and not private.is_blocked_between(auth.uid(), c.user_id)
    and private.housemate_compatible(auth.uid(), c.user_id)
    and (p_university is null or p.university = p_university)
    and (p_max_budget is null or p.budget_aed <= p_max_budget)
    and (p_move_in is null or p.move_in_month = p_move_in)
    and (p_area is null or c.area ilike '%' || p_area || '%')
    and (p_residence is null or (c.residence_id = p_residence and r.is_active and r.listing_type = 'home'))
  order by c.updated_at desc
  limit 100;
$$;

create or replace function public.housemates_for_home(p_residence uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int
  from housemate_cards c
  join residences r on r.id = c.residence_id and r.is_active and r.listing_type = 'home'
  where auth.uid() is not null
    and c.residence_id = p_residence and c.status = 'approved' and c.active
    and c.user_id <> auth.uid()
    and not private.is_blocked_between(auth.uid(), c.user_id)
    and private.housemate_compatible(auth.uid(), c.user_id);
$$;
