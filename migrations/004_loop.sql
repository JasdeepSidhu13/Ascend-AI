alter table users add column if not exists email_pulse boolean not null default true;
alter table users add column if not exists last_pulse_email_on date;

create table if not exists login_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists login_tokens_hash on login_tokens (token_hash);
create index if not exists login_tokens_user on login_tokens (user_id);
