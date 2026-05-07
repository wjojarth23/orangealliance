create table if not exists seasons (
  year integer primary key,
  name text not null,
  first_event_date date,
  last_event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  number integer primary key,
  name text not null,
  city text,
  state text,
  country text default 'USA',
  rookie_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  code text primary key,
  year integer not null references seasons(year) on delete cascade,
  name text not null,
  city text,
  state text,
  country text default 'USA',
  type text not null,
  start_date date,
  end_date date,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_teams (
  event_code text not null references events(code) on delete cascade,
  team_number integer not null references teams(number) on delete cascade,
  primary key (event_code, team_number)
);

create table if not exists matches (
  id text primary key,
  event_code text not null references events(code) on delete cascade,
  year integer not null references seasons(year) on delete cascade,
  comp_level text not null check (comp_level in ('qm', 'sf', 'f')),
  set_number integer not null default 1,
  match_number integer not null,
  red_teams integer[] not null,
  blue_teams integer[] not null,
  red_score integer,
  blue_score integer,
  red_foul integer not null default 0,
  blue_foul integer not null default 0,
  played boolean not null default false,
  scheduled_at timestamptz,
  actual_start_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_code, comp_level, set_number, match_number)
);

create table if not exists rankings (
  event_code text not null references events(code) on delete cascade,
  team_number integer not null references teams(number) on delete cascade,
  rank integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  ranking_points numeric not null default 0,
  tie_breaker_1 numeric not null default 0,
  tie_breaker_2 numeric not null default 0,
  raw jsonb not null default '{}'::jsonb,
  primary key (event_code, team_number)
);

create table if not exists advancement (
  event_code text not null references events(code) on delete cascade,
  team_number integer not null references teams(number) on delete cascade,
  source text not null,
  status text not null check (status in ('clinched', 'projected', 'bubble')),
  explanation text not null,
  sort_order integer not null default 0,
  primary key (event_code, team_number, source)
);

create table if not exists team_matches (
  match_id text not null references matches(id) on delete cascade,
  team_number integer not null references teams(number) on delete cascade,
  event_code text not null references events(code) on delete cascade,
  alliance text not null check (alliance in ('red', 'blue')),
  alliance_score integer,
  opponent_score integer,
  won boolean,
  epa_before numeric,
  epa_after numeric,
  epa_delta numeric,
  primary key (match_id, team_number)
);

create table if not exists epa_snapshots (
  id bigserial primary key,
  team_number integer not null references teams(number) on delete cascade,
  year integer not null references seasons(year) on delete cascade,
  event_code text references events(code) on delete set null,
  match_id text references matches(id) on delete set null,
  epa numeric not null,
  norm_epa numeric not null,
  auto_epa numeric,
  teleop_epa numeric,
  endgame_epa numeric,
  matches_played integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists events_year_idx on events(year);
create index if not exists event_teams_team_idx on event_teams(team_number, event_code);
create index if not exists matches_event_idx on matches(event_code, comp_level, set_number, match_number);
create index if not exists matches_year_idx on matches(year, actual_start_at, match_number);
create index if not exists rankings_event_rank_idx on rankings(event_code, rank);
create index if not exists team_matches_team_idx on team_matches(team_number, event_code);
create index if not exists epa_snapshots_team_year_idx on epa_snapshots(team_number, year, created_at desc);

create extension if not exists pg_trgm;
create index if not exists teams_name_trgm_idx on teams using gin (name gin_trgm_ops);
create index if not exists teams_city_trgm_idx on teams using gin (city gin_trgm_ops);
create index if not exists teams_state_trgm_idx on teams using gin (state gin_trgm_ops);

alter table seasons enable row level security;
alter table teams enable row level security;
alter table events enable row level security;
alter table event_teams enable row level security;
alter table matches enable row level security;
alter table rankings enable row level security;
alter table advancement enable row level security;
alter table team_matches enable row level security;
alter table epa_snapshots enable row level security;

create policy "public read seasons" on seasons for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read events" on events for select using (true);
create policy "public read event teams" on event_teams for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read rankings" on rankings for select using (true);
create policy "public read advancement" on advancement for select using (true);
create policy "public read team matches" on team_matches for select using (true);
create policy "public read epa snapshots" on epa_snapshots for select using (true);
