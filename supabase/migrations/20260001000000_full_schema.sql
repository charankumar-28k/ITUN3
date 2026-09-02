-- ── Profiles ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Listener',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can read all profiles"  on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Rooms ──────────────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  host_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;
create policy "Authenticated users can read rooms"   on public.rooms for select using (auth.role() = 'authenticated');
create policy "Authenticated users can create rooms" on public.rooms for insert with check (auth.uid() = host_id);
create policy "Host can delete room"                 on public.rooms for delete using (auth.uid() = host_id);

-- ── Room Members ───────────────────────────────────────────────────────────────
create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_members enable row level security;
create policy "Members can read room_members" on public.room_members for select using (auth.role() = 'authenticated');
create policy "Users can join rooms"          on public.room_members for insert with check (auth.uid() = user_id);
create policy "Users can leave rooms"         on public.room_members for delete using (auth.uid() = user_id);

-- ── Room State ─────────────────────────────────────────────────────────────────
create table if not exists public.room_state (
  room_id     uuid primary key references public.rooms(id) on delete cascade,
  track_id    text,
  playing     boolean not null default false,
  position_ms integer not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);
alter table public.room_state enable row level security;
create policy "Members can read room_state"   on public.room_state for select using (auth.role() = 'authenticated');
create policy "Members can update room_state" on public.room_state for update using (auth.role() = 'authenticated');
create policy "Host can insert room_state"    on public.room_state for insert with check (auth.role() = 'authenticated');
create policy "Host can delete room_state"    on public.room_state for delete using (auth.role() = 'authenticated');

-- ── Room Messages ──────────────────────────────────────────────────────────────
create table if not exists public.room_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;
create policy "Members can read room_messages"  on public.room_messages for select using (auth.role() = 'authenticated');
create policy "Members can insert room_messages" on public.room_messages for insert with check (auth.uid() = user_id);
create policy "Host can delete room_messages"   on public.room_messages for delete using (auth.role() = 'authenticated');

-- ── Whiteboard Strokes ─────────────────────────────────────────────────────────
create table if not exists public.whiteboard_strokes (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  uid         uuid not null references auth.users(id) on delete cascade,
  color       text not null default '#ffffff',
  fill        text not null default '',
  opacity     float not null default 1,
  width       integer not null default 3,
  tool        text not null default 'pen',
  points      jsonb not null default '[]',
  text        text not null default '',
  font_size   integer not null default 20,
  font_style  text not null default 'normal',
  font_family text not null default 'sans-serif',
  ts          bigint not null default extract(epoch from now()) * 1000
);
alter table public.whiteboard_strokes enable row level security;
create policy "Members can read strokes"  on public.whiteboard_strokes for select using (auth.role() = 'authenticated');
create policy "Members can insert strokes" on public.whiteboard_strokes for insert with check (auth.uid() = uid);
create policy "Members can delete strokes" on public.whiteboard_strokes for delete using (auth.role() = 'authenticated');

-- ── Friend Requests ────────────────────────────────────────────────────────────
create table if not exists public.friend_requests (
  from_uid   uuid not null references auth.users(id) on delete cascade,
  to_uid     uuid not null references auth.users(id) on delete cascade,
  from_name  text not null default 'Listener',
  status     text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  primary key (from_uid, to_uid)
);
alter table public.friend_requests enable row level security;
create policy "Users can read own requests"   on public.friend_requests for select using (auth.uid() = to_uid or auth.uid() = from_uid);
create policy "Users can send requests"       on public.friend_requests for insert with check (auth.uid() = from_uid);
create policy "Users can update own requests" on public.friend_requests for update using (auth.uid() = to_uid);

-- ── Friends ────────────────────────────────────────────────────────────────────
create table if not exists public.friends (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  name_a     text not null default 'Listener',
  name_b     text not null default 'Listener',
  created_at timestamptz not null default now(),
  primary key (user_a, user_b)
);
alter table public.friends enable row level security;
create policy "Users can read own friends" on public.friends for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Users can insert friends"   on public.friends for insert with check (auth.uid() = user_a or auth.uid() = user_b);
create policy "Users can delete friends"   on public.friends for delete using (auth.uid() = user_a or auth.uid() = user_b);

-- ── Direct Messages ────────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  chat_id      text not null,
  from_uid     uuid not null references auth.users(id) on delete cascade,
  to_uid       uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  read         boolean not null default false,
  song_mention jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists direct_messages_chat_id_idx on public.direct_messages(chat_id);
alter table public.direct_messages enable row level security;
create policy "Users can read own DMs"   on public.direct_messages for select using (auth.uid() = from_uid or auth.uid() = to_uid);
create policy "Users can send DMs"       on public.direct_messages for insert with check (auth.uid() = from_uid);
create policy "Users can mark DMs read"  on public.direct_messages for update using (auth.uid() = to_uid);

-- Enable Realtime for live sync
alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.whiteboard_strokes;
alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.direct_messages;
