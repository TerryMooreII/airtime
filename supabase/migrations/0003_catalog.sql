-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- array_to_string is only STABLE, so wrap it to use in a generated column.
create or replace function public.text_array_to_text(arr text[])
returns text
language sql
immutable
parallel safe
as $$ select coalesce(array_to_string(arr, ' '), '') $$;

-- ---------------------------------------------------------------------------
-- Catalog: a local mirror of TVMaze, kept source-agnostic via tvmaze_id columns,
-- show_external_ids (imdb/thetvdb/tmdb/...) and provider-keyed rating tables.
-- Only the service role writes to these tables.
-- ---------------------------------------------------------------------------
create table public.channels (
  id            bigint generated always as identity primary key,
  kind          public.channel_kind not null,
  tvmaze_id     integer not null,
  name          text not null,
  country_code  text,
  country_name  text,
  timezone      text,
  official_site text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (kind, tvmaze_id)
);
create trigger channels_set_updated_at before update on public.channels
  for each row execute function public.set_updated_at();

create table public.shows (
  id                  bigint generated always as identity primary key,
  tvmaze_id           integer not null unique,
  name                text not null,
  type                text,
  language            text,
  genres              text[] not null default '{}',
  status              text,
  runtime             integer,
  average_runtime     integer,
  premiered           date,
  ended               date,
  official_site       text,
  schedule_time       text,
  schedule_days       text[] not null default '{}',
  weight              integer not null default 0,
  network_id          bigint references public.channels(id) on delete set null,
  web_channel_id      bigint references public.channels(id) on delete set null,
  dvd_country_code    text,
  image_medium        text,
  image_original      text,
  summary_html        text,
  tvmaze_url          text,
  tvmaze_updated_at   timestamptz,
  episodes_synced_at  timestamptz,          -- null until the full episode list has been imported
  synced_at           timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', public.text_array_to_text(genres) || ' ' || coalesce(type, '')), 'B')
  ) stored
);
create index shows_search_idx on public.shows using gin (search);
create index shows_name_trgm_idx on public.shows using gin (name extensions.gin_trgm_ops);
create index shows_status_idx on public.shows (status);
create index shows_weight_idx on public.shows (weight desc);
create index shows_episodes_synced_idx on public.shows (episodes_synced_at) where episodes_synced_at is null;
create trigger shows_set_updated_at before update on public.shows
  for each row execute function public.set_updated_at();

create table public.show_external_ids (
  show_id     bigint not null references public.shows(id) on delete cascade,
  provider    text not null,             -- 'imdb' | 'thetvdb' | 'tvrage' | 'tmdb' | ...
  external_id text not null,
  created_at  timestamptz not null default now(),
  primary key (show_id, provider),
  unique (provider, external_id)
);

create table public.show_ratings (
  show_id    bigint not null references public.shows(id) on delete cascade,
  provider   text not null,              -- 'tvmaze' | 'imdb' | 'rotten_tomatoes' | 'metacritic' | ...
  value      numeric(5, 2) not null,
  scale      numeric(5, 2) not null default 10,
  vote_count integer,
  fetched_at timestamptz not null default now(),
  primary key (show_id, provider)
);

create table public.episodes (
  id             bigint generated always as identity primary key,
  tvmaze_id      integer not null unique,
  show_id        bigint not null references public.shows(id) on delete cascade,
  season         integer not null,
  number         integer,                 -- null for some specials
  type           text not null default 'regular',
  name           text,
  airdate        date,
  airtime        text,
  airstamp       timestamptz,
  runtime        integer,
  image_medium   text,
  image_original text,
  summary_html   text,
  tvmaze_url     text,
  synced_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index episodes_show_season_number_idx on public.episodes (show_id, season, number);
create index episodes_airstamp_idx on public.episodes (airstamp);
create index episodes_show_airstamp_idx on public.episodes (show_id, airstamp);
create trigger episodes_set_updated_at before update on public.episodes
  for each row execute function public.set_updated_at();

create table public.episode_ratings (
  episode_id bigint not null references public.episodes(id) on delete cascade,
  provider   text not null,
  value      numeric(5, 2) not null,
  scale      numeric(5, 2) not null default 10,
  vote_count integer,
  fetched_at timestamptz not null default now(),
  primary key (episode_id, provider)
);
