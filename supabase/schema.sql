-- 小熊 App Supabase schema draft.
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists "pgcrypto";

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default encode(gen_random_bytes(5), 'hex'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role_name text not null check (role_name in ('闪闪鱼', '杰尼龟')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null check (role_name in ('闪闪鱼', '杰尼龟')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (family_id, role_name)
);

create table if not exists public.bears (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  color text not null default '#f1dfc5',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, name)
);

create table if not exists public.wish_bears (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bear_id uuid not null references public.bears(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.coin_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  label text not null,
  rule_type text not null check (rule_type in ('base', 'bonus', 'penalty', 'drink')),
  amount integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.coin_rules(id) on delete set null,
  log_date date not null,
  log_type text not null,
  detail text,
  amount integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_draws (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  draw_date date not null,
  seed text not null,
  checksum text not null,
  result jsonb not null,
  round integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, draw_date)
);

create table if not exists public.exchange_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  draw_id uuid not null references public.daily_draws(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  approver_user_id uuid not null references auth.users(id) on delete cascade,
  target_bear_id uuid not null references public.bears(id) on delete restrict,
  selected_offer_bear_id uuid references public.bears(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source_type text not null,
  source_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_states (
  key text primary key,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  );
$$;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.bears enable row level security;
alter table public.wish_bears enable row level security;
alter table public.coin_rules enable row level security;
alter table public.daily_logs enable row level security;
alter table public.daily_draws enable row level security;
alter table public.exchange_requests enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.app_states enable row level security;

create policy "profiles are readable by owner"
on public.profiles for select
using (id = auth.uid());

create policy "profiles are upsertable by owner"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

create policy "families readable by members"
on public.families for select
using (public.is_family_member(id));

create policy "families insertable by signed in users"
on public.families for insert
with check (auth.uid() = created_by);

create policy "family members readable by members"
on public.family_members for select
using (public.is_family_member(family_id));

create policy "family members insertable by signed in users"
on public.family_members for insert
with check (auth.uid() = user_id);

create policy "bears visible to family members"
on public.bears for select
using (public.is_family_member(family_id));

create policy "bears manageable by family members"
on public.bears for all
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "wish bears manageable by family members"
on public.wish_bears for all
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id) and user_id = auth.uid());

create policy "coin rules manageable by family members"
on public.coin_rules for all
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "daily logs manageable by family members"
on public.daily_logs for all
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "daily draws readable by family members"
on public.daily_draws for select
using (public.is_family_member(family_id));

create policy "daily draws insertable by family members"
on public.daily_draws for insert
with check (public.is_family_member(family_id));

create policy "exchange requests manageable by family members"
on public.exchange_requests for all
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

create policy "coin ledger visible to family members"
on public.coin_ledger for select
using (public.is_family_member(family_id));

create policy "coin ledger insertable by family members"
on public.coin_ledger for insert
with check (public.is_family_member(family_id));

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
