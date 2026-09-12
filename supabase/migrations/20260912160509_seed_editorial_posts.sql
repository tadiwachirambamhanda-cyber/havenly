-- Editorial "Havenly Picks" content so the feed isn't empty for first users
-- (PROJECT_BRIEF.md section 6, item 7 — explicitly called out as "don't skip
-- this"). Uses the editorial system account created via the Auth Admin API
-- (editorial@havenly.app) — see README.md for how to recreate it on a fresh
-- project. handle_new_user() already gave it a barebones profile on
-- creation; this just fills in the real display fields and adds content.

update profiles set
  username = 'havenly',
  display_name = 'Havenly Editorial',
  bio = 'Curated picks from the Havenly team — cafés, events, and spots worth knowing about in Dubai.',
  has_completed_onboarding = true
where id = (select id from auth.users where email = 'editorial@havenly.app');

insert into posts (author_id, title, body, tag, is_editorial, like_count, created_at)
select
  (select id from auth.users where email = 'editorial@havenly.app'),
  v.title, v.body, v.tag, true, v.like_count, now() - (v.days_ago || ' days')::interval
from (values
  -- Cafés
  ('The 12 best study cafés in Dubai, ranked by wifi + plugs', 'We tested outlets, wifi speed, and how long a barista lets you nurse one flat white. Nightjar Coffee in Al Quoz wins on plugs alone — every table has one.', 'Cafés', 214, 1),
  ('This tiny Al Quoz café makes the best pistachio croissant in the Emirates', 'No sign, no queue system, just a guy who has been perfecting the same six pastries for years. Get there before 9am on weekends.', 'Cafés', 340, 3),
  ('Dubai''s specialty coffee scene has quietly gotten really good', 'Three years ago you had two options. Now there''s a proper third-wave scene with its own house-roasted beans, and nobody''s talking about it enough.', 'Cafés', 128, 6),
  ('A hidden garden café behind Jumeirah you''ll want to keep to yourself', 'Tucked behind a villa wall with no street frontage. You will only find it if someone tells you, so consider this us telling you.', 'Cafés', 96, 9),

  -- Fashion
  ('Where to thrift in Dubai without paying resale markup', 'The good bins are not where you think. We mapped the actual thrift circuit, not the Instagram-famous one.', 'Fashion', 187, 2),
  ('This monthly pop-up is where Dubai''s best-dressed actually shop', 'One Saturday a month, a rotating cast of small local designers takes over a warehouse in Al Quoz. No website, just word of mouth — until now.', 'Fashion', 152, 5),
  ('Sustainable fashion is having a moment in Dubai — here''s where to start', 'Swap meets, upcycled pieces, and a handful of brands actually doing the work instead of just saying the word.', 'Fashion', 88, 8),

  -- Nightlife
  ('5 rooftop spots for golden hour that don''t need a table booking', 'You do not need a reservation or a dress code to catch a good sunset in this city. Here is where to just show up.', 'Nightlife', 301, 2),
  ('Dubai''s best nights out don''t start until midnight — here''s the lineup', 'If you are leaving before 1am you are leaving too early. A realistic guide to how the night actually unfolds.', 'Nightlife', 176, 4),
  ('Live music is back in Dubai and these are the venues actually doing it', 'Past the DJ sets, a small but growing scene of venues booking actual bands and solo acts worth catching.', 'Nightlife', 143, 7),

  -- Study Spots
  ('The 24-hour library nobody tells freshers about', 'Open around the clock, air conditioning that actually works, and nobody will kick you out at exam season. This should be common knowledge and somehow isn''t.', 'Study Spots', 402, 1),
  ('Best co-working spaces in Dubai if you''re not paying for a membership', 'Several spots run a free-hours policy for students if you know to ask at the front desk. Here is the list.', 'Study Spots', 119, 4),
  ('Silent study Sundays: where Dubai students actually get work done', 'A weekly, informal silent-study meetup that started with four people and is now closer to forty.', 'Study Spots', 76, 10),

  -- Padel
  ('Padel courts are booked solid in Dubai right now — here''s how to actually get a slot', 'Padel demand has outpaced court supply citywide. A few tricks for actually getting on a court this week.', 'Padel', 264, 2),
  ('New padel courts just opened in JBR and they''re already packed', 'Sunset Padel Club added four new courts and a proper café. Book ahead — evenings are gone within hours of release.', 'Padel', 198, 5),
  ('We watched Dubai''s biggest amateur padel tournament — here''s what we learned', 'Turns out the amateur scene here is more competitive than most people realize. Notes from a Saturday spent courtside.', 'Padel', 112, 9),

  -- Beach
  ('La Mer at sunrise hits different — here''s why you should set an alarm', 'Empty sand, soft light, and none of the midday crowd. The best version of this beach exists before 7am.', 'Beach', 289, 1),
  ('Kite Beach is Dubai''s most underrated beach and we don''t know why', 'Better sand, better parking, better food trucks than the beaches everyone actually talks about.', 'Beach', 175, 6),
  ('The quietest stretch of coastline left in the city', 'A short walk past where most people stop gets you a stretch of beach that is almost always empty, even on weekends.', 'Beach', 94, 11),

  -- Travel
  ('A weekend desert safari that''s actually worth the early wake-up', 'Skip the tourist-trap version. This route gets you real dunes, a proper sunrise, and none of the convoy traffic.', 'Travel', 233, 3),
  ('Hatta is 90 minutes from Dubai and feels like a different country', 'Mountains, a proper lake, and weather that is ten degrees cooler. Somehow still underused as a weekend escape.', 'Travel', 168, 7),
  ('Why more Dubai residents are doing Abu Dhabi as a day trip', 'The drive is shorter than most people''s commute. A realistic one-day itinerary that doesn''t try to do too much.', 'Travel', 101, 12),

  -- Events
  ('Alserkal Night Market is back and it''s bigger than last season', 'More stalls, a proper lineup of local vendors, and it runs later into the night than it used to.', 'Events', 356, 2),
  ('Rooftop cinema nights are quietly one of Dubai''s best-kept secrets', 'Bring a blanket, the movie starts after sunset, and somehow it is never actually crowded.', 'Events', 221, 5),
  ('This weekend''s farmers market lineup is worth rearranging your Saturday for', 'Local produce, a genuinely good coffee stall, and it wraps up before the heat sets in.', 'Events', 134, 8),
  ('Open mic night at this Al Quoz warehouse is not what you''d expect', 'Half comedy, half music, entirely unpolished in the best way. Sign-up sheet goes up at the door.', 'Events', 87, 13),

  -- Beauty
  ('The henna spot every Dubai bride-to-be already knows about', 'Booked out months in advance for weddings, but they take walk-ins on weekday afternoons if you know to ask.', 'Beauty', 178, 4),
  ('Blow-dry bars are everywhere in Dubai now — here are the ones worth it', 'Not all blow-dry bars are equal. We narrowed a very crowded field down to the ones actually worth the price.', 'Beauty', 122, 7),
  ('K-beauty skincare shops are popping up across the city', 'A handful of new spots stocking the actual Korean brands, not just the ones that made it to mainstream shelves.', 'Beauty', 95, 10),

  -- Fitness
  ('Sunrise yoga on the beach is Dubai''s best free workout', 'No membership, no booking, just a mat and a 6am alarm. Multiple beaches now have informal weekly sessions.', 'Fitness', 245, 3),
  ('This boutique gym in Al Quoz doesn''t feel like a chain — and that''s the point', 'Small classes, no upsell, and a community that actually shows up for each other outside of class hours.', 'Fitness', 156, 6),
  ('Dubai''s run clubs are turning into the city''s best social network', 'Half the people who show up are not really there for the run. A guide to the clubs actually worth joining.', 'Fitness', 190, 9)
) as v(title, body, tag, like_count, days_ago);
