-- "Housemates needed" is shown to other students, so changing it on an approved card sends the card back to the team,
-- like the area, tags, note and home already do. Only the check at the end of the card rules changes.
create or replace function private.housemate_card_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b int;
  m date;
  home_ok boolean;
begin
  new.updated_at := now();

  if new.residence_id is not null then
    select (listing_type = 'home' and is_active) into home_ok from residences where id = new.residence_id;
    if home_ok is distinct from true then
      raise exception 'A housemate card can only be tied to a whole home that is listed.' using errcode = 'check_violation';
    end if;
  end if;

  if new.active and (tg_op = 'INSERT' or old.active is distinct from new.active or not private.is_admin()) then
    select budget_aed, move_in_month into b, m from profile_private where user_id = new.user_id;
    if b is null or m is null then
      raise exception 'Set your monthly budget and move-in month in Edit profile first.' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and not private.is_admin()
     and (new.area is distinct from old.area or new.lifestyle is distinct from old.lifestyle
          or new.note is distinct from old.note or new.residence_id is distinct from old.residence_id
          or new.spots_needed is distinct from old.spots_needed) then
    new.status := 'pending';
  end if;
  return new;
end;
$$;
