-- Havenly seed data — run after schema.sql
insert into communities (name, emoji, description, category, worship_type, related_interest, member_count) values
  ('Padel Club Dubai', '🏓', 'Find partners, join weekly meetups, and track your rank across Dubai courts.', 'interest', null, 'padel', 1860),
  ('Café Hoppers', '☕', 'For people who plan their week around new café openings.', 'interest', null, 'cafes', 3210),
  ('Thrift & Style', '👗', 'Swap fits, find thrift spots, and share styling inspo.', 'interest', null, 'fashion', 2040),
  ('Study Grind', '📚', 'Silent co-study sessions, best study spots, and exam-season survival tips.', 'interest', null, 'study', 2780),
  ('Muslim Students of Dubai', '🕌', 'A space to connect, share halal spots, and never miss Jummah.', 'faith', 'mosque', null, 4120),
  ('Christian Fellowship', '✝️', 'Weekly fellowship, worship nights, and finding a church community away from home.', 'faith', 'church', null, 1340),
  ('Hindu Students Circle', '🕉️', 'Festivals, temple visits, and community gatherings for Hindu students in Dubai.', 'faith', 'temple', null, 980),
  ('Jewish Community Dubai', '✡️', 'Shabbat dinners, holidays, and connecting with the Jewish community in the UAE.', 'faith', 'synagogue', null, 210),
  ('Sikh Sangat Dubai', '☬', 'Gurdwara visits, seva opportunities, and community events.', 'faith', 'gurdwara', null, 340),
  ('Interfaith & Spiritual', '🙏', 'Open space for any faith, philosophy, or spiritual practice not listed above.', 'faith', 'general', null, 560),
  ('AUS Freshers', '🎓', 'American University of Sharjah — new student meetups & housing tips.', 'campus', null, null, 1120),
  ('UOWD Connect', '🏫', 'University of Wollongong Dubai student community.', 'campus', null, null, 890);

insert into worship_places (worship_type, name, area, latitude, longitude) values
  ('mosque', 'Al Farooq Omar Bin Al Khattab Mosque', 'Jumeirah 1', 25.2100, 55.2500),
  ('mosque', 'Al Rashidiya Mosque', 'Al Rashidiya', 25.2350, 55.3700),
  ('mosque', 'Jumeirah Mosque', 'Jumeirah 1', 25.2317, 55.2586),
  ('church', 'Holy Trinity Church', 'Oud Metha', 25.2350, 55.3200),
  ('church', 'St. Mary''s Catholic Church', 'Oud Metha', 25.2360, 55.3210),
  ('church', 'Emirates Baptist Church', 'Al Qusais', 25.2800, 55.3800),
  ('temple', 'Shiva & Krishna Temple', 'Bur Dubai', 25.2620, 55.2970),
  ('temple', 'Sindhi Guru Darbar Temple', 'Bur Dubai', 25.2630, 55.2980),
  ('synagogue', 'The Sephardic Synagogue of Dubai', 'Jumeirah', 25.2200, 55.2600),
  ('synagogue', 'Jewish Community Centre', 'Downtown', 25.1972, 55.2744),
  ('gurdwara', 'Guru Nanak Darbar Gurdwara', 'Jebel Ali', 25.0400, 55.1100),
  ('general', 'Interfaith Meeting Space — Alserkal', 'Al Quoz', 25.1450, 55.2280),
  ('general', 'Dubai Community Centre', 'Al Qusais', 25.2800, 55.3800);

-- NOTE: editorial posts reference an author_id which must exist in `profiles`.
-- Create a "Havenly Editorial" system profile first, then insert editorial posts:
-- insert into posts (author_id, title, tag, is_editorial) values
--   ('<editorial-profile-uuid>', 'The 12 best study cafés in Dubai, ranked by wifi + plugs', 'Cafés Guide', true);
