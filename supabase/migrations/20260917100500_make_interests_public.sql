-- interests' visibility was restricted the same way check-ins are (mutual
-- follows/shared groups) — appropriate for a check-in (a live location
-- signal), but too narrow now that events' pre-existing public "interested"
-- count (Discover's heart button, e.g. "42 interested") routes through this
-- same table as of the previous migration. That count has to be visible to
-- everyone, not just people in the viewer's own network. "I'm down to go"
-- is a forward-looking intent, not a real-time location, so opening
-- visibility up app-wide is a reasonable trade rather than needing two
-- separate tables for what is otherwise the exact same shape of data.
drop policy if exists "Users can view interests they're allowed to see" on interests;
create policy "Interest is viewable by everyone" on interests for select using (true);
