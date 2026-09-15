-- ==================== BRAND OFFERS ====================
-- Phase one of monetization: brands are invoiced manually outside the app
-- (no Stripe yet), so there's no brand login or self-serve posting — an
-- admin creates the brand and its offers, same admin-only pattern already
-- used for events. Streak-gated: an offer only becomes claimable once a
-- user's current_streak meets min_streak.

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  category text not null,
  description text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table brands enable row level security;
create policy "Brands are viewable by everyone" on brands for select using (true);
create policy "Admins can create brands" on brands for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update brands" on brands for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete brands" on brands for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  title text not null,
  description text,
  image_url text,
  -- Free text ("20% off", "Free drink with any meal") rather than a
  -- structured discount type — simpler for a manually-curated v1, and
  -- brands' real offers rarely fit one clean shape anyway.
  discount_label text not null,
  -- 0 = open to everyone; a real streak requirement gates it behind
  -- current_streak, checked server-side in claim_offer() below.
  min_streak int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table offers enable row level security;
create policy "Offers are viewable by everyone" on offers for select using (true);
create policy "Admins can create offers" on offers for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can update offers" on offers for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "Admins can delete offers" on offers for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- One claim per user per offer — claiming again just returns the same
-- code (see claim_offer()) rather than erroring, so a retry after a flaky
-- request doesn't need special-casing on the client.
create table offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  code text not null,
  claimed_at timestamptz default now(),
  -- Not written from the client anywhere yet — a place for a future
  -- "mark as redeemed" reconciliation step once brands have any way to
  -- report back, manual or otherwise.
  redeemed_at timestamptz,
  unique (offer_id, user_id)
);
alter table offer_claims enable row level security;
create policy "Users can view their own claims" on offer_claims for select using (auth.uid() = user_id);
-- No insert policy for authenticated — claim_offer() is the only path in,
-- since eligibility (streak, active window) needs server-side
-- verification, not just a client-side check before the insert.

-- Verifies eligibility and returns a redemption code — generates a new one
-- on first claim, or returns the existing one on a repeat call so this is
-- safe to retry.
create or replace function public.claim_offer(offer_id_input uuid)
returns table (code text, already_claimed boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  offer_row offers%rowtype;
  user_streak int;
  existing_code text;
  new_code text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into offer_row from offers where id = offer_id_input;
  if offer_row.id is null or not offer_row.is_active then
    raise exception 'This offer is not available.';
  end if;
  if offer_row.starts_at > now() then
    raise exception 'This offer isn''t live yet.';
  end if;
  if offer_row.ends_at is not null and offer_row.ends_at < now() then
    raise exception 'This offer has expired.';
  end if;

  select current_streak into user_streak from profiles where id = uid;
  if coalesce(user_streak, 0) < offer_row.min_streak then
    raise exception 'You need a %-day streak to unlock this.', offer_row.min_streak;
  end if;

  select oc.code into existing_code from offer_claims oc where oc.offer_id = offer_id_input and oc.user_id = uid;
  if existing_code is not null then
    return query select existing_code, true;
    return;
  end if;

  -- Short, human-typeable code — a staff member reads it off the user's
  -- screen for a manual reconciliation with the brand, no scanner needed.
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into offer_claims (offer_id, user_id, code) values (offer_id_input, uid, new_code);

  return query select new_code, false;
end;
$$;

grant execute on function public.claim_offer(uuid) to authenticated;
