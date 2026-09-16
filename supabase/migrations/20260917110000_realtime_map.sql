-- Lets the Map screen react to new/removed check-ins and interest toggles
-- live instead of only on reopen — same mechanism already used for
-- messages/conversations/notifications (see 20260912150150 and
-- 20260916120000): a table has to be added to supabase_realtime before any
-- postgres_changes subscription on it fires at all.
alter publication supabase_realtime add table check_ins;
alter publication supabase_realtime add table interests;

-- A DELETE's "old record" only carries primary-key columns by default —
-- check_ins.id is the primary key, so its deletes are fine as-is, but
-- interests.place_type/place_id aren't part of its primary key (just id
-- is), and the map needs both to know which pin's count to recompute.
alter table interests replica identity full;
