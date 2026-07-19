create table if not exists private.optimizer_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_started_at)
);

alter table private.optimizer_rate_limits enable row level security;
revoke all on table private.optimizer_rate_limits from public, anon, authenticated;

create or replace function private.consume_optimizer_quota()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_window timestamptz;
  current_count integer;
  retry_after integer;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  current_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / 60) * 60);

  insert into private.optimizer_rate_limits (user_id, window_started_at, request_count)
  values (caller_id, current_window, 1)
  on conflict (user_id, window_started_at)
  do update set request_count = private.optimizer_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from private.optimizer_rate_limits
  where user_id = caller_id
    and window_started_at < current_window - interval '1 day';

  retry_after := greatest(
    1,
    ceil(extract(epoch from (current_window + interval '60 seconds') - clock_timestamp()))::integer
  );

  return jsonb_build_object(
    'allowed', current_count <= 6,
    'request_count', current_count,
    'limit', 6,
    'retry_after_seconds', retry_after,
    'user_id', caller_id
  );
end;
$$;

revoke all on function private.consume_optimizer_quota() from public, anon;
grant execute on function private.consume_optimizer_quota() to authenticated;

create or replace function public.consume_optimizer_quota()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.consume_optimizer_quota();
$$;

revoke all on function public.consume_optimizer_quota() from public, anon;
grant execute on function public.consume_optimizer_quota() to authenticated;
