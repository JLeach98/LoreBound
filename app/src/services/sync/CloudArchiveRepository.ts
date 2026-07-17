import { supabase } from '../../lib/supabase';
import type {
  CloudArchiveSnapshot,
  CloudBoardEntryRow,
  CloudBondRow,
  CloudCaseRow,
  CloudDeletionEntityType,
  CloudDeletionLedgerRow,
  CloudDossierRow,
  CloudQueryStatus,
} from './SyncTypes';

type TableName = 'profiles' | 'cases' | 'dossiers' | 'bonds' | 'board_entries' | 'deletion_ledger';

function requireSupabase() {
  if (!supabase) {
    throw new Error('LoreBound Online is not available in this browser session.');
  }

  return supabase;
}

async function readTable<T>(tableName: TableName) {
  const client = requireSupabase();
  const { data, error } = await client.from(tableName).select('*');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

function sanitizeCloudMessage(message: string) {
  return message
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
    .trim();
}

function getCloudErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }

  return 'unknown';
}

function getCloudErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }

  return null;
}

function getCloudErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? sanitizeCloudMessage(message) : 'The query failed.';
  }

  return 'The query failed.';
}

function serializeCloudError(error: unknown) {
  if (!error) {
    return null;
  }

  try {
    return sanitizeCloudMessage(JSON.stringify(error, Object.getOwnPropertyNames(error)));
  } catch {
    return sanitizeCloudMessage(String(error));
  }
}

function isRlsError(error: unknown) {
  const message = getCloudErrorMessage(error).toLowerCase();

  return (
    message.includes('row-level security') ||
    message.includes('rls') ||
    message.includes('permission denied') ||
    message.includes('insufficient privilege')
  );
}

function createThrownQueryStatus(error: unknown): CloudQueryStatus {
  const thrownException = error instanceof Error ? error.message : String(error);

  return {
    status: 'Failed',
    queryStarted: true,
    queryCompleted: false,
    rowCount: 0,
    code: getCloudErrorCode(error),
    message: sanitizeCloudMessage(thrownException),
    httpStatus: getCloudErrorStatus(error),
    postgrestCode: getCloudErrorCode(error),
    rlsError: isRlsError(error),
    rawError: serializeCloudError(error) ?? sanitizeCloudMessage(thrownException),
    thrownException: sanitizeCloudMessage(thrownException),
  };
}

async function readTableWithStatus<T>(tableName: TableName) {
  try {
    const client = requireSupabase();
    const { data, error, status } = await client.from(tableName).select('*');

    if (!error) {
      const rows = (data ?? []) as T[];

      return {
        rows,
        query: {
          status: 'Success',
          queryStarted: true,
          queryCompleted: true,
          rowCount: rows.length,
        } satisfies CloudQueryStatus,
      };
    }

    return {
      rows: [] as T[],
      query: {
        status: 'Failed',
        queryStarted: true,
        queryCompleted: true,
        rowCount: 0,
        code: getCloudErrorCode(error),
        message: getCloudErrorMessage(error),
        httpStatus: status ?? getCloudErrorStatus(error),
        postgrestCode: getCloudErrorCode(error),
        rlsError: isRlsError(error),
        rawError: serializeCloudError(error) ?? undefined,
      } satisfies CloudQueryStatus,
    };
  } catch (error) {
    return {
      rows: [] as T[],
      query: createThrownQueryStatus(error),
    };
  }
}

async function upsertRows<T extends { id: string }>(tableName: TableName, rows: T[]) {
  if (rows.length === 0) {
    return;
  }

  const client = requireSupabase();
  const { error, status } = await client.from(tableName).upsert(rows, { onConflict: 'id' });

  if (error) {
    const failedId = rows[0]?.id ?? 'unknown';

    throw new Error(
      `${tableName} upload failed for ${failedId}: ${getCloudErrorCode(error)} ${getCloudErrorMessage(error)} HTTP ${status ?? getCloudErrorStatus(error) ?? 'unknown'}`,
    );
  }
}

async function deleteRows(tableName: TableName, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const client = requireSupabase();
  const { error, status } = await client.from(tableName).delete().in('id', ids);

  if (error) {
    const failedId = ids[0] ?? 'unknown';

    throw new Error(
      `${tableName} deletion failed for ${failedId}: ${getCloudErrorCode(error)} ${getCloudErrorMessage(error)} HTTP ${status ?? getCloudErrorStatus(error) ?? 'unknown'}`,
    );
  }
}

async function verifyRowsAbsent(tableName: TableName, ids: string[]) {
  if (ids.length === 0) {
    return true;
  }

  const client = requireSupabase();
  const { data, error, status } = await client.from(tableName).select('id').in('id', ids);

  if (error) {
    throw new Error(
      `${tableName} absence verification failed: ${getCloudErrorCode(error)} ${getCloudErrorMessage(error)} HTTP ${status ?? getCloudErrorStatus(error) ?? 'unknown'}`,
    );
  }

  return (data ?? []).length === 0;
}

async function updateRows<T extends { id: string }>(tableName: TableName, rows: T[]) {
  if (rows.length === 0) {
    return;
  }

  const client = requireSupabase();
  const { error, status } = await client.from(tableName).upsert(rows, { onConflict: 'id' });

  if (error) {
    const failedId = rows[0]?.id ?? 'unknown';

    throw new Error(
      `${tableName} update failed for ${failedId}: ${getCloudErrorCode(error)} ${getCloudErrorMessage(error)} HTTP ${status ?? getCloudErrorStatus(error) ?? 'unknown'}`,
    );
  }
}

class CloudArchiveRepository {
  async readArchive(): Promise<CloudArchiveSnapshot> {
    const [cases, dossiers, bonds, boardEntries, deletionLedger] = await Promise.all([
      readTable<CloudCaseRow>('cases'),
      readTable<CloudDossierRow>('dossiers'),
      readTable<CloudBondRow>('bonds'),
      readTable<CloudBoardEntryRow>('board_entries'),
      readTable<CloudDeletionLedgerRow>('deletion_ledger'),
    ]);

    return {
      cases,
      dossiers,
      bonds,
      boardEntries,
      deletionLedger,
    };
  }

  async readArchiveWithDiagnostics() {
    const [profiles, cases, dossiers, bonds, boardEntries, deletionLedger] = await Promise.all([
      readTableWithStatus<Record<string, unknown>>('profiles'),
      readTableWithStatus<CloudCaseRow>('cases'),
      readTableWithStatus<CloudDossierRow>('dossiers'),
      readTableWithStatus<CloudBondRow>('bonds'),
      readTableWithStatus<CloudBoardEntryRow>('board_entries'),
      readTableWithStatus<CloudDeletionLedgerRow>('deletion_ledger'),
    ]);

    return {
      archive: {
        cases: cases.rows,
        dossiers: dossiers.rows,
        bonds: bonds.rows,
        boardEntries: boardEntries.rows,
        deletionLedger: deletionLedger.rows,
      },
      queries: {
        profiles: profiles.query,
        cases: cases.query,
        dossiers: dossiers.query,
        bonds: bonds.query,
        boardEntries: boardEntries.query,
        deletionLedger: deletionLedger.query,
      },
      isAvailable:
        profiles.query.status === 'Success' &&
        cases.query.status === 'Success' &&
        dossiers.query.status === 'Success' &&
        bonds.query.status === 'Success' &&
        boardEntries.query.status === 'Success' &&
        deletionLedger.query.status === 'Success',
    };
  }

  async readDeletionLedger() {
    return readTable<CloudDeletionLedgerRow>('deletion_ledger');
  }

  async upsertDeletionLedger(rows: CloudDeletionLedgerRow[]) {
    await upsertRows('deletion_ledger', rows);
  }

  async updateDeletionLedgerAcknowledgement(rows: CloudDeletionLedgerRow[]) {
    await updateRows('deletion_ledger', rows);
  }

  async deleteDeletionLedgerEntries(ids: string[]) {
    await deleteRows('deletion_ledger', ids);
  }

  async readDeletionLedgerEntry(entityType: CloudDeletionEntityType, entityId: string) {
    const client = requireSupabase();
    const { data, error, status } = await client
      .from('deletion_ledger')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `deletion_ledger read failed for ${entityType}:${entityId}: ${getCloudErrorCode(error)} ${getCloudErrorMessage(error)} HTTP ${status ?? getCloudErrorStatus(error) ?? 'unknown'}`,
      );
    }

    return data as CloudDeletionLedgerRow | null;
  }

  async verifyDeletionLedgerEntry(entityType: CloudDeletionEntityType, entityId: string) {
    return Boolean(await this.readDeletionLedgerEntry(entityType, entityId));
  }

  async upsertCases(rows: CloudCaseRow[]) {
    await upsertRows('cases', rows);
  }

  async upsertDossiers(rows: CloudDossierRow[]) {
    await upsertRows('dossiers', rows);
  }

  async upsertBonds(rows: CloudBondRow[]) {
    await upsertRows('bonds', rows);
  }

  async upsertBoardEntries(rows: CloudBoardEntryRow[]) {
    await upsertRows('board_entries', rows);
  }

  async deleteCases(ids: string[]) {
    await deleteRows('cases', ids);
  }

  async deleteDossiers(ids: string[]) {
    await deleteRows('dossiers', ids);
  }

  async deleteBonds(ids: string[]) {
    await deleteRows('bonds', ids);
  }

  async deleteBoardEntries(ids: string[]) {
    await deleteRows('board_entries', ids);
  }

  async verifyCasesAbsent(ids: string[]) {
    return verifyRowsAbsent('cases', ids);
  }

  async verifyDossiersAbsent(ids: string[]) {
    return verifyRowsAbsent('dossiers', ids);
  }

  async verifyBondsAbsent(ids: string[]) {
    return verifyRowsAbsent('bonds', ids);
  }

  async verifyBoardEntriesAbsent(ids: string[]) {
    return verifyRowsAbsent('board_entries', ids);
  }
}

export const cloudArchiveRepository = new CloudArchiveRepository();
