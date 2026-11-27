-- Multi-key rotation for the ShortMax (apishort) API.
-- Each key is subject to a small daily quota (100 requests/day), so requests
-- are spread round-robin across all active keys.

create table if not exists public.shortmax_api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  api_key text not null check (length(btrim(api_key)) between 1 and 4096),
  is_active boolean not null default true,
  requests_today integer not null default 0 check (requests_today >= 0),
  request_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.shortmax_api_keys enable row level security;

-- Only service role reads/writes; admins manage through audited RPCs.
revoke all privileges on table public.shortmax_api_keys from public, anon, authenticated;
grant select on table public.shortmax_api_keys to service_role;
grant insert, update, delete on table public.shortmax_api_keys to service_role;

create or replace function public.admin_shortmax_api_keys()
returns setof public.shortmax_api_keys
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
  select id, name, api_key, is_active, requests_today, request_date, created_at, updated_by
  from public.shortmax_api_keys
  order by created_at desc;
end;
$$;

create or replace function public.admin_set_shortmax_api_key(
  p_id uuid,
  p_name text,
  p_api_key text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Invalid key name' using errcode = '22023';
  end if;
  if p_api_key is null or length(btrim(p_api_key)) not between 1 and 4096 then
    raise exception 'Invalid API key' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.shortmax_api_keys (name, api_key, is_active, updated_by)
    values (btrim(p_name), btrim(p_api_key), p_is_active, auth.uid())
    returning id into p_id;
  else
    update public.shortmax_api_keys
    set name = btrim(p_name),
        api_key = btrim(p_api_key),
        is_active = p_is_active,
        updated_by = auth.uid()
    where id = p_id;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_id)
  values (auth.uid(),
          case when p_id is null then 'shortmax.api_key.create' else 'shortmax.api_key.update' end,
          p_id::text);

  return p_id;
end;
$$;

create or replace function public.admin_delete_shortmax_api_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  delete from public.shortmax_api_keys where id = p_id;

  insert into public.admin_audit_log (admin_id, action, target_id)
  values (auth.uid(), 'shortmax.api_key.delete', p_id::text);
end;
$$;

revoke all on function public.admin_shortmax_api_keys() from public;
revoke all on function public.admin_set_shortmax_api_key(uuid, text, text, boolean) from public;
revoke all on function public.admin_delete_shortmax_api_key(uuid) from public;
grant execute on function public.admin_shortmax_api_keys() to authenticated;
grant execute on function public.admin_set_shortmax_api_key(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_shortmax_api_key(uuid) to authenticated;
