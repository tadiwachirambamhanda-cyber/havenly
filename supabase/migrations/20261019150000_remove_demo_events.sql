-- The 8 seeded events were invented (e.g. "AUS Rooftop Movie Night",
-- "UOWD Freshers Mixer") and all dated in the past. Removed with the demo
-- editorial posts (20261019140000). check_ins and interests point at
-- events polymorphically (place_type/place_id, no foreign key), so their
-- event rows are cleared first to avoid orphans. Real events are added by
-- admins in the app (Settings → Create event).
delete from check_ins where place_type = 'event';
delete from interests where place_type = 'event';
delete from events;
