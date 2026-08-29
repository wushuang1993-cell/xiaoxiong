create table if not exists public.app_states (
  key text primary key,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "app state readable by signed in users" on public.app_states;
drop policy if exists "app state insertable by signed in users" on public.app_states;
drop policy if exists "app state updateable by signed in users" on public.app_states;

create policy "app state readable by signed in users"
on public.app_states for select
to authenticated
using (key = 'home');

create policy "app state insertable by signed in users"
on public.app_states for insert
to authenticated
with check (key = 'home');

create policy "app state updateable by signed in users"
on public.app_states for update
to authenticated
using (key = 'home')
with check (key = 'home');

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars readable by everyone" on storage.objects;
drop policy if exists "avatars uploadable by signed in users" on storage.objects;

create policy "avatars readable by everyone"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars uploadable by signed in users"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars');
