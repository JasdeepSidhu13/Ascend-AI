alter table questions add column if not exists kinds_json jsonb not null default '["weekly"]'::jsonb;

create table if not exists coach_messages (
  id text primary key,
  user_id text not null,
  role text not null,
  body text not null,
  finding_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user on coach_messages (user_id, created_at);

create table if not exists share_links (
  id text primary key,
  user_id text not null,
  goal_id text not null,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists share_links_token on share_links (token);
