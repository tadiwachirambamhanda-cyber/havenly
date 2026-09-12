-- Havenly seed data — run after schema.sql
insert into communities (name, emoji, description, category, related_interest, member_count) values
  ('Padel Club Dubai', '🏓', 'Find partners, join weekly meetups, and track your rank across Dubai courts.', 'interest', 'padel', 1860),
  ('Café Hoppers', '☕', 'For people who plan their week around new café openings.', 'interest', 'cafes', 3210),
  ('Thrift & Style', '👗', 'Swap fits, find thrift spots, and share styling inspo.', 'interest', 'fashion', 2040),
  ('Study Grind', '📚', 'Silent co-study sessions, best study spots, and exam-season survival tips.', 'interest', 'study', 2780),
  ('AUS Freshers', '🎓', 'American University of Sharjah — new student meetups & housing tips.', 'campus', null, 1120),
  ('UOWD Connect', '🏫', 'University of Wollongong Dubai student community.', 'campus', null, 890);

-- NOTE: editorial posts reference an author_id which must exist in `profiles`.
-- Create a "Havenly Editorial" system profile first, then insert editorial posts:
-- insert into posts (author_id, title, tag, is_editorial) values
--   ('<editorial-profile-uuid>', 'The 12 best study cafés in Dubai, ranked by wifi + plugs', 'Cafés Guide', true);
