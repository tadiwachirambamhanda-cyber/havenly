-- Housemates: students who want to live together find each other.
--
-- Who sees whom is decided here, in the database, never in the app: a card is shown to a viewer only
-- if the owner's "who I would live with" choice accepts the viewer's gender AND the viewer's own choice
-- accepts the owner's gender. Nobody can read another student's card directly; they get the filtered
-- board from housemate_board() only.

-- 1. Optional gender on the profile, used only to match housemate preferences.
alter table public.profiles
  add column gender text check (gender in ('female', 'male'));
grant update (gender) on public.profiles to authenticated;

-- 2. One card per student.
create table public.housemate_cards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Set by the team (approve or hide), never by the student.
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  review_note text,
  active boolean not null default true,
  area text check (char_length(area) between 1 and 80),
  lifestyle text[] not null default '{}'
    check (cardinality(lifestyle) <= 5
      and lifestyle <@ array['early_riser', 'night_owl', 'studies_at_home', 'studies_out', 'non_smoker',
                             'smoker_ok', 'quiet', 'social', 'guests_ok', 'few_guests']::text[]),
  note text check (char_length(note) <= 280),
  -- Optional: the whole home this student is looking for housemates for.
  residence_id uuid references public.residences(id) on delete set null,
  spots_needed int check (spots_needed between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.housemate_cards enable row level security;

-- Students read and edit only their own card. The team reads all of them to review.
create policy "Students read their own housemate card" on public.housemate_cards
  for select using (auth.uid() = user_id or private.is_admin());
create policy "Students create their own housemate card" on public.housemate_cards
  for insert with check (auth.uid() = user_id);
create policy "Students edit their own housemate card" on public.housemate_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Students delete their own housemate card" on public.housemate_cards
  for delete using (auth.uid() = user_id);

-- Column limits: a student can never set status or review_note.
revoke all on public.housemate_cards from anon, authenticated;
grant select on public.housemate_cards to authenticated;
grant insert (user_id, active, area, lifestyle, note, residence_id, spots_needed) on public.housemate_cards to authenticated;
grant update (active, area, lifestyle, note, residence_id, spots_needed) on public.housemate_cards to authenticated;
grant delete on public.housemate_cards to authenticated;

-- 3. Rules that need other tables: checked by a trigger.
create or replace function private.housemate_card_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p profiles%rowtype;
  home_ok boolean;
begin
  new.updated_at := now();

  if new.residence_id is not null then
    select (listing_type = 'home' and is_active) into home_ok from residences where id = new.residence_id;
    if home_ok is distinct from true then
      raise exception 'A housemate card can only be tied to a whole home that is listed.' using errcode = 'check_violation';
    end if;
  end if;

  -- A live card needs the budget and move-in month saved on the profile (they are shown on the card).
  -- Checked when a student creates or edits it, not when the team approves it.
  if new.active and (tg_op = 'INSERT' or old.active is distinct from new.active or not private.is_admin()) then
    select * into p from profiles where id = new.user_id;
    if p.budget_aed is null or p.move_in_month is null then
      raise exception 'Set your monthly budget and move-in month in Edit profile first.' using errcode = 'check_violation';
    end if;
  end if;

  -- Changing what other students will read sends the card back to the team.
  if tg_op = 'UPDATE' and old.status = 'approved' and not private.is_admin()
     and (new.area is distinct from old.area or new.lifestyle is distinct from old.lifestyle
          or new.note is distinct from old.note or new.residence_id is distinct from old.residence_id) then
    new.status := 'pending';
  end if;
  return new;
end;
$$;
create trigger housemate_card_rules
  before insert or update on public.housemate_cards
  for each row execute function private.housemate_card_rules();

-- 4. The matching rule, both ways. No gender given means only "anyone" matches.
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
  from profiles v, profiles o
  where v.id = viewer and o.id = owner;
$$;

-- 5. The board: approved, live, compatible cards, not yours, no block either way.
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
         case when r.is_active then c.residence_id end,
         case when r.is_active then r.name end,
         c.spots_needed, c.updated_at
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
    and (p_residence is null or c.residence_id = p_residence)
  order by c.updated_at desc
  limit 100;
$$;

-- How many students are looking for housemates for one home (for its page).
create or replace function public.housemates_for_home(p_residence uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int
  from housemate_cards c
  where auth.uid() is not null
    and c.residence_id = p_residence and c.status = 'approved' and c.active
    and c.user_id <> auth.uid()
    and not private.is_blocked_between(auth.uid(), c.user_id)
    and private.housemate_compatible(auth.uid(), c.user_id);
$$;

-- 6. The team approves or hides a card.
create or replace function public.review_housemate_card(p_user uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can review housemate cards.' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('approved', 'hidden') then
    raise exception 'Status must be approved or hidden.' using errcode = 'check_violation';
  end if;
  update housemate_cards set status = p_status, review_note = left(p_note, 500) where user_id = p_user;
end;
$$;

revoke all on function public.housemate_board(text, int, date, text, uuid) from public, anon;
revoke all on function public.housemates_for_home(uuid) from public, anon;
revoke all on function public.review_housemate_card(uuid, text, text) from public, anon;
grant execute on function public.housemate_board(text, int, date, text, uuid) to authenticated;
grant execute on function public.housemates_for_home(uuid) to authenticated;
grant execute on function public.review_housemate_card(uuid, text, text) to authenticated;
