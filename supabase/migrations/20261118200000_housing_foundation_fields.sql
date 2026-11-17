-- Foundation for the housing-first lanes: bills, student deals, housemates and commute
-- times on a listing. Additive and safe for the live app: every column has a default or
-- allows null, and an older save request that leaves them out keeps the stored values.
--
-- bills_included: true = bills are in the rent, false = not, null = not stated.
-- bills_min_aed / bills_max_aed: estimated monthly bills for the whole listing (a whole
--   home counts the home), shown to students as a range and split per person.
-- student_deal_types: which student offers the listing has; student_rate_aed is the
--   discounted rent per MONTH when the offer is a student rate (rents quoted per year or
--   semester are compared as monthly equivalents).
-- housemates: how many other students already live there (rooms), null when unknown.
-- commutes: [{"university": "...", "minutes": 18, "mode": "bus"}], curated by the team.
alter table public.residences
  add column bills_included boolean,
  add column bills_min_aed int check (bills_min_aed is null or bills_min_aed >= 0),
  add column bills_max_aed int check (bills_max_aed is null or bills_max_aed >= 0),
  add column student_deal_types text[] not null default '{}'
    check (student_deal_types <@ array['student_rate', 'deposit_waived', 'fees_waived', 'free_first_month', 'group_discount']::text[]),
  add column student_rate_aed int check (student_rate_aed is null or student_rate_aed > 0),
  add column housemates int check (housemates is null or housemates between 0 and 10),
  add column commutes jsonb not null default '[]'::jsonb check (jsonb_typeof(commutes) = 'array');

-- The estimate is a pair (both or neither) and the top is never below the bottom.
alter table public.residences
  add constraint residences_bills_range check (
    (bills_min_aed is null) = (bills_max_aed is null)
    and (bills_min_aed is null or bills_max_aed >= bills_min_aed)
  );

-- Same function as before plus the new fields. The admin check is private.is_admin():
-- 20261117010000_move_policy_helpers_to_private.sql moved that helper out of the public schema.
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
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can edit residences.';
  end if;

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

  return rid;
end;
$$;

revoke execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;
