-- ==================== KEEP SIGNED REFERRALS ON ACCOUNT DELETION ====================
-- Deleting an account used to cascade away every housing enquiry the
-- student made, including signed ones — which are Havenly's only record of
-- what a residence owes. Now unsigned enquiries are still deleted with the
-- account, but a signed one is kept with everything that identifies the
-- student removed: the residence, room, dates, contract value and fee stay
-- so the referral fee can still be invoiced.
alter table housing_enquiries drop constraint housing_enquiries_user_id_fkey;
alter table housing_enquiries alter column user_id drop not null;
alter table housing_enquiries add constraint housing_enquiries_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;
alter table housing_enquiries alter column contact_phone drop not null;

create or replace function public.anonymise_enquiries_on_profile_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from housing_enquiries where user_id = old.id and status <> 'signed';
  update housing_enquiries set
    contact_phone = null,
    message = null,
    preferred_viewing = null,
    budget_aed = null
  where user_id = old.id and status = 'signed';
  -- user_id itself is cleared by the foreign key's ON DELETE SET NULL.
  return old;
end;
$$;

create trigger on_profile_delete_anonymise_enquiries
  before delete on profiles
  for each row execute procedure public.anonymise_enquiries_on_profile_delete();

-- An anonymised enquiry has no student to tell, and a notification with no
-- recipient would fail the insert — which would block the team from ever
-- changing that enquiry's status again.
create or replace function public.notify_student_on_enquiry_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.user_id is not null
     and new.status is distinct from old.status
     and new.status in ('contacted', 'viewing_booked', 'signed') then
    insert into notifications (recipient_id, actor_id, type, enquiry_id, enquiry_status)
    values (new.user_id, coalesce(auth.uid(), new.user_id), 'enquiry_status', new.id, new.status);
  end if;
  return new;
end;
$$;
