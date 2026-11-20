create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (length(btrim(title)) between 1 and 300),
  poster_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);

alter table public.favorites enable row level security;
revoke all on table public.favorites from public, anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;

create policy "Users read own favorites"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

create policy "Users add own favorites"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users remove own favorites"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

create table public.user_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index user_collections_user_name_key
  on public.user_collections (user_id, lower(name));

alter table public.user_collections enable row level security;
revoke all on table public.user_collections from public, anon, authenticated;
grant select, insert, update, delete on table public.user_collections to authenticated;

create policy "Users manage own collections"
  on public.user_collections for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.user_collection_items (
  collection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (length(btrim(title)) between 1 and 300),
  poster_path text,
  created_at timestamptz not null default now(),
  primary key (collection_id, media_type, tmdb_id),
  foreign key (collection_id, user_id)
    references public.user_collections (id, user_id)
    on delete cascade
);

alter table public.user_collection_items enable row level security;
revoke all on table public.user_collection_items from public, anon, authenticated;
grant select, insert, delete on table public.user_collection_items to authenticated;

create policy "Users manage own collection items"
  on public.user_collection_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
