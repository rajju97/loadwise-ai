-- Run manually in SQL Editor while validating a development project.
-- This file intentionally performs read-only structural checks.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','organizations','organization_members','vehicles','products','optimization_jobs','load_plans')
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema in ('public','private')
  and routine_name in ('is_org_member','is_org_admin','handle_new_user','set_updated_at')
order by routine_schema, routine_name;
