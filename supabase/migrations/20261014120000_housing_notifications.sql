-- ==================== HOUSING NOTIFICATIONS ====================
-- A lead goes cold fast: the team hears about a new enquiry the moment
-- it's sent, and the student hears back whenever it moves forward. Same
-- trigger-only pattern as follow/like/comment notifications, so neither
-- kind can be created or spoofed from the client.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'ping', 'enquiry_new', 'enquiry_status'));
alter table notifications add column enquiry_id uuid references housing_enquiries(id) on delete cascade;
-- What the enquiry moved to at the time, so the notification still reads
-- correctly after it moves on again ("Viewing booked", later "Signed").
alter table notifications add column enquiry_status text;

create or replace function public.notify_admins_on_enquiry()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into notifications (recipient_id, actor_id, type, enquiry_id)
  select p.id, new.user_id, 'enquiry_new', new.id
  from profiles p
  where p.is_admin = true and p.id <> new.user_id;
  return new;
end;
$$;

create trigger on_enquiry_notify_admins
  after insert on housing_enquiries
  for each row execute procedure public.notify_admins_on_enquiry();

-- Only the steps a student actually wants to hear about. 'lost' is left
-- out on purpose — the team can follow up personally instead of the app
-- announcing it.
create or replace function public.notify_student_on_enquiry_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('contacted', 'viewing_booked', 'signed') then
    insert into notifications (recipient_id, actor_id, type, enquiry_id, enquiry_status)
    values (new.user_id, coalesce(auth.uid(), new.user_id), 'enquiry_status', new.id, new.status);
  end if;
  return new;
end;
$$;

create trigger on_enquiry_status_notify_student
  after update of status on housing_enquiries
  for each row execute procedure public.notify_student_on_enquiry_status();
