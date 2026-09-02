
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Listener',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- auto-create profile + display_name from email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- mood history
create table public.mood_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emotion text not null,
  track_id text,
  track_title text,
  track_artist text,
  created_at timestamptz not null default now()
);
alter table public.mood_history enable row level security;
create index mood_history_user_created_idx on public.mood_history(user_id, created_at desc);

create policy "Users view own mood history"
  on public.mood_history for select using (auth.uid() = user_id);
create policy "Users insert own mood history"
  on public.mood_history for insert with check (auth.uid() = user_id);
create policy "Users delete own mood history"
  on public.mood_history for delete using (auth.uid() = user_id);

-- rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

create policy "Rooms viewable by anyone signed in"
  on public.rooms for select to authenticated using (true);
create policy "Authenticated users can create rooms"
  on public.rooms for insert to authenticated with check (auth.uid() = host_id);
create policy "Host can delete room"
  on public.rooms for delete using (auth.uid() = host_id);

-- room members
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_members enable row level security;
create index room_members_room_idx on public.room_members(room_id);

create policy "Members viewable to anyone signed in"
  on public.room_members for select to authenticated using (true);
create policy "Users can join rooms (insert self)"
  on public.room_members for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can leave rooms (delete self)"
  on public.room_members for delete using (auth.uid() = user_id);

-- security definer helper to avoid recursive RLS for membership checks
create or replace function public.is_room_member(_room_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.room_members where room_id = _room_id and user_id = _user_id);
$$;

-- room messages
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;
create index room_messages_room_created_idx on public.room_messages(room_id, created_at);

create policy "Members read messages"
  on public.room_messages for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
create policy "Members write own messages"
  on public.room_messages for insert to authenticated
  with check (auth.uid() = user_id and public.is_room_member(room_id, auth.uid()));

-- room state (single row per room)
create table public.room_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  track_id text,
  playing boolean not null default false,
  position_ms integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.room_state enable row level security;

create policy "Members read state"
  on public.room_state for select to authenticated
  using (public.is_room_member(room_id, auth.uid()));
create policy "Host inserts state"
  on public.room_state for insert to authenticated
  with check (exists(select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));
create policy "Host updates state"
  on public.room_state for update to authenticated
  using (exists(select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));

-- realtime: enable for relevant tables
alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_members;
