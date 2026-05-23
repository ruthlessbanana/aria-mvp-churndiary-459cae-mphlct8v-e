-- ChurnDiary: per-user free trial watchdog entries.

create table if not exists "trial_entries" (
  id text primary key default gen_random_uuid(),
  user_id text not null references "user"("id") on delete cascade,
  service_name text not null,
  trial_start_date date not null,
  trial_conversion_date date not null,
  notes text,
  status text not null default 'active',
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trial_entries_user_id_idx on "trial_entries"(user_id);
create index if not exists trial_entries_status_idx on "trial_entries"(status);
create index if not exists trial_entries_trial_conversion_date_idx on "trial_entries"(trial_conversion_date);
