-- Public browsing (docs/prd.md requirement 2) lets signed-out visitors read listings. The
-- residences policy already shows only active listings (admins see all), but room_types
-- could be read for every row, so the rooms and prices of a hidden listing were still
-- readable. Rooms now follow their listing: a room is visible only when its listing is.
-- The subquery runs under the caller's row-level security, so it respects the residences
-- policy (active or admin) without repeating it.
drop policy if exists "Room types are viewable by everyone" on public.room_types;
create policy "Room types follow their listing's visibility" on public.room_types
  for select using (
    exists (select 1 from public.residences r where r.id = room_types.residence_id)
  );
