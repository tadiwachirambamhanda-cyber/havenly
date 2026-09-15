-- Lets a small set of trusted accounts manage events (create/delete) from
-- inside the app, instead of requiring a direct SQL migration for every new
-- one the way editorial posts still do — events change often enough (new
-- one most weeks) that routing every single one through a migration isn't
-- realistic. Defaults false; nobody has it except the explicit grant below.
alter table profiles add column is_admin boolean not null default false;

create policy "Admins can create events" on events for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete events" on events for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- Grants the app's owner account admin access, the same way the editorial
-- system account is identified by a known email rather than a general rule.
update profiles set is_admin = true
where id = (select id from auth.users where email = 'tadiwachirambamhanda@gmail.com');
