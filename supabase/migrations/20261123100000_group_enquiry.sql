-- Group enquiry: friends enquire about a whole home together.
--
-- One student starts a group (they become its organiser) and gets a 6-character invite code; friends join with
-- the code and give their phone number; the organiser sends ONE enquiry that carries the group; the team sees the
-- whole group; everyone in the group follows the enquiry's status.
--
-- Nobody writes to these tables directly: every change goes through the functions below, which check the rules.
-- Members see the group and each other's NAMES; phone numbers are never readable by students (only the team, through
-- admin_enquiry_group).

create table public.enquiry_groups (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.profiles(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  -- 32 characters (no I, O, 0, 1) x 6 = about a billion codes.
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  status text not null default 'open' check (status in ('open', 'sent', 'closed')),
  created_at timestamptz not null default now()
);

create table public.enquiry_group_members (
  group_id uuid not null references public.enquiry_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_phone text not null check (contact_phone ~ '^\+?[0-9 ()-]{8,20}$'),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index enquiry_group_members_user_idx on public.enquiry_group_members (user_id);

alter table public.enquiry_groups enable row level security;
alter table public.enquiry_group_members enable row level security;

-- Membership check used by the policies (security definer so a policy on the members table can ask about itself).
create or replace function private.is_group_member(g uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from enquiry_group_members where group_id = g and user_id = u);
$$;

create policy "Members read their group, the team reads all" on public.enquiry_groups
  for select using (private.is_group_member(id, auth.uid()) or private.is_admin());
create policy "Members read who is in their group, the team reads all" on public.enquiry_group_members
  for select using (private.is_group_member(group_id, auth.uid()) or private.is_admin());

-- Read only, and never the phone column. All writes go through the functions.
revoke all on public.enquiry_groups from anon, authenticated;
revoke all on public.enquiry_group_members from anon, authenticated;
grant select on public.enquiry_groups to authenticated;
grant select (group_id, user_id, joined_at) on public.enquiry_group_members to authenticated;

create or replace function private.new_invite_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
  i int;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    for i in 0..5 loop
      code := code || substr(chars, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.enquiry_groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Start a group for a whole home. Returns the existing open group if this student already started one for the home.
create or replace function public.create_enquiry_group(p_residence uuid, p_phone text)
returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  g enquiry_groups%rowtype;
begin
  if uid is null then raise exception 'Sign in to start a group.' using errcode = 'insufficient_privilege'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]{8,20}$' then
    raise exception 'Add a phone or WhatsApp number so the team can reach you.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from residences r where r.id = p_residence and r.is_active and r.listing_type = 'home') then
    raise exception 'Group enquiries are for whole homes that are listed.' using errcode = 'check_violation';
  end if;

  select * into g from enquiry_groups x where x.organiser_id = uid and x.residence_id = p_residence and x.status = 'open';
  if found then
    group_id := g.id; invite_code := g.invite_code; return next; return;
  end if;

  insert into enquiry_groups (organiser_id, residence_id, invite_code)
    values (uid, p_residence, private.new_invite_code()) returning * into g;
  insert into enquiry_group_members (group_id, user_id, contact_phone) values (g.id, uid, p_phone);
  group_id := g.id; invite_code := g.invite_code; return next;
end;
$$;

-- What a friend sees before joining: only reachable with the code.
create or replace function public.enquiry_group_preview(p_code text)
returns table (group_id uuid, residence_id uuid, residence_name text, organiser_name text, members int, status text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.id, g.residence_id, r.name, p.display_name,
         (select count(*)::int from enquiry_group_members m where m.group_id = g.id),
         g.status
  from enquiry_groups g
  join residences r on r.id = g.residence_id
  join profiles p on p.id = g.organiser_id
  where auth.uid() is not null
    and g.invite_code = upper(trim(p_code))
    and not private.is_blocked_between(auth.uid(), g.organiser_id);
$$;

create or replace function public.join_enquiry_group(p_code text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  g enquiry_groups%rowtype;
begin
  if uid is null then raise exception 'Sign in to join a group.' using errcode = 'insufficient_privilege'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]{8,20}$' then
    raise exception 'Add a phone or WhatsApp number so the team can reach you.' using errcode = 'check_violation';
  end if;
  select * into g from enquiry_groups x where x.invite_code = upper(trim(p_code));
  if not found or private.is_blocked_between(uid, g.organiser_id) then
    raise exception 'That code does not match a group.' using errcode = 'check_violation';
  end if;
  if g.status <> 'open' then
    raise exception 'This group is no longer open.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from residences r where r.id = g.residence_id and r.is_active and r.listing_type = 'home') then
    raise exception 'This home is no longer listed.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from enquiry_group_members m where m.group_id = g.id and m.user_id = uid) then
    update enquiry_group_members set contact_phone = p_phone where group_id = g.id and user_id = uid;
    return g.id;
  end if;
  if (select count(*) from enquiry_group_members m where m.group_id = g.id) >= 8 then
    raise exception 'This group is full (8 people).' using errcode = 'check_violation';
  end if;
  insert into enquiry_group_members (group_id, user_id, contact_phone) values (g.id, uid, p_phone);
  return g.id;
end;
$$;

-- A member leaves an open group. The organiser leaving closes it.
create or replace function public.leave_enquiry_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  g enquiry_groups%rowtype;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = 'insufficient_privilege'; end if;
  select * into g from enquiry_groups x where x.id = p_group;
  if not found or not private.is_group_member(p_group, uid) then return; end if;
  if g.status <> 'open' then
    raise exception 'This group has already sent its enquiry.' using errcode = 'check_violation';
  end if;
  if g.organiser_id = uid then
    update enquiry_groups set status = 'closed' where id = p_group;
  else
    delete from enquiry_group_members where group_id = p_group and user_id = uid;
  end if;
end;
$$;

-- The team reads the group behind an enquiry, with phone numbers.
create or replace function public.admin_enquiry_group(p_enquiry uuid)
returns table (user_id uuid, display_name text, university text, contact_phone text, is_organiser boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the Havenly team can read a group.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select m.user_id, p.display_name, p.university, m.contact_phone, (m.user_id = g.organiser_id)
  from housing_enquiries e
  join enquiry_groups g on g.id = e.group_id
  join enquiry_group_members m on m.group_id = g.id
  join profiles p on p.id = m.user_id
  where e.id = p_enquiry
  order by (m.user_id = g.organiser_id) desc, m.joined_at;
end;
$$;

revoke all on function public.create_enquiry_group(uuid, text) from public, anon;
revoke all on function public.enquiry_group_preview(text) from public, anon;
revoke all on function public.join_enquiry_group(text, text) from public, anon;
revoke all on function public.leave_enquiry_group(uuid) from public, anon;
revoke all on function public.admin_enquiry_group(uuid) from public, anon;
grant execute on function public.create_enquiry_group(uuid, text) to authenticated;
grant execute on function public.enquiry_group_preview(text) to authenticated;
grant execute on function public.join_enquiry_group(text, text) to authenticated;
grant execute on function public.leave_enquiry_group(uuid) to authenticated;
grant execute on function public.admin_enquiry_group(uuid) to authenticated;

-- The enquiry carries the group. Only the organiser can attach an open group for the same home, and only with at
-- least two people. When the enquiry is created the group becomes "sent" (so a group sends once).
alter table public.housing_enquiries
  add column group_id uuid references public.enquiry_groups(id) on delete set null;
create index housing_enquiries_group_idx on public.housing_enquiries (group_id);

drop policy "Users can create their own enquiries" on public.housing_enquiries;
create policy "Users can create their own enquiries" on public.housing_enquiries for insert with check (
  auth.uid() = user_id and status = 'new' and contract_value_aed is null
  and referral_fee_aed is null and fee_paid_at is null
  and (
    group_id is null
    or exists (
      select 1 from public.enquiry_groups g
      where g.id = housing_enquiries.group_id
        and g.organiser_id = auth.uid() and g.status = 'open'
        and g.residence_id = housing_enquiries.residence_id
    )
  )
);

drop policy "Users can view their own enquiries, admins all" on public.housing_enquiries;
create policy "Users and their group can view an enquiry, admins all" on public.housing_enquiries for select using (
  auth.uid() = user_id
  or private.is_admin()
  or (group_id is not null and private.is_group_member(group_id, auth.uid()))
);

create or replace function private.group_enquiry_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.group_id is not null then
    if (select count(*) from enquiry_group_members where group_id = new.group_id) < 2 then
      raise exception 'A group needs at least 2 people before it can send an enquiry.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger group_enquiry_rules
  before insert on public.housing_enquiries
  for each row execute function private.group_enquiry_rules();

create or replace function private.mark_group_sent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.group_id is not null then
    update enquiry_groups set status = 'sent' where id = new.group_id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger mark_group_sent
  after insert on public.housing_enquiries
  for each row execute function private.mark_group_sent();

-- A status change reaches everyone in the group, not just the organiser.
create or replace function public.notify_student_on_enquiry_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status and new.status in ('contacted', 'viewing_booked', 'signed') then
    insert into notifications (recipient_id, actor_id, type, enquiry_id, enquiry_status)
    select r.recipient, coalesce(auth.uid(), r.recipient), 'enquiry_status', new.id, new.status
    from (
      select new.user_id as recipient where new.user_id is not null
      union
      select m.user_id from enquiry_group_members m where new.group_id is not null and m.group_id = new.group_id
    ) r;
  end if;
  return new;
end;
$$;
