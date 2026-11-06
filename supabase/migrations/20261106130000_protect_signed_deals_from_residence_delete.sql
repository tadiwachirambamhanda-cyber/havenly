-- housing_enquiries.residence_id is ON DELETE CASCADE, so deleting a
-- residence also deleted every enquiry for it, including signed deals that
-- are Havenly's only record of what that residence owes. (Account deletion
-- already keeps signed enquiries; this closes the same hole on the
-- residence side.)
--
-- A residence with any signed deal can no longer be deleted: set it
-- inactive instead (it disappears from students but the deals stay).
-- Residences with only unsigned enquiries can still be deleted, and those
-- enquiries go with them as before.
create or replace function public.block_delete_residence_with_signed_deals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from housing_enquiries where residence_id = old.id and status = 'signed') then
    raise exception 'This residence has signed deals, so it can''t be deleted. Set it to inactive instead.';
  end if;
  return old;
end;
$$;

create trigger block_delete_residence_with_signed_deals
  before delete on public.residences
  for each row execute procedure public.block_delete_residence_with_signed_deals();
