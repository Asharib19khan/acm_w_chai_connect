-- Chai Connect: every table the four sites use. Only our servers connect (as the database owner),
-- through packages/db. Browsers never query tables: RLS is on with no policies, and the Data API
-- roles get no grants, so the public anon key can read nothing.

create sequence revision_seq;

-- One row each: site settings and the quiz control panel.
create table settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

create table quiz_control (
  id int primary key default 1 check (id = 1),
  quiz_id text,
  phase text not null default 'locked'
    check (phase in ('locked', 'open', 'countdown', 'live', 'ended')),
  starts_at timestamptz,
  ended_at timestamptz,
  updated_by text,
  swept_at timestamptz
);

create table admins (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('superadmin', 'admin', 'member')),
  totp_secret_enc text not null default '',
  totp_confirmed boolean not null default false,
  enroll_expires_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  hard_locked boolean not null default false,
  last_totp_step bigint,
  disabled boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create unique index admins_one_superadmin on admins ((true)) where role = 'superadmin';

create table admin_sessions (
  id text primary key,
  admin_id text not null references admins (id) on delete cascade,
  app text not null default 'control' check (app in ('control', 'desk')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text
);
create index admin_sessions_admin on admin_sessions (admin_id);

create table recovery_codes (
  admin_id text not null references admins (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  primary key (admin_id, code_hash)
);

create table audit (
  id text primary key,
  admin_id text,
  admin_name text,
  action text not null,
  entity text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index audit_recent on audit (created_at desc);
create index audit_admin on audit (admin_id, created_at desc);

create table questions (
  id text primary key,
  body text not null,
  show_name boolean not null,
  display_name text,
  device_hash text not null unique, -- one question per device
  src text,
  answered boolean not null default false,
  spotlight_at timestamptz,
  created_at timestamptz not null default now(),
  status text not null,
  flag text,
  flag_reasons text[] not null default '{}',
  flag_categories text[] not null default '{}',
  flag_source text,
  reviewed_by text,
  reviewed_at timestamptz,
  removed_reason text
);

create table cvs (
  id text primary key,
  roll_no text not null unique, -- one CV per roll number
  department text not null,
  interests text[] not null default '{}',
  interest_note text,
  consent_share boolean not null,
  consent_display boolean not null,
  file_key text not null,
  file_name text not null,
  sha256 text not null,
  size_bytes int not null,
  page_count int not null,
  active_content boolean not null,
  text_length int not null,
  summary jsonb,
  created_at timestamptz not null default now(),
  status text not null,
  flag text,
  flag_reasons text[] not null default '{}',
  flag_categories text[] not null default '{}',
  flag_source text,
  reviewed_by text,
  reviewed_at timestamptz,
  removed_reason text
);
create index cvs_sha on cvs (sha256);

create table moments (
  id text primary key,
  batch_id text not null,
  uploader_name text not null,
  title text,
  file_name text not null,
  mime text not null,
  size_bytes bigint not null,
  md5 text not null,
  file_key text not null,
  cover_key text,
  upload_state text not null,
  received_bytes bigint not null default 0,
  device_hash text not null,
  created_at timestamptz not null default now(),
  status text not null,
  flag text,
  flag_reasons text[] not null default '{}',
  flag_categories text[] not null default '{}',
  flag_source text,
  reviewed_by text,
  reviewed_at timestamptz,
  removed_reason text
);
create index moments_device on moments (device_hash, created_at);

create table games (
  id text primary key,
  slug text not null unique,
  name text not null,
  category text not null check (category in ('physical', 'mini')),
  status text not null,
  capacity int,
  team_size int not null,
  blurb text not null,
  sort int not null
);

create table registrations (
  id text primary key,
  roll_no text not null,
  department text not null,
  game_id text not null references games (id),
  category text not null,
  status text not null
    check (status in ('registered', 'waitlisted', 'checked_in', 'withdrawn', 'disqualified')),
  confirmation_code text not null,
  pass_code_hash text not null,
  team text,
  round int,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  play_claimed_at timestamptz
);
-- The two-games rule: one active physical game and one active minigame per roll number.
create unique index registrations_one_per_category on registrations (roll_no, category)
  where status in ('registered', 'waitlisted', 'checked_in');
create index registrations_game on registrations (game_id, status);
create index registrations_recent on registrations (created_at desc);

create table score_events (
  id text primary key,
  game_id text not null references games (id),
  registration_id text not null references registrations (id),
  points int not null,
  reason text not null,
  source text not null check (source in ('system', 'admin')),
  admin_id text,
  voided boolean not null default false,
  void_reason text,
  created_at timestamptz not null default now()
);
create index score_events_reg on score_events (registration_id);
create index score_events_game on score_events (game_id) where not voided;

create table game_stations (
  id text primary key,
  game_id text not null references games (id),
  name text not null,
  key_hash text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create table game_runs (
  run_id text primary key, -- the station's id: a resent run is a duplicate, never a second score
  game_id text not null references games (id),
  station_id text not null references game_stations (id),
  roll_no text not null,
  registration_id text references registrations (id),
  points int not null,
  progress_percent real,
  best_at_seconds real,
  round_seconds real,
  played_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index game_runs_station on game_runs (station_id);

create table quizzes (
  id text primary key,
  title text not null,
  settings jsonb not null,
  questions jsonb not null default '[]',
  ran_at timestamptz,
  created_at timestamptz not null default now()
);

create table quiz_sessions (
  id text primary key,
  quiz_id text not null references quizzes (id) on delete cascade,
  roll_no text not null,
  department text not null,
  device_hash text not null,
  token_hash text not null unique,
  status text not null check (status in ('active', 'finished', 'disqualified')),
  dq_reason text,
  question_order text[] not null,
  option_orders jsonb not null,
  current_index int not null default 0,
  served_at timestamptz,
  last_heartbeat_at timestamptz not null,
  answers jsonb not null default '[]',
  score int not null default 0,
  correct_count int not null default 0,
  correct_ms bigint not null default 0,
  joined_at timestamptz not null default now(),
  unique (quiz_id, roll_no),
  unique (quiz_id, device_hash)
);
create index quiz_sessions_active on quiz_sessions (quiz_id, status);

-- Lock everything away from the Data API.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
  end if;
end $$;
