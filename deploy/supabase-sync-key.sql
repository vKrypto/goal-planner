-- Optional login-free method. Run once in Supabase's SQL editor.
-- Separate from existing account-owned planner_snapshots; no existing rows are modified.
-- Anyone holding the 256-bit private sync key can read/write its workspace.
create schema if not exists planner_private;
revoke all on schema planner_private from public, anon, authenticated;
create table if not exists planner_private.key_snapshots (
  key_hash text not null,
  data_id text not null check (data_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  payload text not null check (octet_length(payload) <= 7000000),
  updated_at timestamptz not null default now(),
  primary key (key_hash, data_id)
);
alter table planner_private.key_snapshots enable row level security;
revoke all on planner_private.key_snapshots from public, anon, authenticated;

create or replace function public.planner_key_head(p_data_id text, p_sync_key text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_sync_key is null or p_sync_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync key'; end if;
  return (select hash from planner_private.key_snapshots
    where key_hash=encode(sha256(convert_to(p_sync_key,'UTF8')),'hex') and data_id=p_data_id);
end;
$$;
create or replace function public.planner_key_read(p_data_id text, p_sync_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_sync_key is null or p_sync_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync key'; end if;
  return (select jsonb_build_object('hash',hash,'payload',payload,'updatedAt',updated_at)
    from planner_private.key_snapshots
    where key_hash=encode(sha256(convert_to(p_sync_key,'UTF8')),'hex') and data_id=p_data_id);
end;
$$;
create or replace function public.planner_key_write(p_data_id text, p_sync_key text, p_snapshot jsonb, p_expected_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if p_sync_key is null or p_sync_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync key'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot->'hash') is distinct from 'string'
    or jsonb_typeof(p_snapshot->'payload') is distinct from 'string' then raise exception 'Invalid snapshot'; end if;
  if p_expected_hash is null then
    insert into planner_private.key_snapshots(key_hash,data_id,hash,payload)
    values(encode(sha256(convert_to(p_sync_key,'UTF8')),'hex'),p_data_id,p_snapshot->>'hash',p_snapshot->>'payload')
    on conflict (key_hash,data_id) do nothing;
  else
    update planner_private.key_snapshots set hash=p_snapshot->>'hash',payload=p_snapshot->>'payload',updated_at=now()
    where key_hash=encode(sha256(convert_to(p_sync_key,'UTF8')),'hex') and data_id=p_data_id and hash=p_expected_hash;
  end if;
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
revoke all on function public.planner_key_head(text,text), public.planner_key_read(text,text), public.planner_key_write(text,text,jsonb,text) from public;
grant execute on function public.planner_key_head(text,text), public.planner_key_read(text,text), public.planner_key_write(text,text,jsonb,text) to anon, authenticated;
