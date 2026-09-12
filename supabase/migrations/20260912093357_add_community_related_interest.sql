-- Lets the Communities screen surface interest-category communities that match
-- what a user picked in onboarding. Deliberately unused for faith/campus
-- communities — every faith gets identical treatment (PROJECT_BRIEF.md section 4).
alter table communities add column related_interest text check (related_interest in (
  'cafes','fashion','nightlife','fitness','beach','study','travel','events','padel','beauty'
));

update communities set related_interest = 'padel' where name = 'Padel Club Dubai';
update communities set related_interest = 'cafes' where name = 'Café Hoppers';
update communities set related_interest = 'fashion' where name = 'Thrift & Style';
update communities set related_interest = 'study' where name = 'Study Grind';
