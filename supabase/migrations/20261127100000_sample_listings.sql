-- Sample listings (owner decision 2026-11-27): clearly labelled made-up places so the live app is not empty
-- before real listings arrive. They can be saved and browsed, but nobody can enquire about them, start a group
-- enquiry on them, or get alerts about them. Remove them all with scripts/sample-listings/remove.sql.

alter table public.residences add column is_sample boolean not null default false;

create function private.refuse_sample_listing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from residences where id = new.residence_id and is_sample) then
    raise exception 'This is a sample listing, so enquiries are off.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.refuse_sample_listing() from public, anon, authenticated;

create trigger housing_enquiries_not_sample before insert on public.housing_enquiries
  for each row execute function private.refuse_sample_listing();
create trigger enquiry_groups_not_sample before insert on public.enquiry_groups
  for each row execute function private.refuse_sample_listing();

create or replace function private.send_listing_alerts(rid uuid, before_state jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  listing residences%rowtype;
  now_from int;
  old_from int := (before_state->>'from')::int;
  bookable boolean;
  real_cut boolean := false;
begin
  select * into listing from residences where id = rid;
  -- Sample listings never send alerts (and an unread alert on one is removed below as if it were hidden).
  if listing.is_sample then
    delete from notifications where residence_id = rid and type in ('price_drop', 'new_place') and not is_read;
    return;
  end if;
  now_from := private.listing_from_aed(rid);
  bookable := listing.is_active and now_from is not null;

  -- Keep unread alerts true. Removed ones were never seen.
  delete from notifications n
  where n.residence_id = rid and n.type = 'price_drop' and not n.is_read
    and (not bookable or now_from >= n.old_price_aed);
  delete from notifications n
  where n.residence_id = rid and n.type = 'new_place' and not n.is_read
    and (not bookable or n.recipient_id not in (select m.student from private.new_place_matches(rid, now_from) m));
  update notifications n set new_price_aed = now_from
  where bookable and n.residence_id = rid and n.type in ('price_drop', 'new_place') and not n.is_read;

  if not bookable then
    return;
  end if;

  -- A real cut: the listing was already visible, the from price fell, and what now sets it was made cheaper.
  -- A room becoming free again, or a newly added room, is not a cut.
  if coalesce((before_state->>'active')::boolean, false) and old_from is not null and now_from < old_from then
    real_cut :=
      (listing.student_rate_aed = now_from
        and coalesce((before_state->>'rate')::int > listing.student_rate_aed, true))
      or exists (
        select 1 from room_types t
        where t.residence_id = rid and t.is_available
          and private.room_monthly_aed(t.price_aed, t.billing_period) = now_from
          and (before_state->'rooms'->>(t.id::text))::int > now_from);
  end if;

  if coalesce(real_cut, false) then
    insert into notifications (recipient_id, type, residence_id, old_price_aed, new_price_aed)
    select s.user_id, 'price_drop', rid, old_from, now_from
    from saved_residences s
    left join profile_private pp on pp.user_id = s.user_id
    where s.residence_id = rid and coalesce(pp.alert_price_drops, true)
    on conflict do nothing;
  end if;

  if listing.first_announced_at is null then
    update residences set first_announced_at = now() where id = rid;
    listing.first_announced_at := now();
  end if;
  if listing.first_announced_at > now() - interval '7 days' then
    insert into notifications (recipient_id, type, residence_id, new_price_aed)
    select m.student, 'new_place', rid, now_from
    from private.new_place_matches(rid, now_from) m
    -- Someone already told about a price cut on it in this same save does not also need "new".
    where not exists (select 1 from notifications n where n.recipient_id = m.student and n.residence_id = rid and not n.is_read)
    on conflict do nothing;
  end if;
end;
$$;
