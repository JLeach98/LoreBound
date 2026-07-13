# LoreBound Supabase Setup

This folder contains the reviewable SQL foundation for LoreBound's future Cloud Library.

The migration has not been executed by the application. Apply it manually only after reviewing it.

## Migration File

`supabase/migrations/001_lorebound_cloud_schema.sql`

## Tables Created

The migration creates four user-owned tables in the `public` schema.

`cases` stores one LoreBound Case per row. It preserves the current application fields for the Case name, universe type, author or creator, description, cover image reference, last-opened date, and timestamps. The Case name column is `name`, not `case_name`, because the table name already provides the Case context.

`dossiers` stores Character, Location, Event, Organization, and Theory Dossiers. Universal fields such as `id`, `case_id`, `dossier_type`, `name`, cover image references, `summary`, `notes`, `created_at`, and `updated_at` are normal columns.

`bonds` stores one relationship per row. Symmetric, inverse, directional, and custom Bonds remain text-driven so LoreBound does not need duplicate reciprocal records or database enum changes for every new relationship label.

`board_entries` stores the current cork-board placement state for pinned Dossiers.

## Dossier Metadata JSONB

Dossier type-specific fields are stored in `dossiers.metadata` as JSONB instead of separate columns. This keeps the schema flexible while preserving all current app fields.

Expected current metadata examples:

- Character: `alias`, `characterStatus`, `affiliation`
- Location: `region`, `world`
- Event: `eventDate`, `era`
- Organization: `leader`, `organizationType`
- Theory: `theoryConfidence`, `theoryStatus`

`metadata` defaults to `{}` and has a simple constraint requiring a JSON object.

## Images

PostgreSQL does not store uploaded image binary data.

Cases and Dossiers include:

- `cover_image_local_value`: preserves the current local image value for future IndexedDB migration.
- `cover_image_cloud_path`: reserved for a future Supabase Storage path.

No image upload behavior exists yet.

## Board Placement

`board_entries` preserves the current normalized board coordinates:

- `position_x`
- `position_y`

It also includes storage-only placement fields for future visual polish:

- `rotation`, default `0`
- `scale`, default `1`
- `z_index`, default `0`
- `board_order`, matching the current app's explicit Board pin ordering

These fields do not add card resizing, rotation controls, physics, or new Board interactions to the app.

## Case Archive Flag

`cases.is_archived` is included as a future database capability and defaults to `false`.

The current application does not use this field and does not implement Case archiving UI.

## Soft Delete

This migration intentionally does not include `deleted_at` or soft-delete behavior.

LoreBound currently uses hard deletion with confirmation. Soft deletion is deferred because adding it now would complicate queries, cascades, IndexedDB synchronization, conflict resolution, and user expectations. It can be added later in a focused migration if the product needs recovery or archive-style deletion.

## Same-Case And Same-User Integrity

The schema uses composite uniqueness and composite foreign keys to prevent cross-user and cross-Case references.

Important examples:

- Dossiers reference `(case_id, user_id)` on `cases`.
- Bonds reference `(source_dossier_id, case_id, user_id)` and `(target_dossier_id, case_id, user_id)` on `dossiers`.
- Board entries reference `(dossier_id, case_id, user_id)` on `dossiers`.

This means a Bond endpoint or Board entry cannot point at a Dossier from another Case or another user.

Self-Bonds are prevented with `check (source_dossier_id <> target_dossier_id)`.

## Cascade Behavior

Deleting a Case cascades to its Dossiers, Bonds, and Board entries.

Deleting a Dossier cascades to connected Bonds and its Board entry.

Deleting a Bond does not delete either Dossier.

## Timestamps

All tables use timezone-aware `timestamptz` values for `created_at` and `updated_at`.

The reusable `public.set_updated_at()` trigger updates `updated_at` automatically when rows change. The frontend should not be the only source of update timestamps.

## Row Level Security

The browser app uses the Supabase publishable key. That key is safe only when Row Level Security protects every user-owned row.

The migration enables RLS on:

- `cases`
- `dossiers`
- `bonds`
- `board_entries`

Each table has policies allowing authenticated users to select, insert, update, and delete only rows where:

`auth.uid() = user_id`

There are no public-read policies and no anonymous cloud data access.

## Indexes

The migration adds indexes for common future access patterns:

- `user_id` ownership filtering
- `case_id` lookup
- `dossier_type` filtering
- Bond source and target Dossier lookup
- `updated_at` sync scanning
- Board ordering by Case
- archived Case filtering by user

## Manual Execution

To apply the migration:

1. Open the Supabase project dashboard.
2. Go to SQL Editor.
3. Open `supabase/migrations/001_lorebound_cloud_schema.sql`.
4. Review the SQL.
5. Paste it into the SQL Editor.
6. Run it manually.

The application does not run this SQL automatically.

## Verification

After running the migration, verify:

- The four tables exist in the `public` schema.
- RLS is enabled on each table.
- Each table has ownership policies using `auth.uid() = user_id`.
- The `set_updated_at` trigger exists on each table.
- The foreign keys for Bonds and Board entries include `case_id` and `user_id`.
- No public-read policies exist.

## Environment Safety

Only these values belong in the browser app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never expose:

- database password
- secret key
- service-role key

Do not put secret credentials in client-side code or committed files.

## Current Status

Existing local IndexedDB data has not been migrated.

The current LoreBound app still uses Local Library persistence. Signing in connects a cloud account, but Cases, Dossiers, Bonds, Board positions, and images remain local until a later migration phase implements first sync.
