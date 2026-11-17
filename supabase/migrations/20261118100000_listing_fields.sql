-- F1: what kind of place a listing is, how many bedrooms a whole home has,
-- the costs on top of rent, whether the Havenly team has checked it, and an
-- optional advert permit number. Additive and safe for the live app: every
-- new column has a default or allows null, so listings and the old save
-- request keep working untouched.
alter table public.residences
  add column listing_type text not null default 'residence'
    check (listing_type in ('residence', 'shared_room', 'private_room', 'studio', 'home')),
  add column bedrooms int,
  add column deposit_aed int check (deposit_aed is null or deposit_aed >= 0),
  add column move_in_fee_aed int check (move_in_fee_aed is null or move_in_fee_aed >= 0),
  add column is_verified boolean not null default false,
  add column verified_at timestamptz,
  add column permit_number text check (permit_number is null or char_length(permit_number) <= 40);

-- Only a whole home has a bedroom count (1 to 3); every other kind has none.
alter table public.residences
  add constraint residences_bedrooms_match_type check (
    (listing_type = 'home' and bedrooms is not null and bedrooms between 1 and 3)
    or (listing_type <> 'home' and bedrooms is null)
  );

-- Same function as before plus the new fields. A request that leaves a field
-- out (the older app) keeps that field's current value on update, so an old
-- client editing a whole home can't turn it back into a residence.
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
  if not public.is_admin() then
    raise exception 'Only the Havenly team can edit residences.';
  end if;

  if rid is null then
    insert into residences (
      name, provider_name, area, address, latitude, longitude, description,
      gender_policy, amenities, nearby_universities, photo_urls, is_active,
      listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, verified_at, permit_number
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
      nullif(trim(residence->>'permit_number'), '')
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

-- Same access as before: signed-in users call it, and the function itself
-- refuses anyone who is not an admin. Signed-out visitors cannot call it.
revoke execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;
