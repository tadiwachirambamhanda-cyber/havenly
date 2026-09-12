-- Faith/belief communities removed as a product decision (a faith-labeled
-- social feature was judged too much risk for a small team to moderate well).
-- community_members rows for faith communities cascade-delete via their FK.
delete from communities where category = 'faith';

drop table if exists worship_places;

alter table communities drop constraint if exists communities_worship_type_check;
alter table communities drop column if exists worship_type;

alter table communities drop constraint if exists communities_category_check;
alter table communities add constraint communities_category_check check (category in ('interest', 'campus'));
