-- Six clearly labelled SAMPLE listings for the live app (owner decision 2026-11-27). Run once; remove with remove.sql.
-- Photos: Unsplash, free licence, linked (not copied). Every name starts with "Sample" and is_sample is true.
begin;
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample Residence, Knowledge Park', 'Sample Housing Partner', 'A student residence a short walk from the Knowledge Park campuses, with study rooms and a campus shuttle. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Dubai Knowledge Park', array['https://images.unsplash.com/photo-1524234599372-a5bd0194758d?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1652882860938-f90aa298e644?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1652882860902-7c6b0f88ef23?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Bills included','Wi-Fi','Campus shuttle','Study rooms','Laundry','24/7 security','Gym']::text[], array['Murdoch University Dubai','Middlesex University Dubai','Curtin University Dubai']::text[], 'mixed', true,
    'residence', null, '3000', '500', false, true, null, null,
    array[]::text[], null, null, '[{"university": "Murdoch University Dubai", "minutes": 8, "mode": "walk"}, {"university": "Middlesex University Dubai", "minutes": 10, "mode": "walk"}, {"university": "Curtin University Dubai", "minutes": 12, "mode": "shuttle"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Private studio', 38000, 'year', 1, true, 0), ('Shared twin room', 24000, 'year', 2, true, 1)) as v(name, price, period, occ, avail, ord);
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample Rooms, Al Barsha', 'Sample Housing Partner', 'A private room in a calm shared apartment near the metro, with a shared kitchen and living room. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Al Barsha', array['https://images.unsplash.com/photo-1585128792103-0b591f96512e?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1582068019386-a943ee9287ae?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1619989652700-9984844cb0ea?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Bills included','Wi-Fi','Shared kitchen','Laundry']::text[], array['American University in Dubai','University of Wollongong in Dubai']::text[], 'female_only', true,
    'private_room', null, '1000', null, false, true, null, null,
    array[]::text[], null, '2', '[{"university": "American University in Dubai", "minutes": 20, "mode": "metro"}, {"university": "University of Wollongong in Dubai", "minutes": 25, "mode": "metro"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Private room', 2800, 'month', 1, true, 0)) as v(name, price, period, occ, avail, ord);
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample Studios, Silicon Oasis', 'Sample Housing Partner', 'A compact furnished studio with its own kitchenette, close to the Academic City road. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Dubai Silicon Oasis', array['https://images.unsplash.com/photo-1702014857653-dcea938d51f0?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1702014862053-946a122b920d?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1702014859908-d48b9b844240?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Wi-Fi','Gym','Pool','Parking','24/7 security']::text[], array['Rochester Institute of Technology Dubai','Manipal Academy of Higher Education Dubai']::text[], 'mixed', true,
    'studio', null, '1800', '300', false, false, '350', '500',
    array['student_rate']::text[], '3300', '0', '[{"university": "Rochester Institute of Technology Dubai", "minutes": 10, "mode": "bus"}, {"university": "Manipal Academy of Higher Education Dubai", "minutes": 15, "mode": "taxi"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Studio', 3600, 'month', 1, true, 0)) as v(name, price, period, occ, avail, ord);
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample Home, Jumeirah Lake Towers', 'Sample Housing Partner', 'A bright 3 bedroom home with a lake view, for friends who want to rent together and split the rent. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Jumeirah Lake Towers', array['https://images.unsplash.com/photo-1771287490603-fbf9b6211cc3?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1791882895717-554975aa5fb7?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1760611655728-f5f0279ed611?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Wi-Fi','Gym','Pool','Parking','24/7 security']::text[], array['Murdoch University Dubai','American University in Dubai']::text[], 'mixed', true,
    'home', '3', '4500', null, false, false, '450', '700',
    array[]::text[], null, null, '[{"university": "Murdoch University Dubai", "minutes": 22, "mode": "bus"}, {"university": "American University in Dubai", "minutes": 18, "mode": "metro"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Whole 3 bedroom home', 9000, 'month', 1, true, 0)) as v(name, price, period, occ, avail, ord);
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample Shared Room, Academic City', 'Sample Housing Partner', 'A bed in a twin room in a shared apartment near the Academic City campuses, the most affordable way to start. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Dubai International Academic City', array['https://images.unsplash.com/photo-1702014861736-d62834317c5e?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1665153515938-97aac6893f2c?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Bills included','Wi-Fi','Shared kitchen','Campus shuttle']::text[], array['Heriot-Watt University Dubai','BITS Pilani Dubai','Amity University Dubai']::text[], 'male_only', true,
    'shared_room', null, '750', null, false, true, null, null,
    array['deposit_waived']::text[], null, '3', '[{"university": "Heriot-Watt University Dubai", "minutes": 7, "mode": "shuttle"}, {"university": "BITS Pilani Dubai", "minutes": 10, "mode": "shuttle"}, {"university": "Amity University Dubai", "minutes": 12, "mode": "shuttle"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Bed in a twin room', 1500, 'month', 2, true, 0)) as v(name, price, period, occ, avail, ord);
with r as (
  insert into residences (name, provider_name, description, area, photo_urls, amenities, nearby_universities, gender_policy, is_active,
    listing_type, bedrooms, deposit_aed, move_in_fee_aed, is_verified, bills_included, bills_min_aed, bills_max_aed,
    student_deal_types, student_rate_aed, housemates, commutes, is_sample, first_announced_at)
  values ('Sample 2 Bed, Dubai Marina', 'Sample Housing Partner', 'A 2 bedroom apartment near the tram and the beach, good for two friends sharing. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only.', 'Dubai Marina', array['https://images.unsplash.com/photo-1629032619752-594d21dfabd2?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1649429710616-dad56ce9a076?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1756154787365-c1a0b4dc4ed5?auto=format&fit=crop&w=1200&q=80']::text[], array['Furnished','Wi-Fi','Gym','Pool','24/7 security']::text[], array['American University in Dubai','University of Wollongong in Dubai']::text[], 'mixed', true,
    'home', '2', '4000', null, false, false, '400', '600',
    array[]::text[], null, null, '[{"university": "American University in Dubai", "minutes": 15, "mode": "metro"}, {"university": "University of Wollongong in Dubai", "minutes": 20, "mode": "metro"}]'::jsonb, true, now())
  returning id)
insert into room_types (residence_id, name, price_aed, billing_period, occupancy, is_available, sort_order)
select r.id, v.name, v.price, v.period, v.occ, v.avail, v.ord from r, (values ('Whole 2 bedroom home', 8500, 'month', 1, true, 0)) as v(name, price, period, occ, avail, ord);
select count(*) as sample_listings from residences where is_sample;
commit;
