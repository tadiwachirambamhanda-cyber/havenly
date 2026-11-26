-- Removes every sample listing (and, through the database's cascades, its rooms, saves and alerts).
-- Run when the first real listings are live: supabase db query --linked --file scripts/sample-listings/remove.sql
begin;
delete from residences where is_sample;
select count(*) as sample_listings_left from residences where is_sample;
commit;
