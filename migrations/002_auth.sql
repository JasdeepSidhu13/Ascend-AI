alter table users add column if not exists password_hash text;
alter table users add column if not exists email_unique text;

create unique index if not exists users_email_unique
  on users (email_unique)
  where email_unique is not null;

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_sessions_user on auth_sessions (user_id);
