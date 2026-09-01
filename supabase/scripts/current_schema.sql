-- Complete current application schema.
-- Keep this file updated whenever the public schema changes.

create type public.media_type as enum (
  'movie',
  'tv_series',
  'tv_season',
  'tv_episode',
  'music',
  'album',
  'book'
);

create type public.person_role as enum (
  'actor',
  'director',
  'author',
  'artist',
  'composer'
);

create type public.tracking_status as enum (
  'watched',
  'want_to_watch'
);

create table public.genres (
  id uuid default gen_random_uuid() not null,
  name text not null
);

create table public.languages (
  id uuid default gen_random_uuid() not null,
  name text not null
);

create table public.media_credits (
  media_item_id uuid not null,
  person_id uuid not null,
  role public.person_role not null,
  credit_order integer default 0
);

create table public.media_genres (
  media_item_id uuid not null,
  genre_id uuid not null
);

create table public.media_item_series (
  media_item_id uuid not null,
  series_id uuid not null,
  position integer
);

create table public.media_items (
  id uuid default gen_random_uuid() not null,
  type public.media_type not null,
  title text not null,
  summary text,
  cover_url text,
  release_date date,
  runtime numeric
);

create table public.media_languages (
  media_item_id uuid not null,
  language_id uuid not null
);

create table public.media_regions (
  media_item_id uuid not null,
  region_id uuid not null
);

create table public.media_series (
  id uuid default gen_random_uuid() not null,
  name text not null
);

create table public.music (
  media_item_id uuid not null,
  track_number integer,
  album_id uuid
);

create table public.music_albums (
  media_item_id uuid not null,
  artist_id uuid
);

create table public.people (
  id uuid default gen_random_uuid() not null,
  name text not null
);

create table public.regions (
  id uuid default gen_random_uuid() not null,
  name text not null
);

create table public.tracking (
  id uuid default gen_random_uuid() not null,
  media_item_id uuid not null,
  status public.tracking_status not null,
  rating numeric(2, 1)
);

create table public.tv_episodes (
  id uuid not null,
  season_id uuid not null,
  episode_number integer not null
);

create table public.tv_seasons (
  id uuid not null,
  series_id uuid not null,
  season_number integer not null
);

alter table only public.genres
  add constraint genres_pkey primary key (id),
  add constraint genres_name_key unique (name);

alter table only public.languages
  add constraint languages_pkey primary key (id),
  add constraint languages_name_key unique (name);

alter table only public.media_items
  add constraint media_items_pkey primary key (id),
  add constraint media_items_runtime_nonnegative_check
    check (runtime is null or runtime >= 0::numeric);

alter table only public.media_series
  add constraint media_series_pkey primary key (id),
  add constraint media_series_name_key unique (name);

alter table only public.people
  add constraint people_pkey primary key (id),
  add constraint people_name_key unique (name);

alter table only public.regions
  add constraint regions_pkey primary key (id),
  add constraint regions_name_key unique (name);

alter table only public.media_credits
  add constraint media_credits_pkey primary key (media_item_id, person_id, role),
  add constraint media_credits_order_nonnegative_check
    check (credit_order is null or credit_order >= 0),
  add constraint media_credits_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade,
  add constraint media_credits_person_id_fkey
    foreign key (person_id) references public.people(id) on delete cascade;

alter table only public.media_genres
  add constraint media_genres_pkey primary key (media_item_id, genre_id),
  add constraint media_genres_genre_id_fkey
    foreign key (genre_id) references public.genres(id) on delete cascade,
  add constraint media_genres_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade;

alter table only public.media_item_series
  add constraint media_item_series_pkey primary key (media_item_id, series_id),
  add constraint media_item_series_position_check
    check (position is null or position >= 0),
  add constraint media_item_series_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade,
  add constraint media_item_series_series_id_fkey
    foreign key (series_id) references public.media_series(id) on delete cascade;

alter table only public.media_languages
  add constraint media_languages_pkey primary key (media_item_id, language_id),
  add constraint media_languages_language_id_fkey
    foreign key (language_id) references public.languages(id) on delete cascade,
  add constraint media_languages_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade;

alter table only public.media_regions
  add constraint media_regions_pkey primary key (media_item_id, region_id),
  add constraint media_regions_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade,
  add constraint media_regions_region_id_fkey
    foreign key (region_id) references public.regions(id) on delete cascade;

alter table only public.music_albums
  add constraint music_albums_pkey primary key (media_item_id),
  add constraint music_albums_artist_id_fkey
    foreign key (artist_id) references public.people(id),
  add constraint music_albums_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade;

alter table only public.music
  add constraint music_pkey primary key (media_item_id),
  add constraint music_album_id_fkey
    foreign key (album_id) references public.music_albums(media_item_id),
  add constraint music_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade;

alter table only public.tracking
  add constraint tracking_pkey primary key (id),
  add constraint tracking_media_item_id_key unique (media_item_id),
  add constraint tracking_rating_range_check
    check (rating is null or rating >= 0::numeric and rating <= 10::numeric),
  add constraint tracking_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade;

alter table only public.tv_seasons
  add constraint tv_seasons_pkey primary key (id),
  add constraint tv_seasons_series_id_season_number_key unique (series_id, season_number),
  add constraint tv_seasons_number_nonnegative_check check (season_number >= 0),
  add constraint tv_seasons_id_fkey
    foreign key (id) references public.media_items(id) on delete cascade,
  add constraint tv_seasons_series_id_fkey
    foreign key (series_id) references public.media_items(id) on delete cascade;

alter table only public.tv_episodes
  add constraint tv_episodes_pkey primary key (id),
  add constraint tv_episodes_season_id_episode_number_key unique (season_id, episode_number),
  add constraint tv_episodes_number_nonnegative_check check (episode_number >= 0),
  add constraint tv_episodes_id_fkey
    foreign key (id) references public.media_items(id) on delete cascade,
  add constraint tv_episodes_season_id_fkey
    foreign key (season_id) references public.tv_seasons(id) on delete cascade;

create index media_credits_person_id_idx on public.media_credits using btree (person_id);
create index media_genres_genre_id_media_item_id_idx on public.media_genres using btree (genre_id, media_item_id);
create index media_item_series_series_id_media_item_id_idx on public.media_item_series using btree (series_id, media_item_id);
create index idx_media_items_release_date on public.media_items using btree (release_date desc);
create index idx_media_items_type on public.media_items using btree (type);
create index media_languages_language_id_media_item_id_idx on public.media_languages using btree (language_id, media_item_id);
create index media_regions_region_id_media_item_id_idx on public.media_regions using btree (region_id, media_item_id);
create index music_album_id_idx on public.music using btree (album_id);
create index music_albums_artist_id_idx on public.music_albums using btree (artist_id);

alter table public.genres enable row level security;
alter table public.languages enable row level security;
alter table public.media_credits enable row level security;
alter table public.media_genres enable row level security;
alter table public.media_item_series enable row level security;
alter table public.media_items enable row level security;
alter table public.media_languages enable row level security;
alter table public.media_regions enable row level security;
alter table public.media_series enable row level security;
alter table public.music enable row level security;
alter table public.music_albums enable row level security;
alter table public.people enable row level security;
alter table public.regions enable row level security;
alter table public.tracking enable row level security;
alter table public.tv_episodes enable row level security;
alter table public.tv_seasons enable row level security;

create policy "Allow SELECT from website" on public.genres for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.languages for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_credits for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_genres for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_item_series for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_items for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_languages for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_regions for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.media_series for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.music for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.music_albums for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.people for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.regions for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.tracking for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.tv_episodes for select to anon, authenticated using (true);
create policy "Allow SELECT from website" on public.tv_seasons for select to anon, authenticated using (true);

create view public.v_all_media
with (security_invoker = true)
as
select
  m.id,
  m.type,
  m.title,
  m.summary,
  m.cover_url,
  m.release_date as sort_date,
  extract(year from m.release_date)::text as release_year,
  round(avg(t.rating), 1) as rating,
  m.runtime::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director'::public.person_role) as directors
from public.media_items m
left join public.tracking t on t.media_item_id = m.id
where m.type = 'movie'::public.media_type
group by m.id, m.runtime
union all
select
  series.id,
  series.type,
  series.title,
  series.summary,
  series.cover_url,
  min(episode_media.release_date) as sort_date,
  case
    when min(episode_media.release_date) is null then null::text
    when max(episode_media.release_date) > current_date then extract(year from min(episode_media.release_date))::text || ' - Present'
    when extract(year from min(episode_media.release_date)) = extract(year from max(episode_media.release_date)) then extract(year from min(episode_media.release_date))::text
    else extract(year from min(episode_media.release_date))::text || ' - ' || extract(year from max(episode_media.release_date))::text
  end as release_year,
  round(avg(t.rating), 1) as rating,
  (select sum(ep_media.runtime)::integer from public.tv_seasons s join public.tv_episodes e on e.season_id = s.id join public.media_items ep_media on e.id = ep_media.id where s.series_id = series.id) as runtime,
  case
    when count(episodes.id) > 0 and count(t.media_item_id) = count(episodes.id) and min(t.status)::text = 'watched' and max(t.status)::text = 'watched' then 'watched'
    when count(episodes.id) > 0 and count(t.media_item_id) = count(episodes.id) and min(t.status)::text = 'want_to_watch' and max(t.status)::text = 'want_to_watch' then 'want_to_watch'
    when count(t.media_item_id) > 0 then 'watching'
    else null::text
  end as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = series.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = series.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = series.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'director'::public.person_role) as directors
from public.media_items series
left join public.tv_seasons seasons on seasons.series_id = series.id
left join public.tv_episodes episodes on episodes.season_id = seasons.id
left join public.media_items episode_media on episodes.id = episode_media.id
left join public.tracking t on t.media_item_id = episodes.id
where series.type = 'tv_series'::public.media_type
group by series.id;

create view public.release_year_stats
with (security_invoker = true)
as
with ep_raw as (
  select
    series.id as series_id,
    seasons.id as season_id,
    episodes.id as episode_id,
    episode_media.release_date,
    extract(year from episode_media.release_date)::integer as release_year,
    coalesce(episode_media.runtime, 0::numeric) as runtime,
    coalesce(episode_tracking.status = 'watched'::public.tracking_status, false) as is_watched,
    episode_tracking.rating
  from public.media_items series
  join public.tv_seasons seasons on seasons.series_id = series.id
  join public.tv_episodes episodes on episodes.season_id = seasons.id
  join public.media_items episode_media on episode_media.id = episodes.id
  left join public.tracking episode_tracking on episode_tracking.media_item_id = episodes.id
  where series.type = 'tv_series'::public.media_type
), season_year_agg as (
  select series_id, release_year, season_id,
    count(episode_id) as total_eps,
    count(episode_id) filter (where is_watched) as watched_eps,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as season_status
  from ep_raw where release_year is not null
  group by series_id, release_year, season_id
), series_seasons_year_agg as (
  select series_id, release_year,
    count(season_id) as total_seasons,
    count(season_id) filter (where season_status = 'watched') as watched_seasons,
    count(season_id) filter (where season_status = 'watching') as watching_seasons,
    count(season_id) filter (where season_status = 'unwatched') as unwatched_seasons
  from season_year_agg group by series_id, release_year
), series_year_agg as (
  select series_id, release_year,
    count(episode_id) as total_episodes,
    count(episode_id) filter (where is_watched) as watched_episodes,
    count(episode_id) filter (where not is_watched) as unwatched_episodes,
    sum(runtime) as total_runtime,
    coalesce(sum(runtime) filter (where is_watched), 0::numeric) as watched_runtime,
    coalesce(sum(runtime) filter (where not is_watched), 0::numeric) as unwatched_runtime,
    avg(rating) filter (where rating is not null) as rating,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as status
  from ep_raw where release_year is not null
  group by series_id, release_year
), tv_stats_year as (
  select s.series_id as id, s.release_year, 'tv_series'::text as media_type,
    s.status, s.rating, s.total_runtime, s.watched_runtime, s.unwatched_runtime,
    s.total_episodes, s.watched_episodes, s.unwatched_episodes,
    ss.total_seasons, ss.watched_seasons, ss.watching_seasons, ss.unwatched_seasons
  from series_year_agg s
  join series_seasons_year_agg ss on ss.series_id = s.series_id and ss.release_year = s.release_year
), season_all_agg as (
  select series_id, season_id,
    count(episode_id) as total_eps,
    count(episode_id) filter (where is_watched) as watched_eps,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as season_status
  from ep_raw group by series_id, season_id
), series_seasons_all_agg as (
  select series_id,
    count(season_id) as total_seasons,
    count(season_id) filter (where season_status = 'watched') as watched_seasons,
    count(season_id) filter (where season_status = 'watching') as watching_seasons,
    count(season_id) filter (where season_status = 'unwatched') as unwatched_seasons
  from season_all_agg group by series_id
), series_all_agg as (
  select series_id,
    count(episode_id) as total_episodes,
    count(episode_id) filter (where is_watched) as watched_episodes,
    count(episode_id) filter (where not is_watched) as unwatched_episodes,
    sum(runtime) as total_runtime,
    coalesce(sum(runtime) filter (where is_watched), 0::numeric) as watched_runtime,
    coalesce(sum(runtime) filter (where not is_watched), 0::numeric) as unwatched_runtime,
    avg(rating) filter (where rating is not null) as rating,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as status
  from ep_raw group by series_id
), tv_stats_all as (
  select s.series_id as id, null::integer as release_year, 'tv_series'::text as media_type,
    s.status, s.rating, s.total_runtime, s.watched_runtime, s.unwatched_runtime,
    s.total_episodes, s.watched_episodes, s.unwatched_episodes,
    ss.total_seasons, ss.watched_seasons, ss.watching_seasons, ss.unwatched_seasons
  from series_all_agg s join series_seasons_all_agg ss on ss.series_id = s.series_id
), movie_base as (
  select m.id, extract(year from m.release_date)::integer as release_year,
    'movie'::text as media_type,
    case when t.status = 'watched'::public.tracking_status then 'watched' else 'unwatched' end as status,
    t.rating, coalesce(m.runtime, 0::numeric) as total_runtime,
    case when t.status = 'watched'::public.tracking_status then coalesce(m.runtime, 0::numeric) else 0::numeric end as watched_runtime,
    case when t.status is distinct from 'watched'::public.tracking_status then coalesce(m.runtime, 0::numeric) else 0::numeric end as unwatched_runtime,
    0::bigint as total_episodes, 0::bigint as watched_episodes, 0::bigint as unwatched_episodes,
    0::bigint as total_seasons, 0::bigint as watched_seasons, 0::bigint as watching_seasons, 0::bigint as unwatched_seasons
  from public.media_items m
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'movie'::public.media_type and m.release_date is not null
), movie_stats as (
  select * from movie_base
  union all
  select id, null::integer, media_type, status, rating, total_runtime,
    watched_runtime, unwatched_runtime, total_episodes, watched_episodes,
    unwatched_episodes, total_seasons, watched_seasons, watching_seasons, unwatched_seasons
  from movie_base
), combined_stats as (
  select * from movie_stats
  union all select * from tv_stats_year
  union all select * from tv_stats_all
)
select
  coalesce(release_year::text, 'All Time') as release_year,
  coalesce(sum(total_runtime), 0::numeric) as total_runtime,
  coalesce(sum(watched_runtime), 0::numeric) as total_watched_runtime,
  coalesce(sum(unwatched_runtime), 0::numeric) as total_unwatched_runtime,
  count(id) filter (where media_type = 'movie') as total_movies,
  count(id) filter (where media_type = 'movie' and status = 'watched') as watched_movies,
  count(id) filter (where media_type = 'movie' and status = 'unwatched') as unwatched_movies,
  coalesce(sum(total_runtime) filter (where media_type = 'movie'), 0::numeric) as total_movies_runtime,
  coalesce(sum(watched_runtime) filter (where media_type = 'movie'), 0::numeric) as movies_watched_runtime,
  coalesce(sum(unwatched_runtime) filter (where media_type = 'movie'), 0::numeric) as movies_unwatched_runtime,
  round(avg(rating) filter (where media_type = 'movie' and status = 'watched'), 1) as movie_avg_rating,
  count(id) filter (where media_type = 'tv_series') as total_series,
  count(id) filter (where media_type = 'tv_series' and status = 'watched') as watched_series,
  count(id) filter (where media_type = 'tv_series' and status = 'watching') as watching_series,
  count(id) filter (where media_type = 'tv_series' and status = 'unwatched') as unwatched_series,
  coalesce(sum(total_runtime) filter (where media_type = 'tv_series'), 0::numeric) as total_series_runtime,
  coalesce(sum(watched_runtime) filter (where media_type = 'tv_series'), 0::numeric) as series_watched_runtime,
  coalesce(sum(unwatched_runtime) filter (where media_type = 'tv_series'), 0::numeric) as series_unwatched_runtime,
  round(avg(rating) filter (where media_type = 'tv_series' and rating is not null), 1) as series_avg_rating,
  coalesce(sum(total_seasons) filter (where media_type = 'tv_series'), 0::numeric) as total_seasons,
  coalesce(sum(watched_seasons) filter (where media_type = 'tv_series'), 0::numeric) as watched_seasons,
  coalesce(sum(watching_seasons) filter (where media_type = 'tv_series'), 0::numeric) as watching_seasons,
  coalesce(sum(unwatched_seasons) filter (where media_type = 'tv_series'), 0::numeric) as unwatched_seasons,
  coalesce(sum(total_episodes) filter (where media_type = 'tv_series'), 0::numeric) as total_series_episodes,
  coalesce(sum(watched_episodes) filter (where media_type = 'tv_series'), 0::numeric) as watched_series_episodes,
  coalesce(sum(unwatched_episodes) filter (where media_type = 'tv_series'), 0::numeric) as unwatched_episodes
from combined_stats
group by release_year
order by (release_year is null) desc, coalesce(release_year::text, 'All Time') desc;

create function public.get_tv_seasons_by_series(p_series_id uuid)
returns jsonb
language sql
set search_path to 'public'
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'season_number', s.season_number,
        'season_item', (
          select json_build_object(
            'id', m.id,
            'title', m.title,
            'cover_url', m.cover_url,
            'release_date', m.release_date,
            'type', m.type
          )
          from public.media_items m where m.id = s.id
        ),
        'episodes', (
          select coalesce(
            json_agg(
              json_build_object(
                'episode_number', e.episode_number,
                'episode_item', (
                  select json_build_object(
                    'id', em.id,
                    'title', em.title,
                    'release_date', em.release_date,
                    'runtime', em.runtime
                  )
                  from public.media_items em where em.id = e.id
                )
              ) order by e.episode_number asc
            ),
            '[]'::json
          )
          from public.tv_episodes e
          where e.season_id = s.id
        )
      ) order by s.season_number asc
    ),
    '[]'::json
  )
  from public.tv_seasons s
  where s.series_id = p_series_id;
$$;

create function public.rls_auto_enable()
returns event_trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    begin
      execute format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
      raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
    exception when others then
      raise warning 'rls_auto_enable: failed to enable RLS on %: %', cmd.object_identity, sqlerrm;
    end;
  end loop;
end;
$$;

create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function public.rls_auto_enable();

revoke all privileges on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant all privileges on all tables in schema public to service_role;

revoke all on function public.get_tv_seasons_by_series(uuid) from public;
grant execute on function public.get_tv_seasons_by_series(uuid) to public, anon, authenticated, service_role;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon, authenticated;

create or replace function public.get_top_tv_series_by_year(
  p_year integer,
  p_limit integer default 10
)
returns table(series_id uuid, year_rating numeric)
language sql
stable
parallel safe
set search_path to ''
as $$
  select
    seasons.series_id,
    avg(episode_tracking.rating)::numeric as year_rating
  from public.tv_episodes as episodes
  inner join public.tv_seasons as seasons
    on seasons.id = episodes.season_id
  inner join public.media_items as episode_media
    on episode_media.id = episodes.id
  left join public.tracking as episode_tracking
    on episode_tracking.media_item_id = episodes.id
  where episode_media.release_date >= make_date(p_year, 1, 1)
    and episode_media.release_date < make_date(p_year + 1, 1, 1)
  group by seasons.series_id
  order by year_rating desc nulls last, seasons.series_id
  limit greatest(1, least(coalesce(p_limit, 10), 20));
$$;

revoke all on function public.get_top_tv_series_by_year(integer, integer) from public;
revoke all on function public.get_top_tv_series_by_year(integer, integer) from anon;
revoke all on function public.get_top_tv_series_by_year(integer, integer) from authenticated;
grant execute on function public.get_top_tv_series_by_year(integer, integer) to service_role;

create or replace function public.get_media_distribution_counts()
returns table(
  media_type text,
  release_year text,
  dimension text,
  name text,
  item_count integer
)
language sql
stable
parallel safe
set search_path to ''
as $$
  with series_years as (
    select distinct
      seasons.series_id,
      extract(year from episode_media.release_date)::integer::text as release_year
    from public.tv_episodes as episodes
    inner join public.tv_seasons as seasons on seasons.id = episodes.season_id
    inner join public.media_items as episode_media on episode_media.id = episodes.id
    where episode_media.release_date is not null
  ), media as (
    select
      all_media.id,
      case all_media.type::text
        when 'movie' then 'movies'
        when 'tv_series' then 'series'
      end as media_type,
      all_media.release_year,
      all_media.sort_date,
      all_media.regions,
      all_media.languages,
      all_media.genres
    from public.v_all_media as all_media
    where all_media.type::text in ('movie', 'tv_series')
  ), buckets as (
    select id, media_type, 'All Time'::text as release_year, regions, languages, genres
    from media
    union all
    select
      id,
      media_type,
      coalesce(nullif(release_year, ''), extract(year from sort_date)::integer::text),
      regions,
      languages,
      genres
    from media
    where media_type = 'movies'
      and coalesce(nullif(release_year, ''), extract(year from sort_date)::integer::text) is not null
    union all
    select
      media.id,
      media.media_type,
      series_years.release_year,
      media.regions,
      media.languages,
      media.genres
    from media
    inner join series_years on series_years.series_id = media.id
  ), dimension_values as (
    select id, media_type, release_year, 'regions'::text as dimension, unnest(regions) as value
    from buckets
    union all
    select id, media_type, release_year, 'languages', unnest(languages)
    from buckets
    union all
    select id, media_type, release_year, 'genres', unnest(genres)
    from buckets
  ), unique_values as (
    select distinct id, media_type, release_year, dimension, btrim(value) as value
    from dimension_values
    where btrim(value) <> ''
  )
  select media_type, release_year, dimension, value as name, count(*)::integer as item_count
  from unique_values
  group by media_type, release_year, dimension, value;
$$;

revoke all on function public.get_media_distribution_counts() from public;
revoke all on function public.get_media_distribution_counts() from anon;
revoke all on function public.get_media_distribution_counts() from authenticated;
grant execute on function public.get_media_distribution_counts() to service_role;

create or replace function public.get_media_stats(p_media_type text)
returns table(
  total bigint,
  watched bigint,
  watching bigint,
  want bigint,
  upcoming bigint
)
language sql
stable
parallel safe
set search_path to ''
as $$
  select
    count(*) as total,
    count(*) filter (where media.status = 'watched') as watched,
    count(*) filter (where media.status = 'watching') as watching,
    count(*) filter (where media.status = 'want_to_watch') as want,
    count(*) filter (where media.sort_date >= current_date) as upcoming
  from public.v_all_media as media
  where media.type::text = p_media_type;
$$;

revoke all on function public.get_media_stats(text) from public;
revoke all on function public.get_media_stats(text) from anon;
revoke all on function public.get_media_stats(text) from authenticated;
grant execute on function public.get_media_stats(text) to service_role;

create or replace function public.get_season_episode_page(
  p_series_id uuid,
  p_season_id uuid,
  p_status text default 'all',
  p_order text default 'asc',
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language sql
stable
parallel safe
set search_path to ''
as $$
  with season as (
    select s.id, s.season_number
    from public.tv_seasons as s
    where s.id = p_season_id
      and s.series_id = p_series_id
  ),
  episodes as (
    select
      e.id,
      e.episode_number,
      m.title,
      m.summary,
      m.cover_url,
      m.release_date,
      m.runtime,
      t.status::text as status,
      t.rating
    from season
    join public.tv_episodes as e on e.season_id = season.id
    join public.media_items as m on m.id = e.id
    left join public.tracking as t on t.media_item_id = e.id
  ),
  filtered as (
    select *
    from episodes
    where p_status = 'all'
       or (p_status = 'watched' and status = 'watched')
       or (p_status = 'unwatched' and status is distinct from 'watched')
  ),
  page_rows as (
    select *
    from filtered
    order by
      case when p_order = 'desc' then episode_number end desc,
      case when p_order <> 'desc' then episode_number end asc,
      id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'season_number', season.season_number,
    'episode_count', (select count(*) from episodes),
    'watched_count', (select count(*) from episodes where status = 'watched'),
    'total_runtime', coalesce((select sum(runtime) from episodes), 0),
    'average_rating', (select avg(rating) from episodes where rating is not null),
    'first_release_date', (select min(release_date) from episodes),
    'last_release_date', (select max(release_date) from episodes),
    'total', (select count(*) from filtered),
    'episodes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'episode_number', episode_number,
          'title', title,
          'summary', summary,
          'cover_url', cover_url,
          'release_date', release_date,
          'runtime', runtime,
          'status', status,
          'rating', rating
        )
        order by
          case when p_order = 'desc' then episode_number end desc,
          case when p_order <> 'desc' then episode_number end asc,
          id
      )
      from page_rows
    ), '[]'::jsonb)
  )
  from season;
$$;

revoke all on function public.get_season_episode_page(uuid, uuid, text, text, integer, integer) from public;
revoke all on function public.get_season_episode_page(uuid, uuid, text, text, integer, integer) from anon;
revoke all on function public.get_season_episode_page(uuid, uuid, text, text, integer, integer) from authenticated;
grant execute on function public.get_season_episode_page(uuid, uuid, text, text, integer, integer) to service_role;
