import { supabase } from '../../lib/supabase';
import type {
  CloudArchiveSnapshot,
  CloudBoardEntryRow,
  CloudBondRow,
  CloudCaseRow,
  CloudDossierRow,
  CloudQueryStatus,
} from './SyncTypes';

type TableName = 'cases' | 'dossiers' | 'bonds' | 'board_entries';

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

async function readTableWithStatus<T>(tableName: TableName) {
  const client = requireSupabase();
  const { data, error, status } = await client.from(tableName).select('*');

  if (!error) {
    return {
      rows: (data ?? []) as T[],
      query: {
        status: 'Success',
      } satisfies CloudQueryStatus,
    };
  }

  return {
    rows: [] as T[],
    query: {
      status: 'Failed',
      code: getCloudErrorCode(error),
      message: getCloudErrorMessage(error),
      httpStatus: status ?? getCloudErrorStatus(error),
    } satisfies CloudQueryStatus,
  };
}

async function upsertRows<T extends { id: string }>(tableName: TableName, rows: T[]) {
  if (rows.length === 0) {
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from(tableName).upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message);
  }
}

class CloudArchiveRepository {
  async readArchive(): Promise<CloudArchiveSnapshot> {
    const [cases, dossiers, bonds, boardEntries] = await Promise.all([
      readTable<CloudCaseRow>('cases'),
      readTable<CloudDossierRow>('dossiers'),
      readTable<CloudBondRow>('bonds'),
      readTable<CloudBoardEntryRow>('board_entries'),
    ]);

    return {
      cases,
      dossiers,
      bonds,
      boardEntries,
    };
  }

  async readArchiveWithDiagnostics() {
    const [cases, dossiers, bonds, boardEntries] = await Promise.all([
      readTableWithStatus<CloudCaseRow>('cases'),
      readTableWithStatus<CloudDossierRow>('dossiers'),
      readTableWithStatus<CloudBondRow>('bonds'),
      readTableWithStatus<CloudBoardEntryRow>('board_entries'),
    ]);

    return {
      archive: {
        cases: cases.rows,
        dossiers: dossiers.rows,
        bonds: bonds.rows,
        boardEntries: boardEntries.rows,
      },
      queries: {
        cases: cases.query,
        dossiers: dossiers.query,
        bonds: bonds.query,
        boardEntries: boardEntries.query,
      },
      isAvailable:
        cases.query.status === 'Success' &&
        dossiers.query.status === 'Success' &&
        bonds.query.status === 'Success' &&
        boardEntries.query.status === 'Success',
    };
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
}

export const cloudArchiveRepository = new CloudArchiveRepository();
