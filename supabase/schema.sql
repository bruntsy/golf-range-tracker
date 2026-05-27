-- Run this entire file in your Supabase project → SQL Editor → New query

-- ── Tables ────────────────────────────────────────────────────────────────────

create table clubs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  name          text not null,
  abbreviation  text not null,
  type          text not null check (type in ('driver','wood','hybrid','iron','wedge','putter')),
  order_index   int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  ball_count  int,
  created_at  timestamptz not null default now()
);

create table shots (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade not null,
  club_id      uuid references clubs(id) on delete cascade not null,
  result       text not null check (result in ('hit','left','right','long','short')),
  shot_number  int not null,
  created_at   timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index on clubs    (user_id, order_index);
create index on sessions (user_id, started_at desc);
create index on shots    (session_id, shot_number);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table clubs    enable row level security;
alter table sessions enable row level security;
alter table shots    enable row level security;

create policy "own clubs"    on clubs    for all using (auth.uid() = user_id);
create policy "own sessions" on sessions for all using (auth.uid() = user_id);
create policy "own shots"    on shots    for all using (
  session_id in (select id from sessions where user_id = auth.uid())
);
