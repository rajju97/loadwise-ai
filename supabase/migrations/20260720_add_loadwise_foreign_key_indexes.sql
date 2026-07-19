create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists vehicles_created_by_idx on public.vehicles(created_by);
create index if not exists products_created_by_idx on public.products(created_by);
create index if not exists optimization_jobs_vehicle_idx on public.optimization_jobs(vehicle_id);
create index if not exists optimization_jobs_created_by_idx on public.optimization_jobs(created_by);
create index if not exists load_plans_job_idx on public.load_plans(optimization_job_id);
create index if not exists load_plans_created_by_idx on public.load_plans(created_by);
