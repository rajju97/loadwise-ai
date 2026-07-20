-- Enforce workspace role boundaries and save optimization jobs/plans atomically.

create or replace function private.has_org_role(target_org uuid, allowed_roles text[])
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
      and member.role = any(allowed_roles)
  );
$$;

create or replace function private.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(target_org, array['owner']::text[]);
$$;

create or replace function private.can_plan(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(target_org, array['owner', 'admin', 'planner']::text[]);
$$;

revoke all on function private.has_org_role(uuid, text[]) from public, anon;
revoke all on function private.is_org_owner(uuid) from public, anon;
revoke all on function private.can_plan(uuid) from public, anon;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.can_plan(uuid) to authenticated;

create or replace function private.protect_workspace_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_by is distinct from old.created_by then
    raise exception 'Workspace identity fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.protect_member_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id or new.user_id is distinct from old.user_id then
    raise exception 'Membership identity fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.protect_owned_record_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id or new.created_by is distinct from old.created_by then
    raise exception 'Record ownership fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_workspace_identity() from public, anon, authenticated;
revoke all on function private.protect_member_identity() from public, anon, authenticated;
revoke all on function private.protect_owned_record_identity() from public, anon, authenticated;

drop trigger if exists organizations_protect_identity on public.organizations;
create trigger organizations_protect_identity
before update on public.organizations
for each row execute function private.protect_workspace_identity();

drop trigger if exists organization_members_protect_identity on public.organization_members;
create trigger organization_members_protect_identity
before update on public.organization_members
for each row execute function private.protect_member_identity();

drop trigger if exists vehicles_protect_identity on public.vehicles;
create trigger vehicles_protect_identity
before update on public.vehicles
for each row execute function private.protect_owned_record_identity();

drop trigger if exists products_protect_identity on public.products;
create trigger products_protect_identity
before update on public.products
for each row execute function private.protect_owned_record_identity();

drop trigger if exists jobs_protect_identity on public.optimization_jobs;
create trigger jobs_protect_identity
before update on public.optimization_jobs
for each row execute function private.protect_owned_record_identity();

drop trigger if exists plans_protect_identity on public.load_plans;
create trigger plans_protect_identity
before update on public.load_plans
for each row execute function private.protect_owned_record_identity();

-- Only owners may manage non-owner memberships. Ownership transfer requires a dedicated future workflow.
drop policy if exists members_insert_admin on public.organization_members;
drop policy if exists members_update_admin on public.organization_members;
drop policy if exists members_delete_admin on public.organization_members;

create policy members_insert_owner on public.organization_members
for insert to authenticated
with check (
  (select private.is_org_owner(organization_id))
  and role in ('admin', 'planner', 'viewer')
);

create policy members_update_owner on public.organization_members
for update to authenticated
using (
  (select private.is_org_owner(organization_id))
  and role <> 'owner'
)
with check (
  (select private.is_org_owner(organization_id))
  and role in ('admin', 'planner', 'viewer')
);

create policy members_delete_owner on public.organization_members
for delete to authenticated
using (
  (select private.is_org_owner(organization_id))
  and role <> 'owner'
);

-- Viewers are read-only. Planners can create and maintain their own records; admins/owners can manage all workspace records.
drop policy if exists vehicles_insert_member on public.vehicles;
drop policy if exists vehicles_update_owner_admin on public.vehicles;
drop policy if exists vehicles_delete_owner_admin on public.vehicles;
create policy vehicles_insert_planner on public.vehicles
for insert to authenticated
with check ((select private.can_plan(organization_id)) and created_by = (select auth.uid()));
create policy vehicles_update_planner_admin on public.vehicles
for update to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)))
with check (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));
create policy vehicles_delete_planner_admin on public.vehicles
for delete to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));

drop policy if exists products_insert_member on public.products;
drop policy if exists products_update_owner_admin on public.products;
drop policy if exists products_delete_owner_admin on public.products;
create policy products_insert_planner on public.products
for insert to authenticated
with check ((select private.can_plan(organization_id)) and created_by = (select auth.uid()));
create policy products_update_planner_admin on public.products
for update to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)))
with check (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));
create policy products_delete_planner_admin on public.products
for delete to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));

drop policy if exists jobs_insert_member on public.optimization_jobs;
drop policy if exists jobs_update_owner_admin on public.optimization_jobs;
drop policy if exists jobs_delete_owner_admin on public.optimization_jobs;
create policy jobs_insert_planner on public.optimization_jobs
for insert to authenticated
with check ((select private.can_plan(organization_id)) and created_by = (select auth.uid()));
create policy jobs_update_planner_admin on public.optimization_jobs
for update to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)))
with check (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));
create policy jobs_delete_planner_admin on public.optimization_jobs
for delete to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));

drop policy if exists plans_insert_member on public.load_plans;
drop policy if exists plans_update_owner_admin on public.load_plans;
drop policy if exists plans_delete_owner_admin on public.load_plans;
create policy plans_insert_planner on public.load_plans
for insert to authenticated
with check ((select private.can_plan(organization_id)) and created_by = (select auth.uid()));
create policy plans_update_planner_admin on public.load_plans
for update to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)))
with check (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));
create policy plans_delete_planner_admin on public.load_plans
for delete to authenticated
using (((created_by = (select auth.uid())) and (select private.can_plan(organization_id))) or (select private.is_org_admin(organization_id)));

create or replace function public.save_load_plan(
  p_organization_id uuid,
  p_vehicle_id uuid,
  p_objective text,
  p_input_data jsonb,
  p_result_data jsonb,
  p_runtime_ms integer,
  p_name text,
  p_reference_code text,
  p_plan_data jsonb
)
returns public.load_plans
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_job_id uuid;
  saved_plan public.load_plans%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not private.can_plan(p_organization_id) then
    raise exception 'Planner access required' using errcode = '42501';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Plan name is required' using errcode = '22023';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = p_vehicle_id
      and organization_id = p_organization_id
  ) then
    raise exception 'Vehicle does not belong to this workspace' using errcode = '22023';
  end if;

  insert into public.optimization_jobs (
    organization_id,
    vehicle_id,
    status,
    objective,
    input_data,
    result_data,
    runtime_ms,
    created_by
  ) values (
    p_organization_id,
    p_vehicle_id,
    'completed',
    p_objective,
    p_input_data,
    p_result_data,
    p_runtime_ms,
    caller_id
  ) returning id into new_job_id;

  insert into public.load_plans (
    organization_id,
    optimization_job_id,
    name,
    reference_code,
    plan_data,
    created_by
  ) values (
    p_organization_id,
    new_job_id,
    trim(p_name),
    p_reference_code,
    p_plan_data,
    caller_id
  ) returning * into saved_plan;

  return saved_plan;
end;
$$;

revoke all on function public.save_load_plan(uuid, uuid, text, jsonb, jsonb, integer, text, text, jsonb) from public, anon;
grant execute on function public.save_load_plan(uuid, uuid, text, jsonb, jsonb, integer, text, text, jsonb) to authenticated;
