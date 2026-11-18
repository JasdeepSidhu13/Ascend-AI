create table if not exists users (
  id text primary key,
  email text not null default '',
  display_name text not null default '',
  tz text not null default 'UTC',
  tone text not null default 'gentle',
  plan text not null default 'free',
  values_json jsonb not null default '[]'::jsonb,
  constraints_text text not null default '',
  pulse_hour integer not null default 8,
  quiet_start integer not null default 21,
  quiet_end integer not null default 7,
  reminder_weekday integer not null default 0,
  onboarding_completed_at timestamptz,
  sample_data boolean not null default false,
  monthly_token_used integer not null default 0,
  monthly_token_budget integer not null default 200000,
  created_at timestamptz not null default now()
);

create table if not exists areas (
  id text primary key,
  key text not null,
  name text not null,
  user_id text,
  sort_order integer not null default 0
);

create table if not exists questions (
  id text primary key,
  area_id text not null,
  dimension text not null,
  prompt text not null,
  type text not null,
  options jsonb not null default '[]'::jsonb,
  cadence integer not null,
  metric_key text,
  est_seconds integer not null default 12,
  version integer not null default 1,
  source text not null default 'curated',
  owner_id text,
  active boolean not null default true,
  unit text not null default ''
);

create table if not exists question_rules (
  id text primary key,
  question_id text not null,
  condition jsonb not null,
  follow_up_id text not null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null,
  kind text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  selection jsonb not null default '[]'::jsonb
);

create table if not exists responses (
  id text primary key,
  session_id text not null,
  user_id text not null,
  question_id text not null,
  question_version integer not null default 1,
  value_num double precision,
  value_text text,
  value_json jsonb,
  skipped boolean not null default false,
  answered_at timestamptz not null default now()
);

create table if not exists metric_points (
  user_id text not null,
  metric_key text not null,
  period_start date not null,
  grain text not null,
  value double precision not null,
  n integer not null default 1,
  primary key (user_id, metric_key, period_start, grain)
);

create table if not exists goals (
  id text primary key,
  user_id text not null,
  area_id text not null,
  title text not null,
  why text not null default '',
  starts_on date not null,
  due_on date not null,
  status text not null default 'active',
  vision text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists key_results (
  id text primary key,
  goal_id text not null,
  user_id text not null,
  metric_key text not null,
  baseline double precision not null,
  target double precision not null,
  unit text not null default '',
  due_on date not null
);

create table if not exists actions (
  id text primary key,
  user_id text not null,
  goal_id text,
  kr_id text,
  text text not null,
  trigger text not null default '',
  due_on date,
  status text not null default 'active',
  expected_metric text,
  expected_direction text not null default 'up',
  quantity double precision,
  created_by text not null default 'user',
  shrinking_of text,
  week_start date,
  created_at timestamptz not null default now()
);

create table if not exists action_events (
  id text primary key,
  action_id text not null,
  user_id text not null,
  kind text not null,
  barrier_tags jsonb not null default '[]'::jsonb,
  at timestamptz not null default now()
);

create table if not exists findings (
  id text primary key,
  user_id text not null,
  type text not null,
  metric_keys jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  score double precision not null default 0,
  computed_at timestamptz not null default now(),
  session_id text
);

create table if not exists insights (
  id text primary key,
  user_id text not null,
  finding_ids jsonb not null default '[]'::jsonb,
  title text not null,
  body text not null,
  suggested_action text not null default '',
  confidence text not null default 'medium',
  action_id text,
  model text not null default 'rules',
  prompt_version text not null default 'rules-v1',
  shown_at timestamptz not null default now(),
  evidence jsonb not null default '[]'::jsonb,
  rank integer not null default 0
);

create table if not exists insight_feedback (
  insight_id text not null,
  user_id text not null,
  useful boolean,
  note text not null default '',
  at timestamptz not null default now(),
  primary key (insight_id, user_id)
);

create table if not exists memories (
  id text primary key,
  user_id text not null,
  layer text not null,
  area_id text,
  text text not null,
  confidence double precision not null default 0.7,
  source_response_id text,
  valid_until date,
  superseded_by text,
  paused boolean not null default false,
  confirmed boolean not null default true,
  embedding jsonb,
  created_at timestamptz not null default now()
);

create table if not exists response_embeddings (
  response_id text primary key,
  user_id text not null,
  embedding jsonb not null
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  scheduled_for timestamptz not null,
  channel text not null default 'in_app',
  sent_at timestamptz
);

create table if not exists events (
  id text primary key,
  user_id text not null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create table if not exists action_effectiveness (
  user_id text not null,
  action_type text not null,
  tries integer not null default 0,
  wins integer not null default 0,
  score double precision not null default 0,
  primary key (user_id, action_type)
);

create index if not exists responses_user_answered on responses (user_id, answered_at);
create index if not exists metric_points_user_key on metric_points (user_id, metric_key, period_start);
create index if not exists actions_user_status on actions (user_id, status);
create index if not exists sessions_user on sessions (user_id, started_at);
create index if not exists findings_user on findings (user_id, computed_at);
create index if not exists insights_user on insights (user_id, shown_at);
create index if not exists memories_user on memories (user_id, layer);
create index if not exists events_user on events (user_id, at);
