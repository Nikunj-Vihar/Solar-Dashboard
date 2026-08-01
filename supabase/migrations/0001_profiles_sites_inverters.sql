-- Profiles, sites, inverters — the setup-time entities from spec §3.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up, so the rest
-- of the schema can assume every auth.users row has a matching profile.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- Shared helper: keep `updated_at` current on any row update.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  timezone text not null default 'Asia/Kolkata',
  commissioning_date date,
  tariff_rate_inr_per_kwh numeric(8,4),
  -- India CEA CO2 baseline database all-India average grid emission factor (approximate, configurable).
  grid_emission_factor_kg_per_kwh numeric(6,4) not null default 0.716,
  is_public boolean not null default false,
  public_share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sites_owner on sites(owner_id);

create trigger trg_sites_updated_at
  before update on sites
  for each row execute function set_updated_at();

-- exactly 4 inverters per site for V1 (matches the client's current setup and the
-- fixed-4-row daily logging screen); enforced by the setup wizard, not a DB constraint,
-- since settings edits existing inverters rather than adding new ones.
create table inverters (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  manufacturer text,
  model text,
  rated_capacity_kw numeric(8,2) not null check (rated_capacity_kw > 0),
  dc_capacity_kwp numeric(8,2) not null check (dc_capacity_kwp > 0),
  install_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_inverters_site on inverters(site_id);

create trigger trg_inverters_updated_at
  before update on inverters
  for each row execute function set_updated_at();
