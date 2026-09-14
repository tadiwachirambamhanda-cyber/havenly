-- Four new interests grounded in actual Dubai/UAE student culture:
-- football, running, art (& culture), gaming.
alter table communities drop constraint communities_related_interest_check;
alter table communities add constraint communities_related_interest_check check (related_interest in (
  'cafes','fashion','nightlife','fitness','beach','study','travel','events','padel','beauty',
  'football','running','art','gaming'
));

insert into communities (name, emoji, description, category, related_interest, related_university, member_count) values
  ('Dubai 5-a-Side', '⚽', 'Pickup games, weekly leagues, and finding a squad for Sports City or Times Square Center.', 'interest', 'football', null, 940),
  ('Dubai Run Club', '🏃', 'Early runs on Kite Beach, marathon training, and pace groups for every level.', 'interest', 'running', null, 1280),
  ('Alserkal Regulars', '🎨', 'Gallery openings, exhibitions, and the best of Dubai''s art scene.', 'interest', 'art', null, 670),
  ('Dubai Gamers', '🎮', 'LAN meetups, tournament squads, and where to game after class.', 'interest', 'gaming', null, 1510);
