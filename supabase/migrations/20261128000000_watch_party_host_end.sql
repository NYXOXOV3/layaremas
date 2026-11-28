-- Add ended_at column and host info to watch_parties
alter table public.watch_parties
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid;

-- Index for ended rooms
create index if not exists watch_parties_ended_idx on public.watch_parties (ended_at);

-- Function to end a room (host only)
create or replace function public.end_watch_party(
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_host_id uuid;
begin
  -- Verify caller is host
  select host_id into v_host_id
  from public.watch_parties
  where code = p_code and is_active;

  if not found then
    raise exception 'Watch party not found or inactive' using errcode = 'P0002';
  end if;

  if v_host_id <> auth.uid() then
    raise exception 'Only the host can end the room' using errcode = '42501';
  end if;

  -- Mark as ended
  update public.watch_parties
  set is_active = false,
      ended_at = pg_catalog.now(),
      ended_by = auth.uid()
  where code = p_code;

  -- Remove all members (optional - or keep for history)
  delete from public.party_members where code = p_code;

  return true;
end;
$$;

revoke all on function public.end_watch_party(text) from public, anon, authenticated;
grant execute on function public.end_watch_party(text) to authenticated;

-- Drop old function first (can't change return type with CREATE OR REPLACE)
drop function if exists public.list_public_watch_parties_with_options();

-- Updated list function with host info and ended status
create function public.list_public_watch_parties_with_options()
returns table (
  code text,
  episode integer,
  max_capacity integer,
  media_type text,
  scheduled_at timestamptz,
  season integer,
  title text,
  tmdb_id integer,
  viewers integer,
  host_id uuid,
  host_email text,
  host_name text,
  host_avatar text,
  created_at timestamptz,
  is_active boolean,
  ended_at timestamptz,
  ended_by uuid
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
    ) as viewers,
    room.host_id,
    prof.email as host_email,
    prof.raw_user_meta_data->>'full_name' as host_name,
    prof.raw_user_meta_data->>'avatar_url' as host_avatar,
    room.created_at,
    room.is_active,
    room.ended_at,
    room.ended_by
  from public.watch_parties as room
  left join auth.users as prof on prof.id = room.host_id
  where room.visibility = 'public'
    and (room.is_active or room.ended_at is not null) -- Show active + ended rooms
    and (room.scheduled_at is null or room.scheduled_at <= pg_catalog.now()) -- Exclude future scheduled
  order by
    case when room.is_active then 0 else 1 end, -- Active first
    room.scheduled_at nulls first,
    room.created_at desc;
$$;

revoke all on function public.list_public_watch_parties_with_options() from public;
grant execute on function public.list_public_watch_parties_with_options() to anon, authenticated;

-- Auto-end rooms older than 24 hours (run via pg_cron or scheduled job)
create or replace function public.auto_end_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count integer := 0;
  v_room record;
begin
  -- Find active rooms older than 24 hours (not scheduled, not already ended)
  for v_room in
    select code, host_id
    from public.watch_parties
    where is_active
      and (scheduled_at is null or scheduled_at < pg_catalog.now())
      and ended_at is null
      and created_at < pg_catalog.now() - interval '24 hours'
  loop
    -- End the room
    update public.watch_parties
    set is_active = false,
        ended_at = pg_catalog.now(),
        ended_by = v_room.host_id
    where code = v_room.code;

    delete from public.party_members where code = v_room.code;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.auto_end_expired_rooms() from public, anon, authenticated;
grant execute on function public.auto_end_expired_rooms() to authenticated;

-- Optional: pg_cron job (run every hour)
-- SELECT cron.schedule('auto-end-rooms', '0 * * * *', 'SELECT public.auto_end_expired_rooms();');