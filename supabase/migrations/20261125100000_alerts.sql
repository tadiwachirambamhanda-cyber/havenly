-- Alerts for students: a real price cut on a saved place, and a new place that fits them.
-- Both are decided in one place, at the end of save_residence (the only way the team changes a listing).

alter table public.profile_private
  add column alert_new_places boolean not null default false,
  add column alert_price_drops boolean not null default true;
grant insert (alert_new_places, alert_price_drops) on public.profile_private to authenticated;
grant update (alert_new_places, alert_price_drops) on public.profile_private to authenticated;

-- Set the first time a listing can be booked. New-place alerts match for 7 days from then.
alter table public.residences add column first_announced_at timestamptz;
-- Listings students can already book are not news. Eight days back, so none of them matches again.
update public.residences r set first_announced_at = now() - interval '8 days'
where r.is_active and exists (
  select 1 from public.room_types t where t.residence_id = r.id and t.is_available and t.price_aed > 0);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'ping', 'enquiry_new', 'enquiry_status', 'new_place', 'price_drop'));
alter table public.notifications
  add column residence_id uuid references public.residences(id) on delete cascade,
  add column old_price_aed int,
  add column new_price_aed int;
-- A listing alert comes from the system, not from a person. Every other kind still needs a person.
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications add constraint notifications_actor_or_listing check (
  case when type in ('new_place', 'price_drop')
    then actor_id is null and residence_id is not null and new_price_aed is not null
    else actor_id is not null end
);
-- At most one unread price alert per student and place, and one new-place alert ever.
create unique index notifications_one_unread_price_drop on public.notifications (recipient_id, residence_id)
  where type = 'price_drop' and not is_read;
create unique index notifications_one_new_place on public.notifications (recipient_id, residence_id)
  where type = 'new_place';
create index notifications_residence_idx on public.notifications (residence_id) where residence_id is not null;
-- Students may only mark their alerts read, not rewrite them.
revoke update on public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

-- A room price as a monthly figure, rounded the way the app rounds it (monthlyEquivalent).
create function private.room_monthly_aed(price int, period text)
returns int
language sql
immutable
as $$
  select round(price::numeric / case period when 'month' then 1 when 'semester' then 6 else 12 end)::int;
$$;

-- The "from" price on the cards (priceInfo): the cheapest available room, or the student rate when lower.
-- Null when no room can be booked, even if there is a student rate: a full place is never announced.
create function private.listing_from_aed(rid uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when m.low is null then null
              when r.student_rate_aed is null or r.student_rate_aed <= 0 then m.low
              else least(m.low, r.student_rate_aed) end
  from residences r
  cross join lateral (
    select min(nullif(private.room_monthly_aed(t.price_aed, t.billing_period), 0)) as low
    from room_types t where t.residence_id = r.id and t.is_available and t.price_aed > 0
  ) m
  where r.id = rid;
$$;

create function private.alert_snapshot(rid uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'active', r.is_active,
    'from', private.listing_from_aed(r.id),
    'rate', r.student_rate_aed,
    'rooms', coalesce((select jsonb_object_agg(t.id, private.room_monthly_aed(t.price_aed, t.billing_period))
                       from room_types t where t.residence_id = r.id), '{}'::jsonb))
  from residences r where r.id = rid;
$$;

-- Who a newly listed place fits. A student must have asked for these alerts and saved a budget.
-- For a whole home the budget is compared with one person's share of the rent.
create function private.new_place_matches(rid uuid, from_aed int)
returns table (student uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id
  from residences r
  join profile_private pp on pp.alert_new_places and pp.budget_aed is not null
  join profiles p on p.id = pp.user_id
  where r.id = rid
    and pp.budget_aed >= case when r.listing_type = 'home'
          then round(from_aed::numeric / least(10, greatest(1, coalesce(r.bedrooms, 2))))::int
          else from_aed end
    and (p.university is null or p.university = any (r.nearby_universities))
    and (r.gender_policy = 'mixed'
      or (r.gender_policy = 'female_only' and pp.gender = 'female')
      or (r.gender_policy = 'male_only' and pp.gender = 'male'));
$$;

create function private.send_listing_alerts(rid uuid, before_state jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  listing residences%rowtype;
  now_from int;
  old_from int := (before_state->>'from')::int;
  bookable boolean;
  real_cut boolean := false;
begin
  select * into listing from residences where id = rid;
  now_from := private.listing_from_aed(rid);
  bookable := listing.is_active and now_from is not null;

  -- Keep unread alerts true. Removed ones were never seen.
  delete from notifications n
  where n.residence_id = rid and n.type = 'price_drop' and not n.is_read
    and (not bookable or now_from >= n.old_price_aed);
  delete from notifications n
  where n.residence_id = rid and n.type = 'new_place' and not n.is_read
    and (not bookable or n.recipient_id not in (select m.student from private.new_place_matches(rid, now_from) m));
  update notifications n set new_price_aed = now_from
  where bookable and n.residence_id = rid and n.type in ('price_drop', 'new_place') and not n.is_read;

  if not bookable then
    return;
  end if;

  -- A real cut: the listing was already visible, the from price fell, and what now sets it was made cheaper.
  -- A room becoming free again, or a newly added room, is not a cut.
  if coalesce((before_state->>'active')::boolean, false) and old_from is not null and now_from < old_from then
    real_cut :=
      (listing.student_rate_aed = now_from
        and coalesce((before_state->>'rate')::int > listing.student_rate_aed, true))
      or exists (
        select 1 from room_types t
        where t.residence_id = rid and t.is_available
          and private.room_monthly_aed(t.price_aed, t.billing_period) = now_from
          and (before_state->'rooms'->>(t.id::text))::int > now_from);
  end if;

  if coalesce(real_cut, false) then
    insert into notifications (recipient_id, type, residence_id, old_price_aed, new_price_aed)
    select s.user_id, 'price_drop', rid, old_from, now_from
    from saved_residences s
    left join profile_private pp on pp.user_id = s.user_id
    where s.residence_id = rid and coalesce(pp.alert_price_drops, true)
    on conflict do nothing;
  end if;

  if listing.first_announced_at is null then
    update residences set first_announced_at = now() where id = rid;
    listing.first_announced_at := now();
  end if;
  if listing.first_announced_at > now() - interval '7 days' then
    insert into notifications (recipient_id, type, residence_id, new_price_aed)
    select m.student, 'new_place', rid, now_from
    from private.new_place_matches(rid, now_from) m
    -- Someone already told about a price cut on it in this same save does not also need "new".
    where not exists (select 1 from notifications n where n.recipient_id = m.student and n.residence_id = rid and not n.is_read)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function private.room_monthly_aed(int, text) from public, anon, authenticated;
revoke all on function private.listing_from_aed(uuid) from public, anon, authenticated;
revoke all on function private.alert_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.new_place_matches(uuid, int) from public, anon, authenticated;
revoke all on function private.send_listing_alerts(uuid, jsonb) from public, anon, authenticated;

create or replace function public.save_residence(
  residence_id_input uuid,
  residence jsonb,
  rooms jsonb,
  terms jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  rid uuid := residence_id_input;
  room jsonb;
  kept_ids uuid[];
  idx int := 0;
  alert_before jsonb;
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can edit residences.';
  end if;

  -- How the listing looked before this save, for the alerts below. The row stays locked until the save ends,
  -- so two team members saving at once cannot send the same alert twice.
  if rid is not null then
    perform 1 from residences where id = rid for update;
  end if;
  alert_before := private.alert_snapshot(rid);

  if rid is null then
    insert into residences (
      name, provider_name, area, address, latitude, longitude, description,
      gender_policy, amenities, nearby_universities, photo_urls, is_active,
      listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, verified_at, permit_number,
      bills_included, bills_min_aed, bills_max_aed, student_deal_types, student_rate_aed, housemates, commutes
    ) values (
      residence->>'name', residence->>'provider_name', residence->>'area', residence->>'address',
      (residence->>'latitude')::double precision, (residence->>'longitude')::double precision,
      residence->>'description', coalesce(residence->>'gender_policy', 'mixed'),
      array(select jsonb_array_elements_text(coalesce(residence->'amenities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'nearby_universities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'photo_urls', '[]'::jsonb))),
      coalesce((residence->>'is_active')::boolean, true),
      coalesce(residence->>'listing_type', 'residence'),
      (residence->>'bedrooms')::int,
      (residence->>'deposit_aed')::int,
      (residence->>'move_in_fee_aed')::int,
      coalesce((residence->>'is_verified')::boolean, false),
      case when coalesce((residence->>'is_verified')::boolean, false) then now() else null end,
      nullif(trim(residence->>'permit_number'), ''),
      (residence->>'bills_included')::boolean,
      (residence->>'bills_min_aed')::int,
      (residence->>'bills_max_aed')::int,
      array(select jsonb_array_elements_text(coalesce(residence->'student_deal_types', '[]'::jsonb))),
      (residence->>'student_rate_aed')::int,
      (residence->>'housemates')::int,
      coalesce(residence->'commutes', '[]'::jsonb)
    )
    returning id into rid;
  else
    update residences set
      name = residence->>'name',
      provider_name = residence->>'provider_name',
      area = residence->>'area',
      address = residence->>'address',
      latitude = (residence->>'latitude')::double precision,
      longitude = (residence->>'longitude')::double precision,
      description = residence->>'description',
      gender_policy = coalesce(residence->>'gender_policy', 'mixed'),
      amenities = array(select jsonb_array_elements_text(coalesce(residence->'amenities', '[]'::jsonb))),
      nearby_universities = array(select jsonb_array_elements_text(coalesce(residence->'nearby_universities', '[]'::jsonb))),
      photo_urls = array(select jsonb_array_elements_text(coalesce(residence->'photo_urls', '[]'::jsonb))),
      is_active = coalesce((residence->>'is_active')::boolean, true),
      listing_type = coalesce(residence->>'listing_type', listing_type),
      bedrooms = case when residence ? 'bedrooms' then (residence->>'bedrooms')::int else bedrooms end,
      deposit_aed = case when residence ? 'deposit_aed' then (residence->>'deposit_aed')::int else deposit_aed end,
      move_in_fee_aed = case when residence ? 'move_in_fee_aed' then (residence->>'move_in_fee_aed')::int else move_in_fee_aed end,
      permit_number = case when residence ? 'permit_number' then nullif(trim(residence->>'permit_number'), '') else permit_number end,
      bills_included = case when residence ? 'bills_included' then (residence->>'bills_included')::boolean else bills_included end,
      bills_min_aed = case when residence ? 'bills_min_aed' then (residence->>'bills_min_aed')::int else bills_min_aed end,
      bills_max_aed = case when residence ? 'bills_max_aed' then (residence->>'bills_max_aed')::int else bills_max_aed end,
      student_deal_types = case when residence ? 'student_deal_types'
        then array(select jsonb_array_elements_text(coalesce(residence->'student_deal_types', '[]'::jsonb)))
        else student_deal_types end,
      student_rate_aed = case when residence ? 'student_rate_aed' then (residence->>'student_rate_aed')::int else student_rate_aed end,
      housemates = case when residence ? 'housemates' then (residence->>'housemates')::int else housemates end,
      commutes = case when residence ? 'commutes' then coalesce(residence->'commutes', '[]'::jsonb) else commutes end,
      -- Stamp the time the first time it becomes verified; clear it when it stops.
      is_verified = coalesce((residence->>'is_verified')::boolean, is_verified),
      verified_at = case
        when coalesce((residence->>'is_verified')::boolean, is_verified)
          then coalesce(verified_at, now())
        else null
      end
    where id = rid;
    if not found then
      raise exception 'This residence no longer exists.';
    end if;
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}') into kept_ids
  from jsonb_array_elements(coalesce(rooms, '[]'::jsonb)) r
  where r->>'id' is not null;
  delete from room_types where residence_id = rid and not (id = any(kept_ids));

  for room in select value from jsonb_array_elements(coalesce(rooms, '[]'::jsonb)) loop
    if room->>'id' is not null then
      update room_types set
        name = room->>'name',
        price_aed = (room->>'price_aed')::int,
        billing_period = room->>'billing_period',
        occupancy = (room->>'occupancy')::int,
        is_available = (room->>'is_available')::boolean,
        sort_order = idx
      where id = (room->>'id')::uuid and residence_id = rid;
    else
      insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
      values (
        rid, room->>'name', (room->>'price_aed')::int, room->>'billing_period',
        (room->>'occupancy')::int, (room->>'is_available')::boolean, idx
      );
    end if;
    idx := idx + 1;
  end loop;

  insert into residence_partner_terms (residence_id, referral_fee_percent, contact_name, contact_email, contact_phone, notes, updated_at)
  values (
    rid, (terms->>'referral_fee_percent')::numeric, terms->>'contact_name', terms->>'contact_email',
    terms->>'contact_phone', terms->>'notes', now()
  )
  on conflict (residence_id) do update set
    referral_fee_percent = excluded.referral_fee_percent,
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    notes = excluded.notes,
    updated_at = now();

  perform private.send_listing_alerts(rid, alert_before);

  return rid;
end;
$$;

revoke execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;
