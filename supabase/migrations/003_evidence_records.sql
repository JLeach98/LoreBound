-- LoreBound Evidence Record cloud schema foundation.
-- Review and run manually in the Supabase SQL Editor when ready.
-- This file is not executed by the application.

create table if not exists public.evidence_records (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  origin_dossier_id text not null,
  origin_section_id text not null,
  target_dossier_id text not null,
  selected_text text not null default '',
  anchor_start integer not null,
  anchor_end integer not null,
  anchor_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (
    status in ('active', 'orphaned')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, user_id),
  check (anchor_start >= 0),
  check (anchor_end >= anchor_start),
  check (jsonb_typeof(anchor_context) = 'object'),
  check (jsonb_typeof(metadata) = 'object'),
  foreign key (case_id, user_id)
    references public.cases(id, user_id)
    on delete cascade,
  foreign key (origin_dossier_id, case_id, user_id)
    references public.dossiers(id, case_id, user_id)
    on delete cascade,
  foreign key (target_dossier_id, case_id, user_id)
    references public.dossiers(id, case_id, user_id)
    on delete cascade
);

comment on table public.evidence_records is 'Canonical persisted Threadmark evidence anchors for a LoreBound Investigation.';
comment on column public.evidence_records.origin_dossier_id is 'Dossier containing the source text that created this Evidence Record.';
comment on column public.evidence_records.origin_section_id is 'Stable embedded Dossier Section ID containing the source text.';
comment on column public.evidence_records.target_dossier_id is 'Dossier referenced by the Evidence Record. Dossier names are not used as identity.';
comment on column public.evidence_records.selected_text is 'Text selected or resolved when the Evidence Record was created.';
comment on column public.evidence_records.anchor_context is 'Small structured context used to repair anchors when surrounding text changes.';
comment on column public.evidence_records.metadata is 'Reserved structured metadata for future Threadmark and evidence workflows.';
comment on column public.evidence_records.status is 'Current app values: active, orphaned.';

create index if not exists evidence_records_user_id_idx on public.evidence_records(user_id);
create index if not exists evidence_records_case_id_idx on public.evidence_records(case_id);
create index if not exists evidence_records_target_dossier_id_idx on public.evidence_records(target_dossier_id);
create index if not exists evidence_records_origin_dossier_id_idx on public.evidence_records(origin_dossier_id);
create index if not exists evidence_records_origin_section_id_idx on public.evidence_records(origin_section_id);
create index if not exists evidence_records_updated_at_idx on public.evidence_records(updated_at);

drop trigger if exists set_evidence_records_updated_at on public.evidence_records;

create trigger set_evidence_records_updated_at
before update on public.evidence_records
for each row execute function public.set_updated_at();

alter table public.evidence_records enable row level security;

drop policy if exists evidence_records_select_own
on public.evidence_records;

drop policy if exists evidence_records_insert_own
on public.evidence_records;

drop policy if exists evidence_records_update_own
on public.evidence_records;

drop policy if exists evidence_records_delete_own
on public.evidence_records;

create policy evidence_records_select_own
on public.evidence_records for select
using (auth.uid() = user_id);

create policy evidence_records_insert_own
on public.evidence_records for insert
with check (auth.uid() = user_id);

create policy evidence_records_update_own
on public.evidence_records for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy evidence_records_delete_own
on public.evidence_records for delete
using (auth.uid() = user_id);
