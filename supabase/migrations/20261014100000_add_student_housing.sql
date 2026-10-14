-- ==================== STUDENT HOUSING ====================
-- Havenly refers students to partner student residences, which pay a
-- referral fee per student who signs. Havenly never signs the tenancy
-- itself — the residence contracts directly with the student — so the app
-- only needs listings, enquiries, and a pipeline to track what each
-- residence owes. Listings are added by the Havenly team (admin-only
-- writes, same pattern as brands/offers); there's no provider login yet.

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;
grant execute on function public.is_admin() to authenticated;

create table residences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- The operator or licensed agency the student actually contracts with.
  provider_name text not null,
  description text,
  -- Neighbourhood students search by, e.g. "Dubai International Academic City".
  area text not null,
  address text,
  latitude double precision,
  longitude double precision,
  photo_urls text[] not null default '{}',
  amenities text[] not null default '{}',
  -- Names from the app's UNIVERSITIES list, curated by the team rather
  -- than computed from coordinates — "near" for a student means a short
  -- commute or a shuttle, which straight-line distance doesn't capture.
  nearby_universities text[] not null default '{}',
  gender_policy text not null default 'mixed' check (gender_policy in ('mixed', 'female_only', 'male_only')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table residences enable row level security;
create policy "Active residences are viewable by everyone" on residences for select using (is_active or public.is_admin());
create policy "Admins can create residences" on residences for insert with check (public.is_admin());
create policy "Admins can update residences" on residences for update using (public.is_admin());
create policy "Admins can delete residences" on residences for delete using (public.is_admin());

create table room_types (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid references residences(id) on delete cascade not null,
  name text not null,
  price_aed integer not null check (price_aed > 0),
  billing_period text not null check (billing_period in ('year', 'semester', 'month')),
  occupancy int not null default 1 check (occupancy between 1 and 6),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
alter table room_types enable row level security;
create policy "Room types are viewable by everyone" on room_types for select using (true);
create policy "Admins can create room types" on room_types for insert with check (public.is_admin());
create policy "Admins can update room types" on room_types for update using (public.is_admin());
create policy "Admins can delete room types" on room_types for delete using (public.is_admin());
create index room_types_residence_idx on room_types (residence_id);

-- Commercial terms live apart from residences so students (who can read
-- every residence row) never see the fee or the partner's contacts.
create table residence_partner_terms (
  residence_id uuid primary key references residences(id) on delete cascade,
  referral_fee_percent numeric(5, 2) not null check (referral_fee_percent >= 0 and referral_fee_percent <= 100),
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  updated_at timestamptz default now()
);
alter table residence_partner_terms enable row level security;
create policy "Admins can view partner terms" on residence_partner_terms for select using (public.is_admin());
create policy "Admins can create partner terms" on residence_partner_terms for insert with check (public.is_admin());
create policy "Admins can update partner terms" on residence_partner_terms for update using (public.is_admin());
create policy "Admins can delete partner terms" on residence_partner_terms for delete using (public.is_admin());

create table saved_residences (
  user_id uuid references profiles(id) on delete cascade,
  residence_id uuid references residences(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, residence_id)
);
alter table saved_residences enable row level security;
create policy "Users can view their saved residences" on saved_residences for select using (auth.uid() = user_id);
create policy "Users can save residences" on saved_residences for insert with check (auth.uid() = user_id);
create policy "Users can unsave residences" on saved_residences for delete using (auth.uid() = user_id);

create table housing_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  residence_id uuid references residences(id) on delete cascade not null,
  room_type_id uuid references room_types(id) on delete set null,
  kind text not null check (kind in ('question', 'viewing')),
  -- Always the first of a month — students plan around a term start, not
  -- an exact day.
  move_in_month date not null,
  duration_months int not null check (duration_months between 1 and 24),
  budget_aed int check (budget_aed > 0),
  -- The residence needs a way to reach the student, and Supabase auth
  -- emails aren't readable from the client — so the student gives one here.
  contact_phone text not null,
  message text,
  preferred_viewing text,
  status text not null default 'new' check (status in ('new', 'contacted', 'viewing_booked', 'signed', 'lost')),
  contract_value_aed numeric(12, 2) check (contract_value_aed > 0),
  -- Snapshotted when the enquiry is marked signed, so a later change to a
  -- residence's fee % never rewrites what an existing deal is owed.
  referral_fee_aed numeric(12, 2),
  fee_paid_at timestamptz,
  status_updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table housing_enquiries enable row level security;
create policy "Users can view their own enquiries, admins all" on housing_enquiries for select using (
  auth.uid() = user_id or public.is_admin()
);
-- A student can only ever create a fresh enquiry — status and money fields
-- are set exclusively through the admin RPCs below.
create policy "Users can create their own enquiries" on housing_enquiries for insert with check (
  auth.uid() = user_id and status = 'new' and contract_value_aed is null
  and referral_fee_aed is null and fee_paid_at is null
);
create index housing_enquiries_user_idx on housing_enquiries (user_id);
create index housing_enquiries_status_idx on housing_enquiries (status);

-- Moves an enquiry through the pipeline. Marking it signed requires the
-- contract value and computes the referral fee from the residence's
-- current terms; moving it off 'signed' clears both so the totals stay true.
create or replace function public.set_enquiry_status(
  enquiry_id_input uuid,
  status_input text,
  contract_value_input numeric default null
)
returns housing_enquiries
language plpgsql
security definer set search_path = public
as $$
declare
  enquiry housing_enquiries%rowtype;
  fee_percent numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can update enquiries.';
  end if;
  if status_input not in ('new', 'contacted', 'viewing_booked', 'signed', 'lost') then
    raise exception 'Unknown status: %', status_input;
  end if;

  select * into enquiry from housing_enquiries where id = enquiry_id_input;
  if enquiry.id is null then
    raise exception 'This enquiry no longer exists.';
  end if;

  if status_input = 'signed' then
    if contract_value_input is null or contract_value_input <= 0 then
      raise exception 'Enter the contract value to mark this as signed.';
    end if;
    select referral_fee_percent into fee_percent from residence_partner_terms where residence_id = enquiry.residence_id;
    if fee_percent is null then
      raise exception 'Set this residence''s referral fee percentage first.';
    end if;
    update housing_enquiries set
      status = 'signed',
      contract_value_aed = contract_value_input,
      referral_fee_aed = round(contract_value_input * fee_percent / 100, 2),
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  else
    update housing_enquiries set
      status = status_input,
      contract_value_aed = null,
      referral_fee_aed = null,
      fee_paid_at = null,
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  end if;

  return enquiry;
end;
$$;
grant execute on function public.set_enquiry_status(uuid, text, numeric) to authenticated;

create or replace function public.set_referral_fee_paid(enquiry_id_input uuid, paid boolean)
returns housing_enquiries
language plpgsql
security definer set search_path = public
as $$
declare
  enquiry housing_enquiries%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can update enquiries.';
  end if;
  update housing_enquiries set fee_paid_at = case when paid then now() else null end
  where id = enquiry_id_input and status = 'signed'
  returning * into enquiry;
  if enquiry.id is null then
    raise exception 'Only a signed enquiry can be marked as paid.';
  end if;
  return enquiry;
end;
$$;
grant execute on function public.set_referral_fee_paid(uuid, boolean) to authenticated;

insert into storage.buckets (id, name, public) values ('residence-photos', 'residence-photos', true)
on conflict (id) do nothing;
create policy "Residence photos are publicly viewable" on storage.objects for select using (bucket_id = 'residence-photos');
create policy "Admins can upload residence photos" on storage.objects for insert with check (
  bucket_id = 'residence-photos' and public.is_admin()
);
create policy "Admins can update residence photos" on storage.objects for update using (
  bucket_id = 'residence-photos' and public.is_admin()
);
create policy "Admins can delete residence photos" on storage.objects for delete using (
  bucket_id = 'residence-photos' and public.is_admin()
);
