-- LoadWise AI multi-tenant schema for Supabase Postgres
-- Run in the Supabase SQL editor, then use the RLS tester/advisors before production.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','planner','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  vehicle_type text,
  length_cm numeric not null check (length_cm > 0),
  width_cm numeric not null check (width_cm > 0),
  height_cm numeric not null check (height_cm > 0),
  max_payload_kg numeric not null check (max_payload_kg > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  length_cm numeric not null check (length_cm > 0),
  width_cm numeric not null check (width_cm > 0),
  height_cm numeric not null check (height_cm > 0),
  weight_kg numeric not null check (weight_kg > 0),
  allow_rotation boolean not null default true,
  stackable boolean not null default true,
  fragile boolean not null default false,
  color text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status text not null default 'completed' check (status in ('queued','running','completed','failed')),
  objective text not null default 'balanced_utilization' check (objective in ('balanced_utilization','maximum_volume','maximum_payload')),
  input_data jsonb not null,
  result_data jsonb,
  runtime_ms integer check (runtime_ms is null or runtime_ms >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.load_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  optimization_job_id uuid references public.optimization_jobs(id) on delete set null,
  name text not null,
  reference_code text,
  plan_data jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference_code)
);

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );

  insert into public.organizations (name, created_by)
  values (
    coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), 'Main workspace'),
    new.id
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.is_org_admin(uuid) from public, anon;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.set_updated_at() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at before update on public.vehicles for each row execute function private.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
drop trigger if exists plans_set_updated_at on public.load_plans;
create trigger plans_set_updated_at before update on public.load_plans for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.vehicles enable row level security;
alter table public.products enable row level security;
alter table public.optimization_jobs enable row level security;
alter table public.load_plans enable row level security;

-- Re-running the file should replace policies cleanly.
drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "organizations_read_member" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "members_read_member" on public.organization_members;
drop policy if exists "members_manage_admin" on public.organization_members;
drop policy if exists "vehicles_member_all" on public.vehicles;
drop policy if exists "products_member_all" on public.products;
drop policy if exists "jobs_member_all" on public.optimization_jobs;
drop policy if exists "plans_member_all" on public.load_plans;

drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists organizations_read_member on public.organizations;
drop policy if exists organizations_update_admin on public.organizations;
drop policy if exists members_read_member on public.organization_members;
drop policy if exists members_insert_admin on public.organization_members;
drop policy if exists members_update_admin on public.organization_members;
drop policy if exists members_delete_admin on public.organization_members;
drop policy if exists vehicles_select_member on public.vehicles;
drop policy if exists vehicles_insert_member on public.vehicles;
drop policy if exists vehicles_update_owner_admin on public.vehicles;
drop policy if exists vehicles_delete_owner_admin on public.vehicles;
drop policy if exists products_select_member on public.products;
drop policy if exists products_insert_member on public.products;
drop policy if exists products_update_owner_admin on public.products;
drop policy if exists products_delete_owner_admin on public.products;
drop policy if exists jobs_select_member on public.optimization_jobs;
drop policy if exists jobs_insert_member on public.optimization_jobs;
drop policy if exists jobs_update_owner_admin on public.optimization_jobs;
drop policy if exists jobs_delete_owner_admin on public.optimization_jobs;
drop policy if exists plans_select_member on public.load_plans;
drop policy if exists plans_insert_member on public.load_plans;
drop policy if exists plans_update_owner_admin on public.load_plans;
drop policy if exists plans_delete_owner_admin on public.load_plans;

drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.handle_new_user();

create policy profiles_read_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy organizations_read_member on public.organizations
for select to authenticated
using ((select private.is_org_member(id)));

create policy organizations_update_admin on public.organizations
for update to authenticated
using ((select private.is_org_admin(id)))
with check ((select private.is_org_admin(id)));

create policy members_read_member on public.organization_members
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy members_insert_admin on public.organization_members
for insert to authenticated
with check ((select private.is_org_admin(organization_id)));

create policy members_update_admin on public.organization_members
for update to authenticated
using ((select private.is_org_admin(organization_id)))
with check ((select private.is_org_admin(organization_id)));

create policy members_delete_admin on public.organization_members
for delete to authenticated
using ((select private.is_org_admin(organization_id)));

create policy vehicles_select_member on public.vehicles
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy vehicles_insert_member on public.vehicles
for insert to authenticated
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy vehicles_update_owner_admin on public.vehicles
for update to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
with check ((select private.is_org_member(organization_id)) and (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id))));

create policy vehicles_delete_owner_admin on public.vehicles
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)));

create policy products_select_member on public.products
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy products_insert_member on public.products
for insert to authenticated
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy products_update_owner_admin on public.products
for update to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
with check ((select private.is_org_member(organization_id)) and (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id))));

create policy products_delete_owner_admin on public.products
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)));

create policy jobs_select_member on public.optimization_jobs
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy jobs_insert_member on public.optimization_jobs
for insert to authenticated
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy jobs_update_owner_admin on public.optimization_jobs
for update to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
with check ((select private.is_org_member(organization_id)) and (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id))));

create policy jobs_delete_owner_admin on public.optimization_jobs
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)));

create policy plans_select_member on public.load_plans
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy plans_insert_member on public.load_plans
for insert to authenticated
with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));

create policy plans_update_owner_admin on public.load_plans
for update to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
with check ((select private.is_org_member(organization_id)) and (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id))));

create policy plans_delete_owner_admin on public.load_plans
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)));

-- Explicit grants are required for projects where public tables are not exposed automatically.
revoke all on table public.profiles, public.organizations, public.organization_members, public.vehicles, public.products, public.optimization_jobs, public.load_plans from anon;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.optimization_jobs to authenticated;
grant select, insert, update, delete on table public.load_plans to authenticated;

create index if not exists organization_members_user_idx on public.organization_members(user_id, organization_id);
create index if not exists vehicles_org_idx on public.vehicles(organization_id);
create index if not exists products_org_idx on public.products(organization_id);
create index if not exists jobs_org_created_idx on public.optimization_jobs(organization_id, created_at desc);
create index if not exists plans_org_created_idx on public.load_plans(organization_id, created_at desc);
