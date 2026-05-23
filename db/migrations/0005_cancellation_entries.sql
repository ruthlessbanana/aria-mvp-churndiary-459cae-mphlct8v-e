-- ChurnDiary: per-user cancellation ledger entries.

create table if not exists "cancellation_entries" (
  id text primary key default gen_random_uuid(),
  user_id text not null references "user"("id") on delete cascade,
  service_name text not null,
  cancel_date date not null,
  monthly_cost_saved numeric(10, 2),
  reason text not null,
  reason_notes text,
  mood smallint not null,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cancellation_entries_user_id_idx on "cancellation_entries"(user_id);
create index if not exists cancellation_entries_cancel_date_idx on "cancellation_entries"(cancel_date);
create index if not exists cancellation_entries_share_token_idx on "cancellation_entries"(share_token);
