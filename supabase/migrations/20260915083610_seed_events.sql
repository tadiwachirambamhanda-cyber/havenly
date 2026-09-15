-- Real editorial event content, replacing DiscoverScreen's static mock
-- EVENTS array. No author to look up (unlike seed_editorial_posts.sql) —
-- events have no author_id — so this can run standalone. Dates are relative
-- to when this migration runs so they land as genuinely upcoming events.
insert into events (title, description, location, tag, event_date, interested_count) values
  ('AUS Rooftop Movie Night', 'Bring a blanket — the screen goes up after sunset on the engineering building rooftop. Free entry, first come first served for seating.', 'American University of Sharjah', 'Events', now() + interval '3 days' + interval '19 hours', 58),
  ('Alserkal Night Market', 'Local vendors, food trucks, and a DJ set closing out the night. Runs later than the daytime market.', 'Alserkal Avenue, Al Quoz', 'Events', now() + interval '6 days' + interval '18 hours', 134),
  ('UOWD Freshers Mixer', 'Meet your cohort before classes start properly — RSVP required, capacity is limited.', 'Dubai International Academic City', 'Events', now() + interval '9 days' + interval '17 hours', 76),
  ('Sunrise Yoga on Kite Beach', 'Free weekly beach yoga session, mats not provided. Shows up rain or shine (mostly shine).', 'Kite Beach, Jumeirah', 'Fitness', now() + interval '2 days' + interval '6 hours', 41),
  ('Silent Study Sunday', 'A running weekly meetup — bring headphones and your own laptop charger, this one fills up fast.', 'Nightjar Coffee, Al Quoz', 'Study Spots', now() + interval '5 days' + interval '10 hours', 29);
