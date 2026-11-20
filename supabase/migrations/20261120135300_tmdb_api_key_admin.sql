create table if not exists public.tmdb_api_settings (
  id smallint primary key default 1 check (id = 1),
  api_key text not null check (length(btrim(api_key)) between 1 and 4096),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.tmdb_api_settings enable row level security;
revoke all privileges on table public.tmdb_api_settings from public, anon, authenticated;
grant select on table public.tmdb_api_settings to service_role;

create or replace function public.admin_tmdb_api_key_configured()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.tmdb_api_settings
    where id = 1
  );
end;
$$;

create or replace function public.admin_set_tmdb_api_key(p_api_key text)
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

  if p_api_key is null or length(btrim(p_api_key)) not between 1 and 4096 then
    raise exception 'Invalid TMDB API key' using errcode = '22023';
  end if;

  insert into public.tmdb_api_settings (id, api_key, updated_by)
  values (1, btrim(p_api_key), auth.uid())
  on conflict (id) do update
  set api_key = excluded.api_key,
      updated_at = pg_catalog.now(),
      updated_by = auth.uid();

  insert into public.admin_audit_log (admin_id, action, target_id)
  values (auth.uid(), 'tmdb.api_key.set', 'tmdb');
end;
$$;

create or replace function public.admin_clear_tmdb_api_key()
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

  delete from public.tmdb_api_settings where id = 1;

  insert into public.admin_audit_log (admin_id, action, target_id)
  values (auth.uid(), 'tmdb.api_key.clear', 'tmdb');
end;
$$;

revoke all on function public.admin_tmdb_api_key_configured() from public;
revoke all on function public.admin_set_tmdb_api_key(text) from public;
revoke all on function public.admin_clear_tmdb_api_key() from public;
grant execute on function public.admin_tmdb_api_key_configured() to authenticated;
grant execute on function public.admin_set_tmdb_api_key(text) to authenticated;
grant execute on function public.admin_clear_tmdb_api_key() to authenticated;
