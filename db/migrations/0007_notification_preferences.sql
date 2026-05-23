-- ChurnDiary: per-user email notification preferences (one row per user).

create table if not exists "notification_preferences" (
  id text primary key default gen_random_uuid(),
  user_id text not null unique references "user"("id") on delete cascade,
  email_enabled boolean not null default true,
  reminder_days_before smallint not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_preferences_user_id_idx on "notification_preferences"(user_id);
