import {
  importFullLocalArchive,
  localArchiveStorageInfo,
  readFullLocalArchive,
  readLocalSyncState,
  recordLocalSyncState,
} from '../../features/cases/storage/caseStorage';
import type { LoreCase } from '../../features/cases/types/caseTypes';
import type { Dossier } from '../../features/cases/types/dossierTypes';
import { authService } from '../auth/AuthService';
import { environmentManager } from '../environment/EnvironmentManager';
import {
  cloudImageProvider,
  createCloudImagePath,
  type LocalImageCandidate,
  type PreparedCloudImage,
} from '../images/ImageProvider';
import { getActiveStorageProvider } from '../storage/storageProviderRegistry';
import { cloudArchiveRepository } from './CloudArchiveRepository';
import {
  mapBoardPinToCloudRow,
  mapBondToCloudRow,
  mapCaseToCloudRow,
  mapCloudBoardEntryToLocal,
  mapCloudBondToLocal,
  mapCloudCaseToLocal,
  mapCloudDossierToLocal,
  mapDossierToCloudRow,
} from './SyncMappers';
import type {
  CloudArchiveSnapshot,
  LocalArchiveSnapshot,
  SyncPlan,
  SyncPlanSection,
  SyncProgress,
  SyncResult,
  SyncEntityType,
  SyncStage,
} from './SyncTypes';

export type SyncStatus = {
  mode: 'local' | 'cloud';
  state: 'local-only' | 'idle' | 'syncing' | 'error';
  label: string;
  detail: string;
  lastSyncedAt: string | null;
};

export type SyncPlanResult =
  | {
      ok: true;
      plan: SyncPlan;
    }
  | {
      ok: false;
      plan: SyncPlan;
      message: string;
    };

export interface SyncService {
  getStatus: () => Promise<SyncStatus>;
  createPlan: () => Promise<SyncPlanResult>;
  synchronize: (onProgress?: (progress: SyncProgress) => void) => Promise<SyncResult>;
  retrieve: (onProgress?: (progress: SyncProgress) => void) => Promise<SyncResult>;
}

const emptyPlanSection: SyncPlanSection = {
  newRecords: 0,
  existingRecords: 0,
  unchangedRecords: 0,
  updatedRecords: 0,
  cloudUpdatesAvailable: 0,
  conflictRecords: 0,
  unsupportedRecords: 0,
  invalidRecords: 0,
  itemsRequiringReview: 0,
  localOnly: 0,
  onlineOnly: 0,
  matchingIds: 0,
  localNewer: 0,
  onlineNewer: 0,
  conflicts: 0,
  requiresReview: 0,
  sameTimestampDifferingContents: 0,
};

function emit(onProgress: ((progress: SyncProgress) => void) | undefined, stage: SyncStage, detail: string) {
  onProgress?.({
    stage,
    detail,
    completedStages: [],
    completedImages: 0,
    completedRecords: 0,
    remainingRecords: 0,
  });
}

function createEmptyPlan(): SyncPlan {
  const failedQuery = {
    status: 'Failed' as const,
    message: 'Not reviewed.',
    httpStatus: null,
  };

  return {
    local: {
      investigationName: null,
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
      localImageCount: 0,
      estimatedTransferBytes: 0,
    },
    online: {
      isAvailable: false,
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
    },
    sections: {
      cases: { ...emptyPlanSection },
      dossiers: { ...emptyPlanSection },
      bonds: { ...emptyPlanSection },
      boardEntries: { ...emptyPlanSection },
    },
    canSynchronize: false,
    canRetrieve: false,
    isLocalArchiveEmpty: true,
    isOnlineArchiveEmpty: true,
    lastSynchronizedAt: null,
    blockingReasons: [],
    imageStatus: {
      readyToSynchronize: 0,
      awaitingStorageSetup: 0,
      couldNotProcess: 0,
      message: 'No stored images were found in this Local Archive.',
    },
    diagnostics: {
      localSource: localArchiveStorageInfo.source,
      localDatabaseName: localArchiveStorageInfo.databaseName,
      localDatabaseVersion: localArchiveStorageInfo.databaseVersion,
      localObjectStores: localArchiveStorageInfo.objectStores,
      localInvestigationsRead: 0,
      localDossiersRead: 0,
      localBondsRead: 0,
      localEvidencePinsRead: 0,
      cloudQueries: {
        cases: failedQuery,
        dossiers: failedQuery,
        bonds: failedQuery,
        boardEntries: failedQuery,
      },
      storage: {
        bucketReachable: false,
        localImagesExtracted: 0,
        imagesPrepared: 0,
        imageUploadsSucceeded: 0,
        imageUploadsFailed: 0,
        storageVerificationSucceeded: 0,
      },
      reconciliation: {
        baselineMetadataPresent: false,
        invalidIds: 0,
        timestampParseFailures: 0,
        fingerprintMismatches: 0,
        automaticGateReason: 'Not reviewed.',
      },
    },
    imagePaths: {
      cases: {},
      dossiers: {},
    },
  };
}

function estimateBytes(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}

function countLocalImages(localArchive: LocalArchiveSnapshot) {
  return extractLocalImages(localArchive).length;
}

function extractLocalImages(localArchive: LocalArchiveSnapshot): LocalImageCandidate[] {
  const imagesByValue = new Map<string, LocalImageCandidate>();

  localArchive.cases.forEach((loreCase) => {
    if (loreCase.coverImage) {
      imagesByValue.set(loreCase.coverImage, {
        entityType: 'investigations',
        recordId: loreCase.id,
        localValue: loreCase.coverImage,
      });
    }
  });

  localArchive.dossiers.forEach((dossier) => {
    if (dossier.coverImage) {
      imagesByValue.set(dossier.coverImage, {
        entityType: 'dossiers',
        recordId: dossier.id,
        localValue: dossier.coverImage,
      });
    }
  });

  return [...imagesByValue.values()];
}

async function prepareCloudImages(localArchive: LocalArchiveSnapshot, userId: string) {
  const candidates = extractLocalImages(localArchive);
  const preparedImages: PreparedCloudImage[] = [];
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      preparedImages.push(await cloudImageProvider.prepareImage(candidate, userId));
    } catch {
      failures.push(candidate.recordId);
    }
  }

  return {
    candidates,
    preparedImages,
    failures,
  };
}

function getPlannedImagePaths(localArchive: LocalArchiveSnapshot, userId: string) {
  return {
    cases: Object.fromEntries(
      localArchive.cases
        .filter((loreCase) => loreCase.coverImage)
        .map((loreCase) => [
          loreCase.id,
          createCloudImagePath(userId, 'investigations', loreCase.id),
        ]),
    ),
    dossiers: Object.fromEntries(
      localArchive.dossiers
        .filter((dossier) => dossier.coverImage)
        .map((dossier) => [dossier.id, createCloudImagePath(userId, 'dossiers', dossier.id)]),
    ),
  };
}

async function uploadPreparedImages(
  images: PreparedCloudImage[],
  onImageProgress?: (completedCount: number, totalCount: number) => void,
) {
  let uploadedCount = 0;

  for (const image of images) {
    await cloudImageProvider.uploadImage(image);
    uploadedCount += 1;
    onImageProgress?.(uploadedCount, images.length);
  }

  return uploadedCount;
}

async function verifyPreparedImages(images: PreparedCloudImage[]) {
  let verifiedCount = 0;

  for (const image of images) {
    const exists = await cloudImageProvider.imageExists(image.path);

    if (!exists) {
      throw new Error('Unable to verify synchronized stored images.');
    }

    verifiedCount += 1;
  }

  return verifiedCount;
}

async function restoreCaseImages(cases: LoreCase[], rows: CloudArchiveSnapshot['cases']) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const restoredCases: LoreCase[] = [];

  for (const loreCase of cases) {
    const cloudPath = rowsById.get(loreCase.id)?.cover_image_cloud_path;

    if (!cloudPath) {
      restoredCases.push(loreCase);
      continue;
    }

    restoredCases.push({
      ...loreCase,
      coverImage: await cloudImageProvider.downloadImage(cloudPath),
    });
  }

  return restoredCases;
}

async function restoreDossierImages(dossiers: Dossier[], rows: CloudArchiveSnapshot['dossiers']) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const restoredDossiers: Dossier[] = [];

  for (const dossier of dossiers) {
    const cloudPath = rowsById.get(dossier.id)?.cover_image_cloud_path;

    if (!cloudPath) {
      restoredDossiers.push(dossier);
      continue;
    }

    restoredDossiers.push({
      ...dossier,
      coverImage: await cloudImageProvider.downloadImage(cloudPath),
    });
  }

  return restoredDossiers;
}

function normalizeOptional(value: unknown) {
  return value === undefined || value === '' ? null : value;
}

function normalizeTimestamp(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

function roundCoordinate(value: number) {
  return Math.round(Number(value) * 1000) / 1000;
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined && entryValue !== '')
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }

  return value;
}

function fingerprint(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function getFingerprintKey(entityType: SyncEntityType, id: string) {
  return `${entityType}:${id}`;
}

function isValidStableId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCaseContent(record: {
  id: string;
  name?: string;
  caseName?: string;
  universe_type?: string;
  universeType?: string;
  author_or_creator?: string | null;
  authorOrCreator?: string;
  description?: string | null;
  cover_image_cloud_path?: string | null;
  coverImageCloudPath?: string | null;
  date_last_opened?: string | null;
  dateLastOpened?: string | null;
  is_archived?: boolean;
}) {
  return {
    id: record.id,
    name: normalizeOptional(record.name ?? record.caseName),
    universeType: normalizeOptional(record.universe_type ?? record.universeType),
    authorOrCreator: normalizeOptional(record.author_or_creator ?? record.authorOrCreator),
    description: normalizeOptional(record.description),
    coverImageCloudPath: normalizeOptional(record.cover_image_cloud_path ?? record.coverImageCloudPath),
    dateLastOpened: normalizeOptional(record.date_last_opened ?? record.dateLastOpened),
    isArchived: Boolean(record.is_archived ?? false),
  };
}

function normalizeDossierContent(record: {
  id: string;
  case_id?: string;
  caseId?: string;
  dossier_type?: string;
  dossierType?: string;
  name: string;
  cover_image_cloud_path?: string | null;
  coverImageCloudPath?: string | null;
  summary?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: record.id,
    caseId: normalizeOptional(record.case_id ?? record.caseId),
    dossierType: normalizeOptional(record.dossier_type ?? record.dossierType),
    name: normalizeOptional(record.name),
    coverImageCloudPath: normalizeOptional(record.cover_image_cloud_path ?? record.coverImageCloudPath),
    summary: normalizeOptional(record.summary),
    notes: normalizeOptional(record.notes),
    metadata: canonicalize(record.metadata ?? {}),
  };
}

function normalizeBondContent(record: {
  id: string;
  case_id?: string;
  caseId?: string;
  source_dossier_id?: string;
  sourceDossierId?: string;
  target_dossier_id?: string;
  targetDossierId?: string;
  bond_type?: string;
  bondType?: string;
  bond_behavior?: string;
  bondBehavior?: string;
  source_label?: string | null;
  sourceLabel?: string;
  target_label?: string | null;
  targetLabel?: string;
  status?: string | null;
  notes?: string | null;
  evidence?: Record<string, unknown>;
}) {
  return {
    id: record.id,
    caseId: normalizeOptional(record.case_id ?? record.caseId),
    sourceDossierId: normalizeOptional(record.source_dossier_id ?? record.sourceDossierId),
    targetDossierId: normalizeOptional(record.target_dossier_id ?? record.targetDossierId),
    bondType: normalizeOptional(record.bond_type ?? record.bondType),
    bondBehavior: normalizeOptional(record.bond_behavior ?? record.bondBehavior),
    sourceLabel: normalizeOptional(record.source_label ?? record.sourceLabel),
    targetLabel: normalizeOptional(record.target_label ?? record.targetLabel),
    status: normalizeOptional(record.status),
    notes: normalizeOptional(record.notes),
    evidence: canonicalize(record.evidence ?? {}),
  };
}

function normalizeBoardEntryContent(record: {
  id: string;
  case_id?: string;
  caseId?: string;
  dossier_id?: string;
  dossierId?: string;
  board_order?: number;
  order?: number;
  position_x?: number;
  position_y?: number;
  position?: { x: number; y: number };
}) {
  return {
    id: record.id,
    caseId: normalizeOptional(record.case_id ?? record.caseId),
    dossierId: normalizeOptional(record.dossier_id ?? record.dossierId),
    order: Number(record.board_order ?? record.order ?? 0),
    position: {
      x: roundCoordinate(record.position_x ?? record.position?.x ?? 0),
      y: roundCoordinate(record.position_y ?? record.position?.y ?? 0),
    },
  };
}

type ReconciliationStats = {
  invalidIds: number;
  timestampParseFailures: number;
  fingerprintMismatches: number;
};

function compareById<TLocal extends { id: string }, TOnline extends { id: string }>(
  entityType: SyncEntityType,
  localRecords: TLocal[],
  onlineRecords: TOnline[],
  getLocalUpdatedAt: (record: TLocal) => string,
  getOnlineUpdatedAt: (record: TOnline) => string,
  normalizeLocalForComparison: (record: TLocal) => unknown,
  normalizeOnlineForComparison: (record: TOnline) => unknown,
  baselineFingerprints: Record<string, string> | undefined,
  stats: ReconciliationStats,
) {
  const onlineById = new Map(onlineRecords.map((record) => [record.id, record]));
  const localIds = new Set(localRecords.map((record) => record.id));
  const section = { ...emptyPlanSection };

  localRecords.forEach((localRecord) => {
    if (!isValidStableId(localRecord.id)) {
      section.invalidRecords += 1;
      section.requiresReview += 1;
      section.itemsRequiringReview += 1;
      stats.invalidIds += 1;
      return;
    }

    const onlineRecord = onlineById.get(localRecord.id);

    if (!onlineRecord) {
      section.localOnly += 1;
      section.newRecords += 1;
      return;
    }

    section.matchingIds += 1;
    const localTime = normalizeTimestamp(getLocalUpdatedAt(localRecord));
    const onlineTime = normalizeTimestamp(getOnlineUpdatedAt(onlineRecord));
    const localFingerprint = fingerprint(normalizeLocalForComparison(localRecord));
    const onlineFingerprint = fingerprint(normalizeOnlineForComparison(onlineRecord));
    const baselineFingerprint = baselineFingerprints?.[getFingerprintKey(entityType, localRecord.id)];

    if (localTime === null || onlineTime === null) {
      stats.timestampParseFailures += 1;
    }

    if (localFingerprint === onlineFingerprint) {
      section.existingRecords += 1;
      section.unchangedRecords += 1;
      return;
    }

    stats.fingerprintMismatches += 1;

    if (baselineFingerprint) {
      const localChanged = localFingerprint !== baselineFingerprint;
      const onlineChanged = onlineFingerprint !== baselineFingerprint;

      if (localChanged && !onlineChanged) {
        section.localNewer += 1;
        section.updatedRecords += 1;
        return;
      }

      if (!localChanged && onlineChanged) {
        section.onlineNewer += 1;
        section.cloudUpdatesAvailable += 1;
        return;
      }

      if (localChanged && onlineChanged) {
        section.conflicts += 1;
        section.conflictRecords += 1;
        return;
      }
    }

    if (localTime !== null && onlineTime !== null && localTime > onlineTime) {
      section.localNewer += 1;
      section.updatedRecords += 1;
    } else if (localTime !== null && onlineTime !== null && onlineTime > localTime) {
      section.onlineNewer += 1;
      section.cloudUpdatesAvailable += 1;
    } else {
      section.sameTimestampDifferingContents += 1;
      section.requiresReview += 1;
      section.itemsRequiringReview += 1;
    }
  });

  onlineRecords.forEach((record) => {
    if (!isValidStableId(record.id)) {
      section.invalidRecords += 1;
      section.requiresReview += 1;
      section.itemsRequiringReview += 1;
      stats.invalidIds += 1;
      return;
    }

    if (!localIds.has(record.id)) {
      section.onlineOnly += 1;
      section.cloudUpdatesAvailable += 1;
    }
  });

  return section;
}

function isArchiveEmpty(snapshot: { cases: unknown[]; dossiers: unknown[]; bonds: unknown[]; boardEntries?: unknown[]; boardPins?: unknown[] }) {
  return (
    snapshot.cases.length +
      snapshot.dossiers.length +
      snapshot.bonds.length +
      (snapshot.boardEntries?.length ?? snapshot.boardPins?.length ?? 0) ===
    0
  );
}

function validateDependencies(localArchive: LocalArchiveSnapshot) {
  const reasons: string[] = [];
  const caseIds = new Set(localArchive.cases.map((loreCase) => loreCase.id));
  const dossierIds = new Set(localArchive.dossiers.map((dossier) => dossier.id));

  localArchive.dossiers.forEach((dossier) => {
    if (!caseIds.has(dossier.caseId)) {
      reasons.push(`Dossier "${dossier.name}" is missing its Investigation.`);
    }
  });

  localArchive.bonds.forEach((bond) => {
    if (!caseIds.has(bond.caseId)) {
      reasons.push(`Bond "${bond.bondType}" is missing its Investigation.`);
    }

    if (!dossierIds.has(bond.sourceDossierId) || !dossierIds.has(bond.targetDossierId)) {
      reasons.push(`Bond "${bond.bondType}" references a missing Dossier.`);
    }
  });

  localArchive.boardPins.forEach((pin) => {
    if (!caseIds.has(pin.caseId) || !dossierIds.has(pin.dossierId)) {
      reasons.push('An Evidence Pin references a missing Investigation or Dossier.');
    }
  });

  return reasons;
}

function createLocalFingerprintSnapshot(
  localArchive: LocalArchiveSnapshot,
  imagePaths: { cases: Record<string, string>; dossiers: Record<string, string> },
) {
  return Object.fromEntries([
    ...localArchive.cases.map((record) => [
      getFingerprintKey('cases', record.id),
      fingerprint(
        normalizeCaseContent({
          ...record,
          coverImageCloudPath: imagePaths.cases[record.id] ?? null,
        }),
      ),
    ]),
    ...localArchive.dossiers.map((record) => [
      getFingerprintKey('dossiers', record.id),
      fingerprint(
        normalizeDossierContent({
          ...record,
          coverImageCloudPath: imagePaths.dossiers[record.id] ?? null,
          metadata: Object.fromEntries(
            [
              'alias',
              'characterStatus',
              'affiliation',
              'region',
              'world',
              'eventDate',
              'era',
              'leader',
              'organizationType',
              'theoryConfidence',
              'theoryStatus',
            ].map((field) => [field, (record as unknown as Record<string, unknown>)[field]]),
          ),
        }),
      ),
    ]),
    ...localArchive.bonds.map((record) => [
      getFingerprintKey('bonds', record.id),
      fingerprint(normalizeBondContent(record)),
    ]),
    ...localArchive.boardPins.map((record) => [
      getFingerprintKey('boardEntries', record.id),
      fingerprint(normalizeBoardEntryContent(record)),
    ]),
  ]);
}

class LoreBoundSyncService implements SyncService {
  async getStatus(): Promise<SyncStatus> {
    const environment = environmentManager.getEnvironment();
    const storageStatus = getActiveStorageProvider().getStatus();

    if (!environment.isCloudConfigured || storageStatus.mode === 'local') {
      return {
        mode: 'local',
        state: 'local-only',
        label:
          environment.cloud.provider === 'supabase'
            ? 'Connected to LoreBound Online, Local Archive Active'
            : 'Offline Mode',
        detail:
          environment.cloud.provider === 'supabase'
            ? 'LoreBound Online is configured. Synchronize Investigation is available after review.'
            : 'LoreBound Online is not available.',
        lastSyncedAt: null,
      };
    }

    return {
      mode: 'cloud',
      state: 'idle',
      label: 'LoreBound Online Archive',
      detail: 'Synchronize Investigation is ready.',
      lastSyncedAt: null,
    };
  }

  async createPlan(): Promise<SyncPlanResult> {
    const plan = createEmptyPlan();
    const user = await authService.getCurrentUser();

    if (!user) {
      plan.blockingReasons.push('Investigator Connect is required.');
      return { ok: false, plan, message: 'Connect your Investigator Profile first.' };
    }

    const localArchive = await readFullLocalArchive();
    const localSyncState = await readLocalSyncState();
    plan.diagnostics = {
      ...plan.diagnostics,
      localInvestigationsRead: localArchive.cases.length,
      localDossiersRead: localArchive.dossiers.length,
      localBondsRead: localArchive.bonds.length,
      localEvidencePinsRead: localArchive.boardPins.length,
    };
    const onlineRead = await cloudArchiveRepository.readArchiveWithDiagnostics();
    const onlineArchive: CloudArchiveSnapshot = onlineRead.archive;

    plan.diagnostics = {
      ...plan.diagnostics,
      cloudQueries: onlineRead.queries,
    };

    if (!onlineRead.isAvailable) {
      plan.blockingReasons.push('LoreBound Online could not be reviewed.');
      return { ok: false, plan, message: 'LoreBound Online could not be reviewed.' };
    }

    const localImageCount = countLocalImages(localArchive);
    const imageReadiness = await cloudImageProvider.checkReadiness(user.id);
    const imagePreparation =
      localImageCount > 0
        ? await prepareCloudImages(localArchive, user.id)
        : { candidates: [], preparedImages: [], failures: [] };
    const dependencyReasons = validateDependencies(localArchive);
    const isLocalArchiveEmpty = isArchiveEmpty(localArchive);
    const isOnlineArchiveEmpty = isArchiveEmpty(onlineArchive);
    const plannedImagePaths = getPlannedImagePaths(localArchive, user.id);
    const reconciliationStats: ReconciliationStats = {
      invalidIds: 0,
      timestampParseFailures: 0,
      fingerprintMismatches: 0,
    };

    plan.local = {
      investigationName:
        localArchive.cases.find((loreCase) => loreCase.id === localArchive.activeCaseId)?.caseName ??
        localArchive.cases[0]?.caseName ??
        null,
      caseCount: localArchive.cases.length,
      dossierCount: localArchive.dossiers.length,
      bondCount: localArchive.bonds.length,
      boardEntryCount: localArchive.boardPins.length,
      localImageCount,
      estimatedTransferBytes: estimateBytes(localArchive),
    };
    plan.online = {
      isAvailable: true,
      caseCount: onlineArchive.cases.length,
      dossierCount: onlineArchive.dossiers.length,
      bondCount: onlineArchive.bonds.length,
      boardEntryCount: onlineArchive.boardEntries.length,
    };
    plan.isLocalArchiveEmpty = isLocalArchiveEmpty;
    plan.isOnlineArchiveEmpty = isOnlineArchiveEmpty;
    plan.lastSynchronizedAt = localSyncState?.lastSuccessfulSynchronizationAt ?? null;
    plan.imagePaths = plannedImagePaths;
    plan.diagnostics = {
      ...plan.diagnostics,
      storage: {
        ...plan.diagnostics.storage,
        bucketReachable: imageReadiness.bucketReachable,
        localImagesExtracted: imagePreparation.candidates.length,
        imagesPrepared: imagePreparation.preparedImages.length,
      },
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        baselineMetadataPresent: Boolean(localSyncState?.synchronizedFingerprints),
      },
    };
    plan.sections = {
      cases: compareById(
        'cases',
        localArchive.cases,
        onlineArchive.cases,
        (record) => record.dateLastModified,
        (record) => record.updated_at,
        (record) =>
          normalizeCaseContent({
            ...record,
            coverImageCloudPath:
              plannedImagePaths.cases[record.id] ??
              localSyncState?.cloudImagePaths?.cases?.[record.id] ??
              null,
          }),
        normalizeCaseContent,
        localSyncState?.synchronizedFingerprints,
        reconciliationStats,
      ),
      dossiers: compareById(
        'dossiers',
        localArchive.dossiers,
        onlineArchive.dossiers,
        (record) => record.dateModified,
        (record) => record.updated_at,
        (record) =>
          normalizeDossierContent({
            ...record,
            coverImageCloudPath:
              plannedImagePaths.dossiers[record.id] ??
              localSyncState?.cloudImagePaths?.dossiers?.[record.id] ??
              null,
            metadata: Object.fromEntries(
              [
                'alias',
                'characterStatus',
                'affiliation',
                'region',
                'world',
                'eventDate',
                'era',
                'leader',
                'organizationType',
                'theoryConfidence',
                'theoryStatus',
              ].map((field) => [field, (record as unknown as Record<string, unknown>)[field]]),
            ),
          }),
        normalizeDossierContent,
        localSyncState?.synchronizedFingerprints,
        reconciliationStats,
      ),
      bonds: compareById(
        'bonds',
        localArchive.bonds,
        onlineArchive.bonds,
        (record) => record.dateModified,
        (record) => record.updated_at,
        normalizeBondContent,
        normalizeBondContent,
        localSyncState?.synchronizedFingerprints,
        reconciliationStats,
      ),
      boardEntries: compareById(
        'boardEntries',
        localArchive.boardPins,
        onlineArchive.boardEntries,
        (record) => record.datePinned,
        (record) => record.updated_at,
        normalizeBoardEntryContent,
        normalizeBoardEntryContent,
        localSyncState?.synchronizedFingerprints,
        reconciliationStats,
      ),
    };
    plan.diagnostics = {
      ...plan.diagnostics,
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        invalidIds: reconciliationStats.invalidIds,
        timestampParseFailures: reconciliationStats.timestampParseFailures,
        fingerprintMismatches: reconciliationStats.fingerprintMismatches,
      },
    };
    plan.imageStatus = {
      readyToSynchronize: imagePreparation.preparedImages.length,
      awaitingStorageSetup: localImageCount > 0 && !imageReadiness.bucketReachable ? localImageCount : 0,
      couldNotProcess: imagePreparation.failures.length,
      message:
        localImageCount === 0
          ? 'No stored images were found in this Local Archive.'
          : imageReadiness.bucketReachable && imagePreparation.failures.length === 0
            ? `${imagePreparation.preparedImages.length} stored images are ready for LoreBound Online.`
            : 'LoreBound Online image storage is not available for this Investigator Profile.',
    };
    const hasBlockingReview =
      !isLocalArchiveEmpty &&
      !isOnlineArchiveEmpty &&
      Object.values(plan.sections).some(
        (section) => section.conflictRecords > 0 || section.itemsRequiringReview > 0,
      );
    const hasCloudUpdates = Object.values(plan.sections).some(
      (section) => section.cloudUpdatesAvailable > 0,
    );
    const hasLocalChanges = Object.values(plan.sections).some(
      (section) => section.newRecords > 0 || section.updatedRecords > 0,
    );

    plan.blockingReasons = [
      ...dependencyReasons,
      ...(!imageReadiness.bucketReachable
        ? ['LoreBound Online image storage is not available for this Investigator Profile.']
        : []),
      ...(imagePreparation.failures.length > 0
        ? ['One or more stored images must be reviewed before synchronization.']
        : []),
      ...(hasBlockingReview
        ? ['Archive Reconciliation Required. Review conflicts before synchronization.']
        : []),
      ...(hasCloudUpdates
        ? ['LoreBound Online Updates Available. Review retrieval before updating this archive.']
        : []),
    ];
    plan.canSynchronize =
      hasLocalChanges && plan.blockingReasons.length === 0 && plan.online.isAvailable;
    plan.canRetrieve =
      isLocalArchiveEmpty && !isOnlineArchiveEmpty && plan.blockingReasons.length === 0;
    plan.diagnostics = {
      ...plan.diagnostics,
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        automaticGateReason:
          plan.blockingReasons[0] ??
          (hasLocalChanges ? 'Local changes waiting.' : 'Archive up to date.'),
      },
    };

    return { ok: true, plan };
  }

  async synchronize(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
    const user = await authService.getCurrentUser();

    if (!user) {
      return {
        ok: false,
        message: 'Investigator Connect is required before synchronization.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        completedStages: [],
        itemsRequiringReview: 0,
      };
    }

    const planResult = await this.createPlan();

    if (!planResult.ok || !planResult.plan.canSynchronize) {
      return {
        ok: false,
        message: planResult.plan.blockingReasons[0] ?? 'Synchronization is not available for this archive.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        completedStages: [],
        itemsRequiringReview: Object.values(planResult.plan.sections).reduce(
          (total, section) => total + section.itemsRequiringReview,
          0,
        ),
      };
    }

    const localArchive = await readFullLocalArchive();
    const totalRecords =
      localArchive.cases.length +
      localArchive.dossiers.length +
      localArchive.bonds.length +
      localArchive.boardPins.length;
    let activeStage: SyncStage = 'Preparing Archive';
    let completedImages = 0;
    let completedRecords = 0;
    const completedStages: SyncStage[] = [];
    const report = (stage: SyncStage, detail: string) => {
      activeStage = stage;
      onProgress?.({
        stage,
        detail,
        completedStages: [...completedStages],
        completedImages,
        completedRecords,
        remainingRecords: Math.max(0, totalRecords - completedRecords),
      });
    };
    const completeStage = (stage: SyncStage) => {
      if (!completedStages.includes(stage)) {
        completedStages.push(stage);
      }
    };

    try {
      report('Preparing Archive', 'Reviewing Local Archive records before securing them.');
      completeStage('Preparing Archive');
      report('Preparing Stored Images', 'Preparing stored images for LoreBound Online.');
      const imagePreparation = await prepareCloudImages(localArchive, user.id);

      if (imagePreparation.failures.length > 0) {
        throw new Error('One or more stored images must be reviewed before synchronization.');
      }

      completeStage('Preparing Stored Images');
      const uploadedImageCount =
        imagePreparation.preparedImages.length > 0
          ? await uploadPreparedImages(imagePreparation.preparedImages, (completedCount, totalCount) => {
              completedImages = completedCount;
              report('Securing Stored Images', `${completedCount} of ${totalCount} stored images secured.`);
            })
          : 0;
      completedImages = uploadedImageCount;
      completeStage('Securing Stored Images');
      const imagePaths = getPlannedImagePaths(localArchive, user.id);
      const caseRows = localArchive.cases.map((record) =>
        mapCaseToCloudRow(record, user.id, imagePaths.cases[record.id]),
      );
      const dossierRows = localArchive.dossiers.map((record) =>
        mapDossierToCloudRow(record, user.id, imagePaths.dossiers[record.id]),
      );
      const bondRows = localArchive.bonds.map((record) => mapBondToCloudRow(record, user.id));
      const boardEntryRows = localArchive.boardPins.map((record) => mapBoardPinToCloudRow(record, user.id));

      report('Synchronizing Investigation', `Securing ${caseRows.length} Investigation records.`);
      await cloudArchiveRepository.upsertCases(caseRows);
      completedRecords += caseRows.length;
      completeStage('Synchronizing Investigation');
      report('Synchronizing Evidence Files', `Securing ${dossierRows.length} Evidence File records.`);
      await cloudArchiveRepository.upsertDossiers(dossierRows);
      completedRecords += dossierRows.length;
      completeStage('Synchronizing Evidence Files');
      report('Synchronizing Connections', `Securing ${bondRows.length} Connection records.`);
      await cloudArchiveRepository.upsertBonds(bondRows);
      completedRecords += bondRows.length;
      completeStage('Synchronizing Connections');
      report('Synchronizing Evidence Board', `Securing ${boardEntryRows.length} Evidence Pin records.`);
      await cloudArchiveRepository.upsertBoardEntries(boardEntryRows);
      completedRecords += boardEntryRows.length;
      completeStage('Synchronizing Evidence Board');
      report('Verifying Investigation', 'Verifying secured Investigation records.');
      const onlineArchive = await cloudArchiveRepository.readArchive();

      this.verifyOnlineArchive(localArchive, onlineArchive, user.id);
      completeStage('Verifying Investigation');
      report('Verifying Stored Images', 'Verifying secured stored images.');
      await verifyPreparedImages(imagePreparation.preparedImages);
      completeStage('Verifying Stored Images');
      report('Finalizing Investigation', 'Recording the local synchronization marker.');
      await recordLocalSyncState({
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: {
          cases: localArchive.cases.map((record) => record.id),
          dossiers: localArchive.dossiers.map((record) => record.id),
          bonds: localArchive.bonds.map((record) => record.id),
          boardPins: localArchive.boardPins.map((record) => record.id),
        },
        synchronizedUpdatedAt: Object.fromEntries([
          ...localArchive.cases.map((record) => [record.id, record.dateLastModified]),
          ...localArchive.dossiers.map((record) => [record.id, record.dateModified]),
          ...localArchive.bonds.map((record) => [record.id, record.dateModified]),
          ...localArchive.boardPins.map((record) => [record.id, record.datePinned]),
        ]),
        synchronizedFingerprints: createLocalFingerprintSnapshot(localArchive, imagePaths),
        cloudImagePaths: imagePaths,
        synchronizationVersion: 1,
      });
      completeStage('Finalizing Investigation');

      return {
        ok: true,
        message: 'Investigation Secured',
        counts: {
          cases: localArchive.cases.length,
          dossiers: localArchive.dossiers.length,
          bonds: localArchive.bonds.length,
          boardEntries: localArchive.boardPins.length,
          images: uploadedImageCount,
        },
        completedStages,
        itemsRequiringReview: Object.values(planResult.plan.sections).reduce(
          (total, section) => total + section.itemsRequiringReview,
          0,
        ),
        transferSize: planResult.plan.local.estimatedTransferBytes,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to synchronize this Local Archive. LoreBound can safely retry.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        failedStage: activeStage,
        completedStages,
        itemsRequiringReview: Object.values(planResult.plan.sections).reduce(
          (total, section) => total + section.itemsRequiringReview,
          0,
        ),
        transferSize: planResult.plan.local.estimatedTransferBytes,
      };
    }
  }

  async retrieve(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
    const planResult = await this.createPlan();

    if (!planResult.ok || !planResult.plan.canRetrieve) {
      return {
        ok: false,
        message: planResult.plan.blockingReasons[0] ?? 'Retrieve Investigation is not available.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
      };
    }

    try {
      const onlineArchive = await cloudArchiveRepository.readArchive();

      emit(onProgress, 'Retrieving Investigations', `${onlineArchive.cases.length} Investigation records.`);
      const casesWithoutImages = onlineArchive.cases.map(mapCloudCaseToLocal);
      emit(onProgress, 'Retrieving Dossiers', `${onlineArchive.dossiers.length} Dossier records.`);
      const dossiersWithoutImages = onlineArchive.dossiers.map(mapCloudDossierToLocal);
      emit(onProgress, 'Retrieving Stored Images', 'Retrieving stored images from LoreBound Online.');
      const [cases, dossiers] = await Promise.all([
        restoreCaseImages(casesWithoutImages, onlineArchive.cases),
        restoreDossierImages(dossiersWithoutImages, onlineArchive.dossiers),
      ]);
      emit(onProgress, 'Retrieving Bonds', `${onlineArchive.bonds.length} Bond records.`);
      const bonds = onlineArchive.bonds.map(mapCloudBondToLocal);
      emit(onProgress, 'Retrieving Evidence Pins', `${onlineArchive.boardEntries.length} Evidence Pin records.`);
      const boardPins = onlineArchive.boardEntries.map(mapCloudBoardEntryToLocal);

      await importFullLocalArchive({ cases, dossiers, bonds, boardPins });
      emit(onProgress, 'Verifying Local Archive', 'Verifying retrieved records.');
      const localArchive = await readFullLocalArchive();

      if (
        localArchive.cases.length < cases.length ||
        localArchive.dossiers.length < dossiers.length ||
        localArchive.bonds.length < bonds.length ||
        localArchive.boardPins.length < boardPins.length
      ) {
        throw new Error('Retrieve Investigation could not be verified.');
      }

      emit(onProgress, 'Finalizing Investigation', 'Recording local synchronization marker.');
      const user = await authService.getCurrentUser();
      const cloudImagePaths = {
        cases: Object.fromEntries(
          onlineArchive.cases
            .filter((record) => record.cover_image_cloud_path)
            .map((record) => [record.id, record.cover_image_cloud_path as string]),
        ),
        dossiers: Object.fromEntries(
          onlineArchive.dossiers
            .filter((record) => record.cover_image_cloud_path)
            .map((record) => [record.id, record.cover_image_cloud_path as string]),
        ),
      };

      if (user) {
        await recordLocalSyncState({
          investigatorId: user.id,
          lastSuccessfulSynchronizationAt: new Date().toISOString(),
          synchronizedRecordIds: {
            cases: cases.map((record) => record.id),
            dossiers: dossiers.map((record) => record.id),
            bonds: bonds.map((record) => record.id),
            boardPins: boardPins.map((record) => record.id),
          },
          synchronizedUpdatedAt: Object.fromEntries([
            ...cases.map((record) => [record.id, record.dateLastModified]),
            ...dossiers.map((record) => [record.id, record.dateModified]),
            ...bonds.map((record) => [record.id, record.dateModified]),
            ...boardPins.map((record) => [record.id, record.datePinned]),
          ]),
          synchronizedFingerprints: createLocalFingerprintSnapshot(
            { cases, dossiers, bonds, boardPins, activeCaseId: null },
            cloudImagePaths,
          ),
          cloudImagePaths,
          synchronizationVersion: 1,
        });
      }

      return {
        ok: true,
        message: 'Investigation Retrieved',
        counts: {
          cases: cases.length,
          dossiers: dossiers.length,
          bonds: bonds.length,
          boardEntries: boardPins.length,
        },
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to retrieve this Investigation. Your Local Archive remains available.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
      };
    }
  }

  private verifyOnlineArchive(localArchive: LocalArchiveSnapshot, onlineArchive: CloudArchiveSnapshot, userId: string) {
    const onlineCases = new Map(onlineArchive.cases.map((record) => [record.id, record]));
    const onlineDossiers = new Map(onlineArchive.dossiers.map((record) => [record.id, record]));
    const onlineBonds = new Map(onlineArchive.bonds.map((record) => [record.id, record]));
    const onlineBoardEntries = new Map(onlineArchive.boardEntries.map((record) => [record.id, record]));

    localArchive.cases.forEach((record) => {
      if (onlineCases.get(record.id)?.user_id !== userId) {
        throw new Error('Unable to verify synchronized Investigations.');
      }
    });

    localArchive.dossiers.forEach((record) => {
      const onlineRecord = onlineDossiers.get(record.id);

      if (!onlineRecord || onlineRecord.user_id !== userId || !onlineCases.has(record.caseId)) {
        throw new Error('Unable to verify synchronized Dossiers.');
      }
    });

    localArchive.bonds.forEach((record) => {
      const onlineRecord = onlineBonds.get(record.id);

      if (
        !onlineRecord ||
        onlineRecord.user_id !== userId ||
        !onlineDossiers.has(record.sourceDossierId) ||
        !onlineDossiers.has(record.targetDossierId)
      ) {
        throw new Error('Unable to verify synchronized Bonds.');
      }
    });

    localArchive.boardPins.forEach((record) => {
      const onlineRecord = onlineBoardEntries.get(record.id);

      if (!onlineRecord || onlineRecord.user_id !== userId || !onlineDossiers.has(record.dossierId)) {
        throw new Error('Unable to verify synchronized Evidence Pins.');
      }
    });
  }
}

export const syncService: SyncService = new LoreBoundSyncService();
