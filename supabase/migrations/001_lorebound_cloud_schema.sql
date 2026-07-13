-- LoreBound cloud schema foundation.
-- Review and run manually in the Supabase SQL Editor when ready.
-- This file is not executed by the application.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cases (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  universe_type text not null check (
    universe_type in (
      'Book',
      'Book Series',
      'Game',
      'Game Series',
      'Movie',
      'Movie Series',
      'Television',
      'Anime',
      'Manga',
      'Tabletop',
      'Original World',
      'Other'
    )
  ),
  cover_image_local_value text,
  cover_image_cloud_path text,
  author_or_creator text,
  description text,
  date_last_opened timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, user_id)
);

comment on column public.cases.name is 'Maps to LoreBound local caseName.';
comment on column public.cases.cover_image_local_value is 'Original local image value preserved for future IndexedDB migration.';
comment on column public.cases.cover_image_cloud_path is 'Future Supabase Storage path. Image binary data is not stored in PostgreSQL.';
comment on column public.cases.is_archived is 'Reserved for future Case Archive filtering. The current app does not use this yet.';

create table if not exists public.dossiers (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  dossier_type text not null,
  name text not null,
  cover_image_local_value text,
  cover_image_cloud_path text,
  summary text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, user_id),
  unique (id, case_id, user_id),
  check (jsonb_typeof(metadata) = 'object'),
  foreign key (case_id, user_id)
    references public.cases(id, user_id)
    on delete cascade
);

comment on column public.dossiers.dossier_type is 'Flexible Knowledge Type name. Current app values include Character, Location, Event, Organization, and Theory.';
comment on column public.dossiers.metadata is 'Type-specific Dossier fields. Current keys include alias, characterStatus, affiliation, region, world, eventDate, era, leader, organizationType, theoryConfidence, and theoryStatus.';
comment on column public.dossiers.cover_image_local_value is 'Original local image value preserved for future IndexedDB migration.';
comment on column public.dossiers.cover_image_cloud_path is 'Future Supabase Storage path. Image binary data is not stored in PostgreSQL.';

create table if not exists public.bonds (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  source_dossier_id text not null,
  target_dossier_id text not null,
  bond_type text not null,
  bond_behavior text not null check (
    bond_behavior in ('Symmetric', 'Inverse', 'Directional')
  ),
  source_label text,
  target_label text,
  status text check (
    status is null or status in ('Confirmed', 'Theory', 'Unknown', 'Disputed', 'Debunked')
  ),
  notes text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, user_id),
  check (source_dossier_id <> target_dossier_id),
  check (jsonb_typeof(evidence) = 'object'),
  foreign key (case_id, user_id)
    references public.cases(id, user_id)
    on delete cascade,
  foreign key (source_dossier_id, case_id, user_id)
    references public.dossiers(id, case_id, user_id)
    on delete cascade,
  foreign key (target_dossier_id, case_id, user_id)
    references public.dossiers(id, case_id, user_id)
    on delete cascade
);

comment on column public.bonds.bond_type is 'Flexible relationship name. Custom Bonds remain text, not a PostgreSQL enum.';
comment on column public.bonds.bond_behavior is 'Current app values: Symmetric, Inverse, Directional.';
comment on column public.bonds.evidence is 'Optional structured evidence matching the app model: sourceTitle, sourceType, reference, evidenceNotes.';

create table if not exists public.board_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  dossier_id text not null,
  board_order integer not null default 0,
  position_x numeric not null,
  position_y numeric not null,
  rotation numeric not null default 0,
  scale numeric not null default 1,
  z_index integer not null default 0,
  date_pinned timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, user_id),
  unique (case_id, dossier_id, user_id),
  check (position_x >= 0 and position_x <= 100),
  check (position_y >= 0 and position_y <= 100),
  check (scale > 0 and scale <= 4),
  foreign key (case_id, user_id)
    references public.cases(id, user_id)
    on delete cascade,
  foreign key (dossier_id, case_id, user_id)
    references public.dossiers(id, case_id, user_id)
    on delete cascade
);

comment on column public.board_entries.board_order is 'Maps to the current BoardPin order field.';
comment on column public.board_entries.position_x is 'Normalized board X coordinate from the current app model.';
comment on column public.board_entries.position_y is 'Normalized board Y coordinate from the current app model.';
comment on column public.board_entries.rotation is 'Reserved visual placement value. Defaults to zero; no app resizing or rotation feature is added by this schema.';
comment on column public.board_entries.scale is 'Reserved visual placement value. Defaults to one and rejects non-positive values.';
comment on column public.board_entries.z_index is 'Reserved stacking value for future board presentation support.';

create index if not exists cases_user_id_idx on public.cases(user_id);
create index if not exists cases_user_archived_idx on public.cases(user_id, is_archived);
create index if not exists cases_updated_at_idx on public.cases(updated_at);

create index if not exists dossiers_user_id_idx on public.dossiers(user_id);
create index if not exists dossiers_case_id_idx on public.dossiers(case_id);
create index if not exists dossiers_dossier_type_idx on public.dossiers(dossier_type);
create index if not exists dossiers_updated_at_idx on public.dossiers(updated_at);

create index if not exists bonds_user_id_idx on public.bonds(user_id);
create index if not exists bonds_case_id_idx on public.bonds(case_id);
create index if not exists bonds_source_dossier_id_idx on public.bonds(source_dossier_id);
create index if not exists bonds_target_dossier_id_idx on public.bonds(target_dossier_id);
create index if not exists bonds_updated_at_idx on public.bonds(updated_at);

create index if not exists board_entries_user_id_idx on public.board_entries(user_id);
create index if not exists board_entries_case_id_idx on public.board_entries(case_id);
create index if not exists board_entries_dossier_id_idx on public.board_entries(dossier_id);
create index if not exists board_entries_case_order_idx on public.board_entries(case_id, board_order);
create index if not exists board_entries_updated_at_idx on public.board_entries(updated_at);

create trigger set_cases_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

create trigger set_dossiers_updated_at
before update on public.dossiers
for each row execute function public.set_updated_at();

create trigger set_bonds_updated_at
before update on public.bonds
for each row execute function public.set_updated_at();

create trigger set_board_entries_updated_at
before update on public.board_entries
for each row execute function public.set_updated_at();

alter table public.cases enable row level security;
alter table public.dossiers enable row level security;
alter table public.bonds enable row level security;
alter table public.board_entries enable row level security;

create policy "cases_select_own"
on public.cases for select
using (auth.uid() = user_id);

create policy "cases_insert_own"
on public.cases for insert
with check (auth.uid() = user_id);

create policy "cases_update_own"
on public.cases for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cases_delete_own"
on public.cases for delete
using (auth.uid() = user_id);

create policy "dossiers_select_own"
on public.dossiers for select
using (auth.uid() = user_id);

create policy "dossiers_insert_own"
on public.dossiers for insert
with check (auth.uid() = user_id);

create policy "dossiers_update_own"
on public.dossiers for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "dossiers_delete_own"
on public.dossiers for delete
using (auth.uid() = user_id);

create policy "bonds_select_own"
on public.bonds for select
using (auth.uid() = user_id);

create policy "bonds_insert_own"
on public.bonds for insert
with check (auth.uid() = user_id);

create policy "bonds_update_own"
on public.bonds for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "bonds_delete_own"
on public.bonds for delete
using (auth.uid() = user_id);

create policy "board_entries_select_own"
on public.board_entries for select
using (auth.uid() = user_id);

create policy "board_entries_insert_own"
on public.board_entries for insert
with check (auth.uid() = user_id);

create policy "board_entries_update_own"
on public.board_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "board_entries_delete_own"
on public.board_entries for delete
using (auth.uid() = user_id);
