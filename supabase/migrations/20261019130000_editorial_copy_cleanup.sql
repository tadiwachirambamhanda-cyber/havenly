-- Editorial seed copy used em dashes and stock phrasings ("hits different",
-- "here's why", "doesn't feel like a chain — and that's the point"). Rewrite
-- those titles and descriptions in plain sentences. Matched by id so only
-- the seeded rows change; nothing written by students is touched.
update posts set title = 'A boutique gym in Al Quoz with small classes and no upsell'
  where id = '104412c1-9bc6-45e9-88b3-0d57c35f3f83';
update posts set body = 'We tested outlets, wifi speed, and how long a barista lets you nurse one flat white. Nightjar Coffee in Al Quoz wins on plugs alone: every table has one.'
  where id = '58113ae4-efce-49ce-bb58-004f521f36cc';
update posts set title = 'Where to start with sustainable fashion in Dubai'
  where id = 'be0c0e05-5fed-42e0-844c-00c97ade6d57';
update posts set title = 'Dubai''s best nights out start after midnight. Here''s the lineup'
  where id = '670eca9a-a20c-43c6-8026-2175ee5439b3';
update posts set title = 'How to get a padel court in Dubai when everything''s booked'
  where id = 'b553dc79-d531-4ebe-9e48-25dc1b16b334';
update posts set body = 'Sunset Padel Club added four new courts and a proper café. Book ahead: evening slots go within hours of release.'
  where id = '4645db05-8f01-43df-9bfd-0f3191068d5f';
update posts set title = 'What we learned at Dubai''s biggest amateur padel tournament'
  where id = 'be7b3671-043e-4a54-8b99-5c3bd0c89d4f';
update posts set title = 'La Mer before 7am is worth the alarm'
  where id = '9ae20cec-b7d9-46a8-a2a3-64aae4e9b4e5';
update posts set title = 'The blow-dry bars in Dubai worth paying for'
  where id = 'af66abd7-0de3-4bac-bfcc-1f0dc6a55d18';
update posts set body = 'One Saturday a month, a rotating cast of small local designers takes over a warehouse in Al Quoz. There''s no website; people hear about it from friends.'
  where id = 'f9a7b1a4-2124-4948-9ea8-c8bf0d029ed9';

update events set description = 'Bring a blanket. The screen goes up after sunset on the engineering building rooftop. Free entry, seats are first come first served.'
  where id = '852bb33c-e5fe-4c16-a1c8-12898999b7d0';
update events set description = 'A weekly meetup. Bring headphones and your own laptop charger; it fills up fast.'
  where id = '1c226f94-119d-41d9-a491-bc3501aab2cd';
update events set description = 'Meet your cohort before classes start. RSVP required, capacity is limited.'
  where id = '6b1568bb-e4a6-4411-a3c8-994d2c2efa61';
update events set description = 'Casual Smash and FIFA at the arcade. Come solo and you''ll get matched up.'
  where id = 'b8991d3c-b4c6-44fb-94de-b918a47b99c0';

update communities set description = 'American University of Sharjah: new student meetups and housing tips.'
  where id = 'ea9e1914-fa7a-41c5-bf4d-2dc8a0736a29';
