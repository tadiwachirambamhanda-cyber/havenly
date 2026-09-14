-- Campus communities are meant to be an authentic space for that specific
-- university's students, not open to anyone — you can still browse/see
-- every campus community, but can only join the one matching your own
-- profile.university. Interest communities (Padel, Cafés, etc.) stay open
-- to everyone, unchanged.
drop policy "Users can join communities" on community_members;
create policy "Users can join communities" on community_members for insert with check (
  auth.uid() = user_id
  and (
    (select category from communities where id = community_id) = 'interest'
    or (select related_university from communities where id = community_id) = (select university from profiles where id = auth.uid())
  )
);
