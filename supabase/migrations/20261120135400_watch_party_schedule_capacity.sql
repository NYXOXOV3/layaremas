alter table public.watch_parties
  add column if not exists scheduled_at timestamptz,
  add column if not exists max_capacity integer not null default 10
    check (max_capacity between 2 and 50);

create index if not exists party_members_active_lookup_idx
  on public.party_members (code, last_seen_at);

create or replace function public.enforce_watch_party_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_capacity integer;
  v_active_count integer;
begin
  if tg_op = 'UPDATE' then
    if old.code is distinct from new.code or old.user_id is distinct from new.user_id then
      raise exception 'Party membership identity cannot be changed'
        using errcode = '22023';
    end if;
  end if;

  select wp.max_capacity
    into v_capacity
    from public.watch_parties as wp
   where wp.code = new.code
     and wp.is_active
   for update;

  if not found then
    raise exception 'Watch party is unavailable' using errcode = 'P0002';
  end if;

  select count(*)::integer
    into v_active_count
    from public.party_members as pm
   where pm.code = new.code
     and pm.user_id <> new.user_id
     and pm.last_seen_at > pg_catalog.now() - interval '120 seconds';

  if v_active_count >= v_capacity then
    raise exception 'Watch party room is full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_watch_party_capacity on public.party_members;
create trigger enforce_watch_party_capacity
before insert or update of code, user_id, last_seen_at
on public.party_members
for each row
execute function public.enforce_watch_party_capacity();

create or replace function public.create_watch_party_with_options(
  p_code text,
  p_type text,
  p_tmdb_id integer,
  p_title text,
  p_season integer,
  p_episode integer,
  p_visibility text,
  p_pin text,
  p_name text,
  p_scheduled_at timestamptz,
  p_max_capacity integer
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_max_capacity is null or p_max_capacity not between 2 and 50 then
    raise exception 'Capacity must be between 2 and 50' using errcode = '22023';
  end if;
  if p_scheduled_at is not null and p_scheduled_at <= pg_catalog.now() then
    raise exception 'Schedule must be in the future' using errcode = '22023';
  end if;

  v_code := public.create_watch_party(
    p_code := p_code,
    p_type := p_type,
    p_tmdb_id := p_tmdb_id,
    p_title := p_title,
    p_season := p_season,
    p_episode := p_episode,
    p_visibility := p_visibility,
    p_pin := p_pin,
    p_name := p_name
  );

  update public.watch_parties
     set scheduled_at = p_scheduled_at,
         max_capacity = p_max_capacity
   where code = v_code;

  if not found then
    raise exception 'Created watch party could not be updated' using errcode = 'P0002';
  end if;

  return v_code;
end;
$$;

create or replace function public.list_public_watch_parties_with_options()
returns table (
  code text,
  episode integer,
  max_capacity integer,
  media_type text,
  scheduled_at timestamptz,
  season integer,
  title text,
  tmdb_id integer,
  viewers integer
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    room.code,
    room.episode,
    room.max_capacity,
    room.media_type,
    room.scheduled_at,
    room.season,
    room.title,
    room.tmdb_id,
    (
      select count(*)::integer
        from public.party_members as pm
       where pm.code = room.code
         and pm.last_seen_at > pg_catalog.now() - interval '120 seconds'
    ) as viewers
  from public.watch_parties as room
  where room.visibility = 'public'
    and room.is_active
  order by room.scheduled_at nulls first, room.created_at desc;
$$;

revoke all on function public.enforce_watch_party_capacity() from public, anon, authenticated;
revoke all on function public.create_watch_party_with_options(
  text, text, integer, text, integer, integer, text, text, text, timestamptz, integer
) from public, anon, authenticated;
revoke all on function public.list_public_watch_parties_with_options() from public;
grant execute on function public.create_watch_party_with_options(
  text, text, integer, text, integer, integer, text, text, text, timestamptz, integer
) to authenticated;
grant execute on function public.list_public_watch_parties_with_options() to anon, authenticated;
