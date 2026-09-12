-- Havenly seed data — run after schema.sql
insert into communities (name, emoji, description, category, related_interest, related_university, member_count) values
  ('Padel Club Dubai', '🏓', 'Find partners, join weekly meetups, and track your rank across Dubai courts.', 'interest', 'padel', null, 1860),
  ('Café Hoppers', '☕', 'For people who plan their week around new café openings.', 'interest', 'cafes', null, 3210),
  ('Thrift & Style', '👗', 'Swap fits, find thrift spots, and share styling inspo.', 'interest', 'fashion', null, 2040),
  ('Study Grind', '📚', 'Silent co-study sessions, best study spots, and exam-season survival tips.', 'interest', 'study', null, 2780),
  ('AUS Freshers', '🎓', 'American University of Sharjah — new student meetups & housing tips.', 'campus', null, 'American University of Sharjah', 1120),
  ('UOWD Connect', '🏫', 'University of Wollongong Dubai student community.', 'campus', null, 'University of Wollongong in Dubai', 890);

-- One community per remaining UAE university (src/constants/universities.ts).
-- member_count starts at 0 — these are brand new with no real membership yet.
insert into communities (name, emoji, description, category, related_university, member_count) values
  ('United Arab Emirates University', '🎓', 'Connect with other United Arab Emirates University students on Havenly.', 'campus', 'United Arab Emirates University', 0),
  ('Zayed University', '🎓', 'Connect with other Zayed University students on Havenly.', 'campus', 'Zayed University', 0),
  ('Khalifa University', '🎓', 'Connect with other Khalifa University students on Havenly.', 'campus', 'Khalifa University', 0),
  ('NYU Abu Dhabi', '🎓', 'Connect with other NYU Abu Dhabi students on Havenly.', 'campus', 'NYU Abu Dhabi', 0),
  ('Sorbonne University Abu Dhabi', '🎓', 'Connect with other Sorbonne University Abu Dhabi students on Havenly.', 'campus', 'Sorbonne University Abu Dhabi', 0),
  ('Al Ain University', '🎓', 'Connect with other Al Ain University students on Havenly.', 'campus', 'Al Ain University', 0),
  ('Higher Colleges of Technology', '🎓', 'Connect with other Higher Colleges of Technology students on Havenly.', 'campus', 'Higher Colleges of Technology', 0),
  ('American University in Dubai', '🎓', 'Connect with other American University in Dubai students on Havenly.', 'campus', 'American University in Dubai', 0),
  ('Canadian University Dubai', '🎓', 'Connect with other Canadian University Dubai students on Havenly.', 'campus', 'Canadian University Dubai', 0),
  ('The British University in Dubai', '🎓', 'Connect with other British University in Dubai students on Havenly.', 'campus', 'The British University in Dubai', 0),
  ('Heriot-Watt University Dubai', '🎓', 'Connect with other Heriot-Watt University Dubai students on Havenly.', 'campus', 'Heriot-Watt University Dubai', 0),
  ('Middlesex University Dubai', '🎓', 'Connect with other Middlesex University Dubai students on Havenly.', 'campus', 'Middlesex University Dubai', 0),
  ('Murdoch University Dubai', '🎓', 'Connect with other Murdoch University Dubai students on Havenly.', 'campus', 'Murdoch University Dubai', 0),
  ('Manipal Academy of Higher Education Dubai', '🎓', 'Connect with other Manipal Academy of Higher Education Dubai students on Havenly.', 'campus', 'Manipal Academy of Higher Education Dubai', 0),
  ('BITS Pilani Dubai', '🎓', 'Connect with other BITS Pilani Dubai students on Havenly.', 'campus', 'BITS Pilani Dubai', 0),
  ('Amity University Dubai', '🎓', 'Connect with other Amity University Dubai students on Havenly.', 'campus', 'Amity University Dubai', 0),
  ('Curtin University Dubai', '🎓', 'Connect with other Curtin University Dubai students on Havenly.', 'campus', 'Curtin University Dubai', 0),
  ('Rochester Institute of Technology Dubai', '🎓', 'Connect with other Rochester Institute of Technology Dubai students on Havenly.', 'campus', 'Rochester Institute of Technology Dubai', 0),
  ('University of Birmingham Dubai', '🎓', 'Connect with other University of Birmingham Dubai students on Havenly.', 'campus', 'University of Birmingham Dubai', 0),
  ('S P Jain School of Global Management', '🎓', 'Connect with other S P Jain School of Global Management students on Havenly.', 'campus', 'S P Jain School of Global Management', 0),
  ('University of Dubai', '🎓', 'Connect with other University of Dubai students on Havenly.', 'campus', 'University of Dubai', 0),
  ('Hamdan Bin Mohammed Smart University', '🎓', 'Connect with other Hamdan Bin Mohammed Smart University students on Havenly.', 'campus', 'Hamdan Bin Mohammed Smart University', 0),
  ('Mohammed Bin Rashid University of Medicine and Health Sciences', '🎓', 'Connect with other MBRU students on Havenly.', 'campus', 'Mohammed Bin Rashid University of Medicine and Health Sciences', 0),
  ('Islamic Azad University Dubai', '🎓', 'Connect with other Islamic Azad University Dubai students on Havenly.', 'campus', 'Islamic Azad University Dubai', 0),
  ('University of Sharjah', '🎓', 'Connect with other University of Sharjah students on Havenly.', 'campus', 'University of Sharjah', 0),
  ('Skyline University College', '🎓', 'Connect with other Skyline University College students on Havenly.', 'campus', 'Skyline University College', 0),
  ('Ajman University', '🎓', 'Connect with other Ajman University students on Havenly.', 'campus', 'Ajman University', 0),
  ('Gulf Medical University', '🎓', 'Connect with other Gulf Medical University students on Havenly.', 'campus', 'Gulf Medical University', 0),
  ('American University of Ras Al Khaimah', '🎓', 'Connect with other American University of Ras Al Khaimah students on Havenly.', 'campus', 'American University of Ras Al Khaimah', 0),
  ('RAK Medical and Health Sciences University', '🎓', 'Connect with other RAK Medical and Health Sciences University students on Havenly.', 'campus', 'RAK Medical and Health Sciences University', 0),
  ('University of Fujairah', '🎓', 'Connect with other University of Fujairah students on Havenly.', 'campus', 'University of Fujairah', 0);

-- NOTE: editorial posts reference an author_id which must exist in `profiles`.
-- Create a "Havenly Editorial" system profile first, then insert editorial posts:
-- insert into posts (author_id, title, tag, is_editorial) values
--   ('<editorial-profile-uuid>', 'The 12 best study cafés in Dubai, ranked by wifi + plugs', 'Cafés Guide', true);
