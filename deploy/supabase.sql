-- Run once in the Supabase SQL editor. Sign in from the app with an existing Auth user.
create table if not exists public.planner_snapshots (
  owner_id uuid not null references auth.users(id) on delete cascade,
  data_id text not null check (data_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  payload text not null check (octet_length(payload) <= 7000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, data_id)
);
alter table public.planner_snapshots enable row level security;
drop policy if exists "Own planner snapshots" on public.planner_snapshots;
create policy "Own planner snapshots" on public.planner_snapshots for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.planner_snapshots from anon;
grant select, insert, update on public.planner_snapshots to authenticated;

create or replace function public.planner_head(p_data_id text) returns text
language sql stable security invoker set search_path = '' as $$
  select hash from public.planner_snapshots where owner_id = auth.uid() and data_id = p_data_id;
$$;
create or replace function public.planner_read(p_data_id text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('hash', hash, 'payload', payload, 'updatedAt', updated_at)
  from public.planner_snapshots where owner_id = auth.uid() and data_id = p_data_id;
$$;
create or replace function public.planner_write(p_data_id text, p_snapshot jsonb, p_expected_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_expected_hash is null then
    insert into public.planner_snapshots(owner_id,data_id,hash,payload)
    values(auth.uid(),p_data_id,p_snapshot->>'hash',p_snapshot->>'payload')
    on conflict (owner_id,data_id) do nothing;
  else
    update public.planner_snapshots set hash=p_snapshot->>'hash', payload=p_snapshot->>'payload', updated_at=now()
    where owner_id=auth.uid() and data_id=p_data_id and hash=p_expected_hash;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.planner_head(text), public.planner_read(text), public.planner_write(text,jsonb,text) from public, anon;
grant execute on function public.planner_head(text), public.planner_read(text), public.planner_write(text,jsonb,text) to authenticated;
