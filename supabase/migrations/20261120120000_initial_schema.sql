-- Fresh-project baseline for the application. Apply this before the later
-- feature migrations in this directory.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.membership_tier as enum ('free', 'premium');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_banned boolean not null default false,
  membership_tier public.membership_tier not null default 'free',
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null check (length(btrim(action)) between 1 and 120),
  target_id text,
  created_at timestamptz not null default now()
);

create table public.server_config (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  base_url text not null check (
    base_url ~* '^https?://' or base_url ~ '^storage://[a-zA-Z0-9._-]+$'
  ),
  is_active boolean not null default true,
  premium_only boolean not null default false,
  priority integer not null default 0,
  last_checked_at timestamptz,
  last_latency_ms integer check (last_latency_ms is null or last_latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.media_catalog (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (length(btrim(title)) between 1 and 300),
  overview text not null default '',
  poster_path text,
  backdrop_path text,
  vote_average numeric(4, 2) not null default 0 check (vote_average between 0 and 10),
  release_date text,
  metadata jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

create table public.licensed_videos (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid references public.media_catalog(id) on delete restrict,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  season integer,
  episode integer,
  server_id uuid not null references public.server_config(id) on delete cascade,
  path text not null check (length(btrim(path)) between 1 and 1000),
  quality text not null default '1080p' check (length(quality) <= 20),
  title text check (title is null or length(title) <= 200),
  source_type text not null default 'video' check (source_type in ('video', 'embed')),
  created_at timestamptz not null default now(),
  check ((season is null) = (episode is null)),
  check (season is null or season > 0),
  check (episode is null or episode > 0)
);

create index licensed_videos_title_idx
  on public.licensed_videos (media_type, tmdb_id, season, episode);
create index licensed_videos_server_idx on public.licensed_videos (server_id);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  site_name text not null default 'Layar Emas' check (length(btrim(site_name)) between 1 and 60),
  description text not null default 'Discover movies and TV shows, keep a watchlist, and stream licensed titles.'
    check (length(description) <= 300),
  keywords text not null default 'film, movie, tv, streaming, nonton, film indonesia'
    check (length(keywords) <= 500),
  logo_url text,
  favicon_url text,
  og_image_url text,
  bg_image_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text check (background_color is null or background_color ~ '^#[0-9A-Fa-f]{6}$'),
  card_color text check (card_color is null or card_color ~ '^#[0-9A-Fa-f]{6}$'),
  movie_embed_template text not null default 'https://nxsha.space/embed/movie/{id}',
  tv_embed_template text not null default 'https://nxsha.space/embed/tv/{id}/{season}/{episode}',
  updated_at timestamptz not null default now()
);

create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  headline text not null default '' check (length(headline) <= 160),
  image_url text check (image_url is null or (length(image_url) <= 2000 and image_url ~* '^https://')),
  target_url text check (target_url is null or (length(target_url) <= 2000 and target_url ~* '^https://')),
  placement text not null check (
    placement in (
      'home', 'home_featured_extra', 'home_trending', 'home_trending_extra',
      'home_middle', 'home_movies_extra', 'home_tv', 'home_indo',
      'home_bottom', 'home_bottom_extra', 'details', 'details_bottom',
      'catalog_top', 'catalog_bottom', 'search_top', 'search_bottom',
      'watch_top', 'watch_bottom', 'watch_episodes', 'watch_recommendations',
      'party_top', 'party_bottom', 'party_directory_top', 'party_directory_bottom',
      'collection_top', 'collection_bottom', 'watchlist_top', 'watchlist_bottom',
      'browse_top', 'browse_bottom', 'preroll', 'footer'
    )
    or placement ~ '^(details|details_bottom|catalog_top|catalog_bottom|search_top|search_bottom|watch_top|watch_bottom|watch_episodes|watch_recommendations|party_top|party_bottom|party_directory_top|party_directory_bottom|collection_top|collection_bottom|watchlist_top|watchlist_bottom|browse_top|browse_bottom)_[23]$'
  ),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  duration_seconds integer not null default 5 check (duration_seconds between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (image_url is not null or length(btrim(headline)) > 0)
);

create table public.catalog_sync_jobs (
  id text primary key check (id in ('movie', 'tv')),
  enabled boolean not null default true,
  start_date date not null default date '2024-01-01',
  end_date date not null default current_date,
  export_date date,
  export_offset integer not null default 0 check (export_offset >= 0),
  import_complete boolean not null default false,
  page integer not null default 1 check (page > 0),
  changes_since date not null default current_date - 1,
  changes_page integer not null default 1 check (changes_page > 0),
  pending_ids integer[] not null default array[]::integer[],
  imported_count integer not null default 0 check (imported_count >= 0),
  lock_until timestamptz,
  last_error text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create table public.catalog_sync_queue (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  attempts integer not null default 0 check (attempts >= 0),
  synced_at timestamptz,
  primary key (media_type, tmdb_id)
);

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (length(btrim(title)) between 1 and 300),
  poster_path text,
  created_at timestamptz not null default now(),
  unique (user_id, media_type, tmdb_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (length(btrim(plan)) between 1 and 100),
  amount_idr integer not null check (amount_idr >= 0),
  status text not null default 'pending' check (length(btrim(status)) between 1 and 40),
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create table public.watch_parties (
  code text primary key check (code ~ '^([A-Z0-9]{6}|[A-F0-9]{32})$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  title text check (title is null or length(btrim(title)) between 1 and 300),
  season integer,
  episode integer,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  is_active boolean not null default true,
  playback_time double precision not null default 0 check (playback_time >= 0),
  playback_action text not null default 'pause' check (playback_action in ('play', 'pause')),
  playback_updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((season is null) = (episode is null)),
  check (season is null or season > 0),
  check (episode is null or episode > 0)
);

create table public.party_members (
  code text not null references public.watch_parties(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  last_seen_at timestamptz not null default now(),
  primary key (code, user_id)
);

create index party_members_active_lookup_idx
  on public.party_members (code, last_seen_at);

create table public.party_messages (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.watch_parties(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  text text not null check (length(btrim(text)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index party_messages_room_created_idx
  on public.party_messages (code, created_at desc);

create table public.party_secrets (
  code text primary key references public.watch_parties(code) on delete cascade,
  pin_hash text not null
);

create table public.party_join_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  window_start timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger media_catalog_set_updated_at
before update on public.media_catalog
for each row execute function public.set_updated_at();

create trigger advertisements_set_updated_at
before update on public.advertisements
for each row execute function public.set_updated_at();

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

create trigger catalog_sync_jobs_set_updated_at
before update on public.catalog_sync_jobs
for each row execute function public.set_updated_at();

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if _user_id is distinct from auth.uid()
    and auth.role() is distinct from 'service_role' then
    return false;
  end if;

  return exists (
    select 1
      from public.user_roles
     where user_id = _user_id
       and role = _role
  );
end;
$$;

create or replace function public.is_party_member(p_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
     and exists (
       select 1
         from public.party_members as member
        where member.code = upper(btrim(p_code))
          and member.user_id = auth.uid()
     );
$$;

create or replace function public.is_premium(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select _user_id = auth.uid()
     and exists (
       select 1
         from public.profiles as profile
        where profile.id = _user_id
          and profile.is_banned = false
          and profile.membership_tier = 'premium'
          and (profile.premium_until is null or profile.premium_until > pg_catalog.now())
     );
$$;

create or replace function public.title_available(_media_type text, _tmdb_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.licensed_videos as video
      join public.server_config as server on server.id = video.server_id
      join public.media_catalog as catalog
        on catalog.id = video.catalog_id
       and catalog.tmdb_id = video.tmdb_id
       and catalog.media_type = video.media_type
     where video.media_type = _media_type
       and video.tmdb_id = _tmdb_id
       and server.is_active
       and catalog.is_published
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_role public.app_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(76412853);

  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  if exists (select 1 from public.user_roles where role = 'admin'::public.app_role) then
    v_role := 'user';
  else
    v_role := 'admin';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.claim_catalog_sync_job(job_id text)
returns setof public.catalog_sync_jobs
language sql
security definer
set search_path = pg_catalog
as $$
  update public.catalog_sync_jobs as job
     set lock_until = pg_catalog.now() + interval '10 minutes',
         updated_at = pg_catalog.now()
   where job.id = $1
     and job.enabled
     and (job.lock_until is null or job.lock_until < pg_catalog.now())
  returning job.*;
$$;

create or replace function public.create_watch_party(
  p_code text,
  p_type text,
  p_tmdb_id integer,
  p_title text,
  p_season integer,
  p_episode integer,
  p_visibility text,
  p_pin text,
  p_name text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select profile.is_banned from public.profiles as profile where profile.id = auth.uid()), false) then
    raise exception 'Account is suspended' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('movie', 'tv')
    or p_tmdb_id is null or p_tmdb_id <= 0
    or p_title is null or length(btrim(p_title)) not between 1 and 300
    or p_season is null or p_season <= 0
    or p_episode is null or p_episode <= 0
    or p_visibility is null or p_visibility not in ('public', 'private')
    or p_name is null or length(btrim(p_name)) not between 1 and 80
    or v_code is null or v_code !~ '^([A-Z0-9]{6}|[A-F0-9]{32})$' then
    raise exception 'Invalid watch party details' using errcode = '22023';
  end if;
  if p_visibility = 'private' and coalesce(p_pin, '') !~ '^[0-9]{4,8}$' then
    raise exception 'Private rooms require a 4-8 digit PIN' using errcode = '22023';
  end if;

  insert into public.watch_parties (
    code, host_id, media_type, tmdb_id, title, season, episode, visibility
  ) values (
    v_code, auth.uid(), p_type, p_tmdb_id, btrim(p_title), p_season, p_episode, p_visibility
  );

  if p_visibility = 'private' then
    insert into public.party_secrets (code, pin_hash)
    values (v_code, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));
  end if;

  insert into public.party_members (code, user_id, display_name)
  values (v_code, auth.uid(), btrim(p_name));

  return v_code;
end;
$$;

create or replace function public.join_watch_party(p_code text, p_name text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_code text := upper(btrim(p_code));
  v_room public.watch_parties%rowtype;
  v_pin_hash text;
  v_attempts integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select profile.is_banned from public.profiles as profile where profile.id = auth.uid()), false)
    or p_name is null or length(btrim(p_name)) not between 1 and 80 then
    return false;
  end if;
  if v_code is null or v_code !~ '^([A-Z0-9]{6}|[A-F0-9]{32})$' then
    return false;
  end if;

  select room.*
    into v_room
    from public.watch_parties as room
   where room.code = v_code
     and room.is_active
   for update;

  if not found then
    return false;
  end if;

  if v_room.visibility = 'private' then
    if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
      return false;
    end if;

    insert into public.party_join_attempts as attempt (user_id, attempts, window_start)
    values (auth.uid(), 1, pg_catalog.now())
    on conflict (user_id) do update
      set attempts = case
              when attempt.window_start < pg_catalog.now() - interval '15 minutes' then 1
              else attempt.attempts + 1
          end,
          window_start = case
              when attempt.window_start < pg_catalog.now() - interval '15 minutes' then pg_catalog.now()
              else attempt.window_start
          end
    returning attempts into v_attempts;

    if v_attempts > 5 then
      return false;
    end if;

    select secret.pin_hash into v_pin_hash
      from public.party_secrets as secret
     where secret.code = v_code;
    if not found then
      return false;
    end if;
    if extensions.crypt(p_pin, v_pin_hash) is distinct from v_pin_hash then
      return false;
    end if;
  end if;

  insert into public.party_members (code, user_id, display_name, last_seen_at)
  values (v_code, auth.uid(), btrim(p_name), pg_catalog.now())
  on conflict (code, user_id) do update
    set display_name = excluded.display_name,
        last_seen_at = excluded.last_seen_at;

  update public.watch_parties
     set last_active_at = pg_catalog.now()
   where code = v_code;

  return true;
end;
$$;

create or replace function public.party_heartbeat(p_code text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.party_members
     set last_seen_at = pg_catalog.now()
   where code = v_code
     and user_id = auth.uid()
     and exists (
       select 1 from public.watch_parties as room
        where room.code = v_code and room.is_active
     );

  if not found then
    return false;
  end if;

  update public.watch_parties
     set last_active_at = pg_catalog.now()
   where code = v_code;
  return true;
end;
$$;

create or replace function public.get_watch_party_by_code(p_code text)
returns setof public.watch_parties
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select room.*
    from public.watch_parties as room
   where room.code = upper(btrim(p_code))
     and public.is_party_member(room.code);
$$;

create or replace function public.list_public_watch_parties()
returns table (
  code text,
  episode integer,
  media_type text,
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
  select room.code,
         coalesce(room.episode, 1),
         room.media_type,
         coalesce(room.season, 1),
         room.title,
         room.tmdb_id,
         (
           select count(*)::integer
             from public.party_members as member
            where member.code = room.code
              and member.last_seen_at > pg_catalog.now() - interval '120 seconds'
         )
    from public.watch_parties as room
   where room.visibility = 'public'
     and room.is_active
   order by room.created_at desc;
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.server_config enable row level security;
alter table public.media_catalog enable row level security;
alter table public.licensed_videos enable row level security;
alter table public.site_settings enable row level security;
alter table public.advertisements enable row level security;
alter table public.catalog_sync_jobs enable row level security;
alter table public.catalog_sync_queue enable row level security;
alter table public.watchlist enable row level security;
alter table public.payments enable row level security;
alter table public.watch_parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_messages enable row level security;
alter table public.party_secrets enable row level security;
alter table public.party_join_attempts enable row level security;

revoke all on table public.profiles, public.user_roles, public.admin_audit_log,
  public.server_config, public.media_catalog, public.licensed_videos,
  public.site_settings, public.advertisements, public.catalog_sync_jobs,
  public.catalog_sync_queue, public.watchlist, public.payments,
  public.watch_parties, public.party_members, public.party_messages,
  public.party_secrets, public.party_join_attempts
from public, anon, authenticated;

grant select on public.profiles, public.user_roles to authenticated;
grant update (is_banned, membership_tier, premium_until) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant select on public.server_config, public.media_catalog, public.licensed_videos,
  public.site_settings, public.advertisements to anon, authenticated;
grant insert, update, delete on public.server_config, public.media_catalog,
  public.licensed_videos, public.site_settings, public.advertisements to authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;
grant select on public.payments to authenticated;
grant select, update (is_active, playback_time, playback_action, playback_updated_at, last_active_at, season, episode)
  on public.watch_parties to authenticated;
grant select on public.party_members, public.party_messages to authenticated;
grant insert on public.party_messages to authenticated;
grant all on public.profiles, public.user_roles, public.admin_audit_log,
  public.server_config, public.media_catalog, public.licensed_videos,
  public.site_settings, public.advertisements, public.catalog_sync_jobs,
  public.catalog_sync_queue, public.watchlist, public.payments,
  public.watch_parties, public.party_members, public.party_messages,
  public.party_secrets, public.party_join_attempts to service_role;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "Admins manage profiles"
  on public.profiles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Users read own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());
create policy "Admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins read audit log"
  on public.admin_audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins write audit log"
  on public.admin_audit_log for insert to authenticated
  with check (admin_id = auth.uid() and public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Public read active servers"
  on public.server_config for select to anon, authenticated
  using (is_active);
create policy "Admins manage servers"
  on public.server_config for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Public read published catalog"
  on public.media_catalog for select to anon, authenticated
  using (is_published);
create policy "Admins manage catalog"
  on public.media_catalog for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Public read videos on active servers"
  on public.licensed_videos for select to anon, authenticated
  using (
    exists (
      select 1 from public.server_config as server
       where server.id = licensed_videos.server_id and server.is_active
    )
    and exists (
      select 1 from public.media_catalog as catalog
       where catalog.id = licensed_videos.catalog_id
         and catalog.tmdb_id = licensed_videos.tmdb_id
         and catalog.media_type = licensed_videos.media_type
         and catalog.is_published
    )
  );
create policy "Admins manage licensed videos"
  on public.licensed_videos for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Public read active site settings"
  on public.site_settings for select to anon, authenticated
  using (id = 1);
create policy "Admins manage site settings"
  on public.site_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Public read active advertisements"
  on public.advertisements for select to anon, authenticated
  using (is_active);
create policy "Admins manage advertisements"
  on public.advertisements for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Users manage own watchlist"
  on public.watchlist for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users read own payments"
  on public.payments for select to authenticated
  using (user_id = auth.uid());
create policy "Admins read all payments"
  on public.payments for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Party members read rooms"
  on public.watch_parties for select to authenticated
  using (host_id = auth.uid() or public.is_party_member(code));
create policy "Hosts update party playback"
  on public.watch_parties for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "Party members read membership"
  on public.party_members for select to authenticated
  using (public.is_party_member(code));

create policy "Party members read chat"
  on public.party_messages for select to authenticated
  using (public.is_party_member(code));
create policy "Party members send chat"
  on public.party_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_party_member(code));

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_party_member(text) from public, anon;
revoke all on function public.is_premium(uuid) from public, anon;
revoke all on function public.title_available(text, integer) from public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.claim_catalog_sync_job(text) from public, anon, authenticated;
revoke all on function public.create_watch_party(text, text, integer, text, integer, integer, text, text, text)
  from public, anon;
revoke all on function public.join_watch_party(text, text, text) from public, anon;
revoke all on function public.party_heartbeat(text) from public, anon;
revoke all on function public.get_watch_party_by_code(text) from public, anon;
revoke all on function public.list_public_watch_parties() from public;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_party_member(text) to authenticated;
grant execute on function public.is_premium(uuid) to authenticated;
grant execute on function public.title_available(text, integer) to anon, authenticated;
grant execute on function public.claim_catalog_sync_job(text) to service_role;
grant execute on function public.create_watch_party(text, text, integer, text, integer, integer, text, text, text)
  to authenticated;
grant execute on function public.join_watch_party(text, text, text) to authenticated;
grant execute on function public.party_heartbeat(text) to authenticated;
grant execute on function public.get_watch_party_by_code(text) to authenticated;
grant execute on function public.list_public_watch_parties() to anon, authenticated;

insert into public.site_settings (id)
values (1);

insert into storage.buckets (id, name, public)
values ('branding', 'branding', false), ('videos', 'videos', false)
on conflict (id) do nothing;

-- Supabase owns storage.objects; configure its bucket policies in the Dashboard.
