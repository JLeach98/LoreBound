-- LoreBound investigator profile foundation.
-- Apply manually through the Supabase SQL Editor after review.

create sequence if not exists public.profile_badge_number_sequence
  as integer
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create or replace function public.generate_profile_badge_number()
returns text
language plpgsql
volatile
set search_path = public
as $$
begin
  return 'LB-' || lpad(
    nextval('public.profile_badge_number_sequence')::text,
    6,
    '0'
  );
end;
$$;

create or replace function public.create_default_profile_username(
  profile_user_id uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'investigator-' || lower(replace(profile_user_id::text, '-', ''));
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references auth.users(id)
    on delete cascade,

  username text not null,
  display_name text,

  badge_number text not null unique
    default public.generate_profile_badge_number(),

  title text not null default 'Investigator',
  profile_photo_url text,
  bio text,

  onboarding_completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_length_check
    check (
      char_length(trim(username)) between 3 and 32
    ),

  constraint profiles_username_format_check
    check (
      username ~ '^[A-Za-z0-9._-]+$'
    ),

  constraint profiles_title_length_check
    check (
      char_length(trim(title)) between 2 and 80
    )
);

comment on table public.profiles is
  'LoreBound Investigator Profiles. Each authenticated user owns exactly one profile.';

comment on column public.profiles.user_id is
  'Supabase Auth user that owns this Investigator Profile.';

comment on column public.profiles.badge_number is
  'Immutable LoreBound badge number generated once and never reused.';

comment on column public.profiles.profile_photo_url is
  'Private Supabase Storage object path for the Investigator Profile photo.';

comment on column public.profiles.onboarding_completed is
  'Tracks whether the Investigator completed LoreBound profile onboarding.';

create index if not exists profiles_user_id_idx
  on public.profiles(user_id);

create unique index if not exists profiles_username_lower_idx
  on public.profiles(lower(username));

create index if not exists profiles_badge_number_idx
  on public.profiles(badge_number);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at
on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.prevent_profile_badge_number_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.badge_number is distinct from old.badge_number then
    raise exception 'Profile badge numbers cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profiles_badge_number_update
on public.profiles;

create trigger prevent_profiles_badge_number_update
before update on public.profiles
for each row
execute function public.prevent_profile_badge_number_update();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    username
  )
  values (
    new.id,
    public.create_default_profile_username(new.id)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user
on auth.users;

create trigger create_profile_for_new_user
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

-- Backfill profiles for users who existed before this migration.
insert into public.profiles (
  user_id,
  username
)
select
  users.id,
  public.create_default_profile_username(users.id)
from auth.users as users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own
on public.profiles;

drop policy if exists profiles_insert_own
on public.profiles;

drop policy if exists profiles_update_own
on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

grant usage on schema public
to authenticated;

grant select, insert, update
on table public.profiles
to authenticated;