-- Saving a residence touches three tables (the listing, its room types,
-- and the private partner terms). Done as separate client writes, a
-- failure partway through left a half-saved listing behind, and retrying
-- the form then inserted a duplicate residence. One function means one
-- transaction: it all saves, or nothing does.
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
      gender_policy, amenities, nearby_universities, photo_urls, is_active
    ) values (
      residence->>'name', residence->>'provider_name', residence->>'area', residence->>'address',
      (residence->>'latitude')::double precision, (residence->>'longitude')::double precision,
      residence->>'description', coalesce(residence->>'gender_policy', 'mixed'),
      array(select jsonb_array_elements_text(coalesce(residence->'amenities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'nearby_universities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(residence->'photo_urls', '[]'::jsonb))),
      coalesce((residence->>'is_active')::boolean, true)
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
      is_active = coalesce((residence->>'is_active')::boolean, true)
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
grant execute on function public.save_residence(uuid, jsonb, jsonb, jsonb) to authenticated;
