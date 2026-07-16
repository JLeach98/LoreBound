import {
  importFullLocalArchive,
  localArchiveStorageInfo,
  readFullLocalArchive,
  readLocalSyncState,
  recordLocalSyncState,
  replaceEmptyCaseShellWithCloudArchive,
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
  buildDossierMetadataForSync,
  normalizeDossierSectionsForSync,
} from './SyncMappers';
import {
  archiveActionHasHandler,
  assertRunnableArchiveActionHasHandler,
  getSyncPlanArchiveAction,
} from './SyncTypes';
import type {
  CloudArchiveSnapshot,
  LocalArchiveSnapshot,
  SyncPlan,
  SyncPlanSection,
  SyncProgress,
  SyncResult,
  SyncEntityType,
  SyncRecordAction,
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
  rebuildBaseline: (onProgress?: (progress: SyncProgress) => void) => Promise<SyncResult>;
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
        baselineStatus: 'Missing',
        baselineReason: 'Not reviewed.',
        canRebuildBaseline: false,
        recordActions: [],
        selectedSynchronizationMode: 'none',
        uploadActionsCount: 0,
        retrievalActionsCount: 0,
        conflictActionsCount: 0,
        outboundGateReason: 'Not reviewed.',
        upsertDossiersInvoked: false,
        lastUploadedDossierId: null,
        cloudVerificationResult: 'Not reviewed.',
        baselineUpdated: false,
        sectionDiagnostics: {
          localSectionCount: 0,
          cloudSectionCount: 0,
          lastSyncedSectionCount: 0,
          localSectionIds: [],
          cloudSectionIds: [],
          sectionsIncludedInFingerprint: false,
          localDossierFingerprint: null,
          cloudDossierFingerprint: null,
          baselineDossierFingerprint: null,
          dossierClassification: 'Not reviewed.',
          sectionSerializationSucceeded: false,
          cloudSectionVerificationSucceeded: false,
          retrievalAppliedCloudSections: false,
          receivingIndexedDbSectionCount: 0,
        },
        invalidIds: 0,
        timestampParseFailures: 0,
        fingerprintMismatches: 0,
        automaticGateReason: 'Not reviewed.',
      },
      archiveState: {
        classification: 'Empty',
        activeInvestigationIdPresent: false,
        sameInvestigationIdLocalAndCloud: false,
        localCaseStableId: null,
        cloudCaseStableId: null,
        caseNormalizedMatch: false,
        emptyLocalCaseShell: false,
        localCaseNormalizedIdentity: {},
        cloudCaseNormalizedIdentity: {},
        caseMeaningfulDifferingFields: [],
        caseIgnoredDifferingFields: [],
        retrievalEligibility: 'Blocked',
        retrievalBlockReason: 'Not reviewed.',
        actionEnabled: false,
        disabledReason: 'Not reviewed.',
        handlerPresent: false,
        repairEligibility: 'Blocked',
        repairStage: 'Not started.',
        selectedAction: 'Not reviewed.',
        selectedActionReason: 'Not reviewed.',
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : 'Unknown',
        localImageReferences: 0,
        cloudImageReferences: 0,
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

function countCloudImages(onlineArchive: CloudArchiveSnapshot) {
  return (
    onlineArchive.cases.filter((record) => record.cover_image_cloud_path).length +
    onlineArchive.dossiers.filter((record) => record.cover_image_cloud_path).length
  );
}

function getPrimaryLocalCaseId(localArchive: LocalArchiveSnapshot) {
  if (localArchive.activeCaseId && localArchive.cases.some((record) => record.id === localArchive.activeCaseId)) {
    return localArchive.activeCaseId;
  }

  return localArchive.cases[0]?.id ?? null;
}

function getPrimaryCloudCaseId(onlineArchive: CloudArchiveSnapshot) {
  return onlineArchive.cases[0]?.id ?? null;
}

function hasSamePrimaryInvestigation(localArchive: LocalArchiveSnapshot, onlineArchive: CloudArchiveSnapshot) {
  const localCaseId = getPrimaryLocalCaseId(localArchive);
  const cloudCaseId = getPrimaryCloudCaseId(onlineArchive);

  return Boolean(localCaseId && cloudCaseId && localCaseId === cloudCaseId);
}

function normalizeCaseForRepairIdentity(record: LoreCase | CloudArchiveSnapshot['cases'][number]) {
  const value = record as LoreCase & CloudArchiveSnapshot['cases'][number];

  return {
    id: value.id,
    name: normalizeOptional(value.name ?? value.caseName),
    universeType: normalizeOptional(value.universe_type ?? value.universeType),
    authorOrCreator: normalizeOptional(value.author_or_creator ?? value.authorOrCreator),
    description: normalizeOptional(value.description),
    isArchived: Boolean(value.is_archived ?? false),
  };
}

function normalizeCaseMeaningfulIdentity(record: LoreCase | CloudArchiveSnapshot['cases'][number]) {
  const value = record as LoreCase & CloudArchiveSnapshot['cases'][number];

  return {
    name: normalizeOptional(value.name ?? value.caseName),
    universeType: normalizeOptional(value.universe_type ?? value.universeType),
    authorOrCreator: normalizeOptional(value.author_or_creator ?? value.authorOrCreator),
    description: normalizeOptional(value.description),
  };
}

function getDifferingFields(left: Record<string, string>, right: Record<string, string>) {
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).filter(
    (field) => left[field] !== right[field],
  );
}

function getPrimaryLocalCase(localArchive: LocalArchiveSnapshot) {
  const localCaseId = getPrimaryLocalCaseId(localArchive);

  return localArchive.cases.find((record) => record.id === localCaseId) ?? localArchive.cases[0] ?? null;
}

function getPrimaryCloudCase(onlineArchive: CloudArchiveSnapshot) {
  const cloudCaseId = getPrimaryCloudCaseId(onlineArchive);

  return onlineArchive.cases.find((record) => record.id === cloudCaseId) ?? onlineArchive.cases[0] ?? null;
}

function hasMatchingPrimaryCaseContent(
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
) {
  const localCase = getPrimaryLocalCase(localArchive);
  const cloudCase = getPrimaryCloudCase(onlineArchive);

  if (!localCase || !cloudCase || localCase.id !== cloudCase.id) {
    return false;
  }

  return fingerprint(normalizeCaseForRepairIdentity(localCase)) === fingerprint(normalizeCaseForRepairIdentity(cloudCase));
}

function getEmptyLocalCaseShellState(
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
  localSyncState: Awaited<ReturnType<typeof readLocalSyncState>>,
  userId: string,
) {
  const localCase = localArchive.cases[0] ?? null;
  const cloudCase = onlineArchive.cases[0] ?? null;
  const localIdentity = localCase ? normalizeCaseMeaningfulIdentity(localCase) : {};
  const cloudIdentity = cloudCase ? normalizeCaseMeaningfulIdentity(cloudCase) : {};
  const meaningfulDifferingFields = getDifferingFields(localIdentity, cloudIdentity);
  const localImageCount = countLocalImages(localArchive);
  const hasIndependentBaseline = Boolean(localSyncState?.synchronizedFingerprints);
  const qualifies = Boolean(
    localCase &&
      cloudCase &&
      localCase.id !== cloudCase.id &&
      localArchive.cases.length === 1 &&
      localArchive.dossiers.length === 0 &&
      localArchive.bonds.length === 0 &&
      localArchive.boardPins.length === 0 &&
      localImageCount === 0 &&
      meaningfulDifferingFields.length === 0 &&
      !hasIndependentBaseline &&
      cloudCase.user_id === userId,
  );

  return {
    qualifies,
    localCase,
    cloudCase,
    localIdentity,
    cloudIdentity,
    meaningfulDifferingFields,
    ignoredDifferingFields: localCase && cloudCase && localCase.id !== cloudCase.id ? ['id'] : [],
  };
}

function hasMissingCloudDependents(localArchive: LocalArchiveSnapshot, onlineArchive: CloudArchiveSnapshot) {
  const localDossierIds = new Set(localArchive.dossiers.map((record) => record.id));
  const localBondIds = new Set(localArchive.bonds.map((record) => record.id));
  const localBoardPinIds = new Set(localArchive.boardPins.map((record) => record.id));
  const localImageCount = countLocalImages(localArchive);
  const cloudImageCount = countCloudImages(onlineArchive);

  return (
    onlineArchive.dossiers.some((record) => !localDossierIds.has(record.id)) ||
    onlineArchive.bonds.some((record) => !localBondIds.has(record.id)) ||
    onlineArchive.boardEntries.some((record) => !localBoardPinIds.has(record.id)) ||
    cloudImageCount > localImageCount
  );
}

function createMatchingCaseSection(localArchive: LocalArchiveSnapshot, onlineArchive: CloudArchiveSnapshot) {
  const section = compareById(
    'cases',
    localArchive.cases,
    onlineArchive.cases,
    (record) => record.dateLastModified,
    (record) => record.updated_at,
    normalizeCaseForRepairIdentity,
    normalizeCaseForRepairIdentity,
    undefined,
    { invalidIds: 0, timestampParseFailures: 0, fingerprintMismatches: 0 },
  );

  section.newRecords = 0;
  section.updatedRecords = 0;
  section.cloudUpdatesAvailable = 0;
  section.localOnly = 0;
  section.onlineOnly = 0;
  section.localNewer = 0;
  section.onlineNewer = 0;
  section.conflictRecords = 0;
  section.conflicts = 0;
  section.itemsRequiringReview = 0;
  section.requiresReview = 0;
  section.existingRecords = localArchive.cases.length;
  section.unchangedRecords = localArchive.cases.length;
  section.matchingIds = localArchive.cases.length;

  return section;
}

function createShellRecoveryCaseSection() {
  return {
    ...emptyPlanSection,
    existingRecords: 1,
    unchangedRecords: 1,
  };
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

function mergePartialRepairArchive(
  localArchive: LocalArchiveSnapshot,
  retrievedArchive: Omit<LocalArchiveSnapshot, 'activeCaseId'>,
) {
  const casesById = new Map(retrievedArchive.cases.map((record) => [record.id, record]));
  const dossiersById = new Map(localArchive.dossiers.map((record) => [record.id, record]));
  const bondsById = new Map(localArchive.bonds.map((record) => [record.id, record]));
  const boardPinsById = new Map(localArchive.boardPins.map((record) => [record.id, record]));

  localArchive.cases.forEach((record) => {
    const retrievedCase = casesById.get(record.id);

    casesById.set(record.id, {
      ...record,
      coverImage: record.coverImage ?? retrievedCase?.coverImage,
    });
  });
  retrievedArchive.dossiers.forEach((record) => {
    if (!dossiersById.has(record.id)) {
      dossiersById.set(record.id, record);
    }
  });
  retrievedArchive.bonds.forEach((record) => {
    if (!bondsById.has(record.id)) {
      bondsById.set(record.id, record);
    }
  });
  retrievedArchive.boardPins.forEach((record) => {
    if (!boardPinsById.has(record.id)) {
      boardPinsById.set(record.id, record);
    }
  });

  return {
    cases: [...casesById.values()],
    dossiers: [...dossiersById.values()],
    bonds: [...bondsById.values()],
    boardPins: [...boardPinsById.values()],
    activeCaseId: localArchive.activeCaseId ?? localArchive.cases[0]?.id ?? retrievedArchive.cases[0]?.id ?? null,
  };
}

function notifyLocalArchiveRestored() {
  window.dispatchEvent(new CustomEvent('lorebound:local-archive-restored'));
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
  is_archived?: boolean;
}) {
  return {
    id: record.id,
    name: normalizeOptional(record.name ?? record.caseName),
    universeType: normalizeOptional(record.universe_type ?? record.universeType),
    authorOrCreator: normalizeOptional(record.author_or_creator ?? record.authorOrCreator),
    description: normalizeOptional(record.description),
    coverImageCloudPath: normalizeOptional(record.cover_image_cloud_path ?? record.coverImageCloudPath),
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
  const metadata = canonicalize({
    ...(record.metadata ?? {}),
    sections: normalizeDossierSectionsForSync(record.metadata?.sections),
  });

  return {
    id: record.id,
    caseId: normalizeOptional(record.case_id ?? record.caseId),
    dossierType: normalizeOptional(record.dossier_type ?? record.dossierType),
    name: normalizeOptional(record.name),
    coverImageCloudPath: normalizeOptional(record.cover_image_cloud_path ?? record.coverImageCloudPath),
    summary: normalizeOptional(record.summary),
    notes: normalizeOptional(record.notes),
    metadata,
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
  origin?: string;
  threadmark?: Record<string, unknown>;
}) {
  const evidence = {
    ...(record.evidence ?? {}),
    origin: record.origin,
    threadmark: record.threadmark,
  };

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
    evidence: canonicalize(evidence),
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

function createRecordActions<TLocal extends { id: string }, TOnline extends { id: string }>(
  entityType: SyncEntityType,
  localRecords: TLocal[],
  onlineRecords: TOnline[],
  getLocalUpdatedAt: (record: TLocal) => string,
  getOnlineUpdatedAt: (record: TOnline) => string,
  normalizeLocalForComparison: (record: TLocal) => unknown,
  normalizeOnlineForComparison: (record: TOnline) => unknown,
  baselineFingerprints: Record<string, string> | undefined,
  baselineStatus: SyncRecordAction['baselineStatus'],
): SyncRecordAction[] {
  const onlineById = new Map(onlineRecords.map((record) => [record.id, record]));
  const localIds = new Set(localRecords.map((record) => record.id));
  const actions: SyncRecordAction[] = [];

  localRecords.forEach((localRecord) => {
    if (!isValidStableId(localRecord.id)) {
      actions.push({
        entityType,
        id: 'invalid-record',
        action: 'requires-review',
        baselineStatus,
        safeReason: 'The Local Archive record has an invalid stable ID.',
      });
      return;
    }

    const onlineRecord = onlineById.get(localRecord.id);

    if (!onlineRecord) {
      actions.push({
        entityType,
        id: localRecord.id,
        action: 'upload-local-only',
        baselineStatus,
        safeReason: 'This record exists only in the Local Archive.',
      });
      return;
    }

    const localFingerprint = fingerprint(normalizeLocalForComparison(localRecord));
    const onlineFingerprint = fingerprint(normalizeOnlineForComparison(onlineRecord));
    const baselineFingerprint = baselineFingerprints?.[getFingerprintKey(entityType, localRecord.id)];

    if (localFingerprint === onlineFingerprint) {
      actions.push({
        entityType,
        id: localRecord.id,
        action: 'unchanged',
        baselineStatus,
        safeReason: 'Local Archive and LoreBound Online match for this record.',
      });
      return;
    }

    if (baselineFingerprint) {
      const localChanged = localFingerprint !== baselineFingerprint;
      const onlineChanged = onlineFingerprint !== baselineFingerprint;

      if (localChanged && !onlineChanged) {
        actions.push({
          entityType,
          id: localRecord.id,
          action: 'upload-local-newer',
          baselineStatus,
          safeReason: 'Only the Local Archive changed since the last verified baseline.',
        });
        return;
      }

      if (!localChanged && onlineChanged) {
        actions.push({
          entityType,
          id: localRecord.id,
          action: 'retrieve-cloud-newer',
          baselineStatus,
          safeReason: 'Only LoreBound Online changed since the last verified baseline.',
        });
        return;
      }

      actions.push({
        entityType,
        id: localRecord.id,
        action: 'conflict',
        baselineStatus,
        safeReason: 'Both archives changed this record since the last verified baseline.',
      });
      return;
    }

    const localTime = normalizeTimestamp(getLocalUpdatedAt(localRecord));
    const onlineTime = normalizeTimestamp(getOnlineUpdatedAt(onlineRecord));

    if (localTime !== null && onlineTime !== null && localTime > onlineTime) {
      actions.push({
        entityType,
        id: localRecord.id,
        action: 'upload-local-newer',
        baselineStatus,
        safeReason: 'Local Archive has the newer timestamp for this record.',
      });
      return;
    }

    if (localTime !== null && onlineTime !== null && onlineTime > localTime) {
      actions.push({
        entityType,
        id: localRecord.id,
        action: 'retrieve-cloud-newer',
        baselineStatus,
        safeReason: 'LoreBound Online has the newer timestamp for this record.',
      });
      return;
    }

    actions.push({
      entityType,
      id: localRecord.id,
      action: 'requires-review',
      baselineStatus,
      safeReason: 'The record differs without a usable baseline or timestamp ordering.',
    });
  });

  onlineRecords.forEach((onlineRecord) => {
    if (!isValidStableId(onlineRecord.id)) {
      actions.push({
        entityType,
        id: 'invalid-record',
        action: 'requires-review',
        baselineStatus,
        safeReason: 'The LoreBound Online record has an invalid stable ID.',
      });
      return;
    }

    if (!localIds.has(onlineRecord.id)) {
      actions.push({
        entityType,
        id: onlineRecord.id,
        action: 'retrieve-cloud-only',
        baselineStatus,
        safeReason: 'This record exists only in LoreBound Online.',
      });
    }
  });

  return actions;
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
          metadata: buildDossierMetadataForSync(record),
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

function createCloudFingerprintSnapshot(onlineArchive: CloudArchiveSnapshot) {
  return Object.fromEntries([
    ...onlineArchive.cases.map((record) => [
      getFingerprintKey('cases', record.id),
      fingerprint(normalizeCaseContent(record)),
    ]),
    ...onlineArchive.dossiers.map((record) => [
      getFingerprintKey('dossiers', record.id),
      fingerprint(normalizeDossierContent(record)),
    ]),
    ...onlineArchive.bonds.map((record) => [
      getFingerprintKey('bonds', record.id),
      fingerprint(normalizeBondContent(record)),
    ]),
    ...onlineArchive.boardEntries.map((record) => [
      getFingerprintKey('boardEntries', record.id),
      fingerprint(normalizeBoardEntryContent(record)),
    ]),
  ]);
}

function getSortedIds(records: { id: string }[]) {
  return records.map((record) => record.id).sort((left, right) => left.localeCompare(right));
}

function arraysMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fingerprintSnapshotsMatch(
  localFingerprints: Record<string, string>,
  cloudFingerprints: Record<string, string>,
) {
  const localKeys = Object.keys(localFingerprints).sort();
  const cloudKeys = Object.keys(cloudFingerprints).sort();

  return arraysMatch(localKeys, cloudKeys) && localKeys.every((key) => localFingerprints[key] === cloudFingerprints[key]);
}

function getCloudImagePaths(onlineArchive: CloudArchiveSnapshot) {
  return {
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
}

function createBaselineRecordIds(localArchive: LocalArchiveSnapshot) {
  return {
    cases: localArchive.cases.map((record) => record.id),
    dossiers: localArchive.dossiers.map((record) => record.id),
    bonds: localArchive.bonds.map((record) => record.id),
    boardPins: localArchive.boardPins.map((record) => record.id),
  };
}

function createBaselineUpdatedAt(localArchive: LocalArchiveSnapshot) {
  return Object.fromEntries([
    ...localArchive.cases.map((record) => [record.id, record.dateLastModified]),
    ...localArchive.dossiers.map((record) => [record.id, record.dateModified]),
    ...localArchive.bonds.map((record) => [record.id, record.dateModified]),
    ...localArchive.boardPins.map((record) => [record.id, record.datePinned]),
  ]);
}

function getBaselineState(
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
  localSyncState: Awaited<ReturnType<typeof readLocalSyncState>>,
  userId: string,
  localFingerprints: Record<string, string>,
  cloudFingerprints: Record<string, string>,
) {
  const localCaseIds = getSortedIds(localArchive.cases);
  const cloudCaseIds = getSortedIds(onlineArchive.cases);
  const localDossierIds = getSortedIds(localArchive.dossiers);
  const cloudDossierIds = getSortedIds(onlineArchive.dossiers);
  const localBondIds = getSortedIds(localArchive.bonds);
  const cloudBondIds = getSortedIds(onlineArchive.bonds);
  const localBoardPinIds = getSortedIds(localArchive.boardPins);
  const cloudBoardEntryIds = getSortedIds(onlineArchive.boardEntries);
  const idsMatch =
    arraysMatch(localCaseIds, cloudCaseIds) &&
    arraysMatch(localDossierIds, cloudDossierIds) &&
    arraysMatch(localBondIds, cloudBondIds) &&
    arraysMatch(localBoardPinIds, cloudBoardEntryIds);
  const countsMatch =
    localArchive.cases.length === onlineArchive.cases.length &&
    localArchive.dossiers.length === onlineArchive.dossiers.length &&
    localArchive.bonds.length === onlineArchive.bonds.length &&
    localArchive.boardPins.length === onlineArchive.boardEntries.length;
  const fingerprintsMatch = fingerprintSnapshotsMatch(localFingerprints, cloudFingerprints);
  const cloudOwnedByUser = onlineArchive.cases.every((record) => record.user_id === userId) &&
    onlineArchive.dossiers.every((record) => record.user_id === userId) &&
    onlineArchive.bonds.every((record) => record.user_id === userId) &&
    onlineArchive.boardEntries.every((record) => record.user_id === userId);

  if (!localSyncState) {
    return {
      status: 'Missing' as const,
      reason: 'This browser has no synchronization baseline.',
      canRebuild: cloudOwnedByUser && countsMatch && idsMatch && fingerprintsMatch,
    };
  }

  if (localSyncState.investigatorId !== userId) {
    return {
      status: 'Foreign Investigator' as const,
      reason: 'This baseline belongs to a different Investigator Profile.',
      canRebuild: false,
    };
  }

  if (localSyncState.synchronizationVersion !== 1) {
    return {
      status: 'Incompatible Version' as const,
      reason: 'This baseline uses an unsupported synchronization version.',
      canRebuild: false,
    };
  }

  if (!localSyncState.synchronizedFingerprints) {
    return {
      status: 'Stale' as const,
      reason: 'This baseline does not contain record fingerprints.',
      canRebuild: cloudOwnedByUser && countsMatch && idsMatch && fingerprintsMatch,
    };
  }

  const baselineCaseIds = [...(localSyncState.synchronizedRecordIds?.cases ?? [])].sort((left, right) => left.localeCompare(right));

  if (!arraysMatch(baselineCaseIds, localCaseIds)) {
    return {
      status: 'References Replaced Case' as const,
      reason: 'This baseline references a different Investigation than the active Local Archive.',
      canRebuild: cloudOwnedByUser && countsMatch && idsMatch && fingerprintsMatch,
    };
  }

  if (!fingerprintSnapshotsMatch(localSyncState.synchronizedFingerprints, localFingerprints)) {
    return {
      status: 'Stale' as const,
      reason: 'This baseline no longer matches the Local Archive fingerprints.',
      canRebuild: cloudOwnedByUser && countsMatch && idsMatch && fingerprintsMatch,
    };
  }

  if (!countsMatch || !idsMatch || !fingerprintsMatch) {
    return {
      status: 'Corrupt' as const,
      reason: 'This baseline cannot be verified against LoreBound Online.',
      canRebuild: false,
    };
  }

  return {
    status: 'Valid' as const,
    reason: 'This browser baseline matches LoreBound Online.',
    canRebuild: false,
  };
}

function getSectionIds(sections: unknown) {
  return (normalizeDossierSectionsForSync(sections) ?? []).map((section) => section.id);
}

function getSectionCount(sections: unknown) {
  return normalizeDossierSectionsForSync(sections)?.length ?? 0;
}

function getBaselineSectionCount(baselineFingerprint?: string) {
  if (!baselineFingerprint) {
    return 0;
  }

  try {
    const parsedValue = JSON.parse(baselineFingerprint) as {
      metadata?: { sections?: unknown };
    };

    return getSectionCount(parsedValue.metadata?.sections);
  } catch {
    return 0;
  }
}

function summarizeFingerprint(value: string | null) {
  return value ? `Present (${value.length} characters)` : null;
}

function createSectionDiagnostics(
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
  baselineFingerprints: Record<string, string> | undefined,
  recordActions: SyncRecordAction[],
) {
  const localDossier = [...localArchive.dossiers].sort(
    (left, right) => new Date(right.dateModified).getTime() - new Date(left.dateModified).getTime(),
  )[0] ?? null;
  const cloudDossier = localDossier
    ? onlineArchive.dossiers.find((record) => record.id === localDossier.id) ?? null
    : onlineArchive.dossiers[0] ?? null;
  const dossierId = localDossier?.id ?? cloudDossier?.id ?? null;
  const localFingerprint = localDossier
    ? fingerprint(
        normalizeDossierContent({
          ...localDossier,
          coverImageCloudPath: cloudDossier?.cover_image_cloud_path ?? null,
          metadata: buildDossierMetadataForSync(localDossier),
        }),
      )
    : null;
  const cloudFingerprint = cloudDossier ? fingerprint(normalizeDossierContent(cloudDossier)) : null;
  const baselineFingerprint = dossierId
    ? baselineFingerprints?.[getFingerprintKey('dossiers', dossierId)] ?? null
    : null;
  const dossierAction = dossierId
    ? recordActions.find((action) => action.entityType === 'dossiers' && action.id === dossierId)
    : undefined;
  const cloudSections = cloudDossier?.metadata?.sections;
  const localSections = localDossier?.sections;

  return {
    localSectionCount: getSectionCount(localSections),
    cloudSectionCount: getSectionCount(cloudSections),
    lastSyncedSectionCount: getBaselineSectionCount(baselineFingerprint ?? undefined),
    localSectionIds: getSectionIds(localSections),
    cloudSectionIds: getSectionIds(cloudSections),
    sectionsIncludedInFingerprint: true,
    localDossierFingerprint: summarizeFingerprint(localFingerprint),
    cloudDossierFingerprint: summarizeFingerprint(cloudFingerprint),
    baselineDossierFingerprint: summarizeFingerprint(baselineFingerprint),
    dossierClassification: dossierAction?.action ?? 'unchanged',
    sectionSerializationSucceeded: localDossier
      ? Array.isArray(buildDossierMetadataForSync(localDossier).sections)
      : false,
    cloudSectionVerificationSucceeded:
      !localDossier ||
      !cloudDossier ||
      localFingerprint === cloudFingerprint ||
      getSectionCount(cloudSections) > 0,
    retrievalAppliedCloudSections: Boolean(cloudDossier && getSectionCount(cloudSections) > 0),
    receivingIndexedDbSectionCount: getSectionCount(localSections),
  };
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
    const sameInvestigationIdLocalAndCloud = hasSamePrimaryInvestigation(localArchive, onlineArchive);
    const localCaseStableId = getPrimaryLocalCaseId(localArchive);
    const cloudCaseStableId = getPrimaryCloudCaseId(onlineArchive);
    const caseNormalizedMatch = hasMatchingPrimaryCaseContent(localArchive, onlineArchive);
    const emptyShellState = getEmptyLocalCaseShellState(localArchive, onlineArchive, localSyncState, user.id);
    const cloudImageCount = countCloudImages(onlineArchive);
    const plannedImagePaths = getPlannedImagePaths(localArchive, user.id);
    const cloudImagePaths = getCloudImagePaths(onlineArchive);
    const localBaselineFingerprints = createLocalFingerprintSnapshot(localArchive, cloudImagePaths);
    const cloudBaselineFingerprints = createCloudFingerprintSnapshot(onlineArchive);
    const baselineState = getBaselineState(
      localArchive,
      onlineArchive,
      localSyncState,
      user.id,
      localBaselineFingerprints,
      cloudBaselineFingerprints,
    );
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
      archiveState: {
        ...plan.diagnostics.archiveState,
        activeInvestigationIdPresent: Boolean(localArchive.activeCaseId),
        sameInvestigationIdLocalAndCloud,
        localCaseStableId,
        cloudCaseStableId,
        caseNormalizedMatch: caseNormalizedMatch || emptyShellState.qualifies,
        emptyLocalCaseShell: emptyShellState.qualifies,
        localCaseNormalizedIdentity: emptyShellState.localIdentity,
        cloudCaseNormalizedIdentity: emptyShellState.cloudIdentity,
        caseMeaningfulDifferingFields: emptyShellState.meaningfulDifferingFields,
        caseIgnoredDifferingFields: emptyShellState.ignoredDifferingFields,
        localImageReferences: localImageCount,
        cloudImageReferences: cloudImageCount,
      },
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        baselineMetadataPresent: Boolean(localSyncState?.synchronizedFingerprints),
        baselineStatus: baselineState.status,
        baselineReason: baselineState.reason,
        canRebuildBaseline: baselineState.canRebuild,
      },
    };
    const comparedSections = {
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
            metadata: buildDossierMetadataForSync(record),
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
    plan.sections =
      sameInvestigationIdLocalAndCloud && caseNormalizedMatch
        ? {
            ...comparedSections,
            cases: createMatchingCaseSection(localArchive, onlineArchive),
          }
        : emptyShellState.qualifies
          ? {
              ...comparedSections,
              cases: createShellRecoveryCaseSection(),
            }
        : comparedSections;
    const recordActions = [
      ...createRecordActions(
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
        baselineState.status,
      ),
      ...createRecordActions(
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
            metadata: buildDossierMetadataForSync(record),
          }),
        normalizeDossierContent,
        localSyncState?.synchronizedFingerprints,
        baselineState.status,
      ),
      ...createRecordActions(
        'bonds',
        localArchive.bonds,
        onlineArchive.bonds,
        (record) => record.dateModified,
        (record) => record.updated_at,
        normalizeBondContent,
        normalizeBondContent,
        localSyncState?.synchronizedFingerprints,
        baselineState.status,
      ),
      ...createRecordActions(
        'boardEntries',
        localArchive.boardPins,
        onlineArchive.boardEntries,
        (record) => record.datePinned,
        (record) => record.updated_at,
        normalizeBoardEntryContent,
        normalizeBoardEntryContent,
        localSyncState?.synchronizedFingerprints,
        baselineState.status,
      ),
    ];
    const uploadActions = recordActions.filter(
      (action) => action.action === 'upload-local-only' || action.action === 'upload-local-newer',
    );
    const retrievalActions = recordActions.filter(
      (action) => action.action === 'retrieve-cloud-only' || action.action === 'retrieve-cloud-newer',
    );
    const conflictActions = recordActions.filter(
      (action) => action.action === 'conflict' || action.action === 'requires-review',
    );
    const selectedSynchronizationMode =
      conflictActions.length > 0
        ? 'review-required'
        : uploadActions.length > 0 && retrievalActions.length > 0
          ? 'bidirectional'
          : uploadActions.length > 0
            ? 'upload-only'
            : retrievalActions.length > 0
              ? 'retrieve-only'
              : 'none';
    const sectionDiagnostics = createSectionDiagnostics(
      localArchive,
      onlineArchive,
      localSyncState?.synchronizedFingerprints,
      recordActions,
    );
    plan.diagnostics = {
      ...plan.diagnostics,
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        recordActions,
        selectedSynchronizationMode,
        uploadActionsCount: uploadActions.length,
        retrievalActionsCount: retrievalActions.length,
        conflictActionsCount: conflictActions.length,
        outboundGateReason: 'Not reviewed.',
        sectionDiagnostics,
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
    const hasSafeCloudOnlyChanges =
      Object.values(plan.sections).some(
        (section) => section.onlineOnly > 0 || section.onlineNewer > 0,
      ) && !hasLocalChanges;
    const hasConflicts = Object.values(plan.sections).some(
      (section) => section.conflictRecords > 0 || section.itemsRequiringReview > 0,
    );
    const caseRecordIsSafeForRepair =
      plan.sections.cases.conflictRecords === 0 &&
      plan.sections.cases.itemsRequiringReview === 0 &&
      plan.sections.cases.localNewer === 0 &&
      plan.sections.cases.onlineNewer === 0 &&
      plan.sections.cases.cloudUpdatesAvailable === 0 &&
      plan.sections.cases.updatedRecords === 0;
    const isPartialLocalArchive =
      !isLocalArchiveEmpty &&
      !isOnlineArchiveEmpty &&
      ((sameInvestigationIdLocalAndCloud && caseNormalizedMatch) || emptyShellState.qualifies) &&
      hasMissingCloudDependents(localArchive, onlineArchive) &&
      caseRecordIsSafeForRepair &&
      !hasConflicts &&
      dependencyReasons.length === 0;
    const archiveClassification = (() => {
      if (dependencyReasons.length > 0 || reconciliationStats.invalidIds > 0) {
        return 'Corrupt or Invalid' as const;
      }

      if (isLocalArchiveEmpty && isOnlineArchiveEmpty) {
        return 'Empty' as const;
      }

      if (isLocalArchiveEmpty && !isOnlineArchiveEmpty) {
        return 'Cloud Only' as const;
      }

      if (hasConflicts) {
        return 'Conflict' as const;
      }

      if (isPartialLocalArchive) {
        return 'Partial Local Archive' as const;
      }

      if (hasLocalChanges) {
        return 'Local Changes' as const;
      }

      if (hasCloudUpdates) {
        return 'Cloud Updates Available' as const;
      }

      if (!isLocalArchiveEmpty && !isOnlineArchiveEmpty) {
        return 'Matching' as const;
      }

      return 'Complete Local Archive' as const;
    })();

    plan.blockingReasons = [
      ...dependencyReasons,
      ...(!imageReadiness.bucketReachable
        ? ['LoreBound Online image storage is not available for this Investigator Profile.']
        : []),
      ...(imagePreparation.failures.length > 0
        ? ['One or more stored images must be reviewed before synchronization.']
        : []),
      ...(baselineState.canRebuild
        ? ['This browser’s synchronization baseline is outdated.']
        : []),
      ...(hasBlockingReview
        ? ['Archive Reconciliation Required. Review conflicts before synchronization.']
        : []),
      ...(hasCloudUpdates && !isPartialLocalArchive && selectedSynchronizationMode !== 'bidirectional'
        ? ['LoreBound Online Updates Available. Review retrieval before updating this archive.']
        : []),
      ...(isPartialLocalArchive
        ? ['Local Archive Repair Required. LoreBound Online contains additional records for this Investigation.']
        : []),
    ];
    plan.canSynchronize =
      uploadActions.length > 0 &&
      sameInvestigationIdLocalAndCloud &&
      !baselineState.canRebuild &&
      !isPartialLocalArchive &&
      conflictActions.length === 0 &&
      plan.blockingReasons.length === 0 &&
      plan.online.isAvailable;
    plan.canRetrieve =
      ((isLocalArchiveEmpty && !isOnlineArchiveEmpty) ||
        isPartialLocalArchive ||
        hasSafeCloudOnlyChanges) &&
      dependencyReasons.length === 0 &&
      !hasBlockingReview &&
      plan.online.isAvailable;
    plan.diagnostics = {
      ...plan.diagnostics,
      archiveState: {
        ...plan.diagnostics.archiveState,
        classification: archiveClassification,
        retrievalEligibility: plan.canRetrieve ? 'Available' : 'Blocked',
        retrievalBlockReason: plan.canRetrieve
          ? isPartialLocalArchive
            ? 'Repair Local Archive is available.'
            : 'Retrieve Investigation is available.'
          : plan.blockingReasons[0] ?? 'Retrieve Investigation is not available.',
        repairEligibility: isPartialLocalArchive && plan.canRetrieve ? 'Available' : 'Blocked',
        repairStage: isPartialLocalArchive ? 'Awaiting repair retrieval.' : 'Not required.',
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : 'Unknown',
      },
    };
    const selectedArchiveAction = getSyncPlanArchiveAction(plan);
    assertRunnableArchiveActionHasHandler(selectedArchiveAction);

    if (
      plan.diagnostics.archiveState.classification === 'Partial Local Archive' &&
      (selectedArchiveAction.kind !== 'repair-local-archive' ||
        selectedArchiveAction.label !== 'Repair Local Archive' ||
        !selectedArchiveAction.canRun)
    ) {
      throw new Error('Partial Local Archive must produce an enabled Repair Local Archive action.');
    }
    const retrievalBlockReason =
      plan.canRetrieve
        ? isPartialLocalArchive
          ? 'Repair Local Archive is available.'
          : 'Retrieve Investigation is available.'
        : plan.blockingReasons[0] ?? 'Retrieve Investigation is not available.';
    const actionEnabled = selectedArchiveAction.canRun;
    const disabledReason =
      actionEnabled
        ? 'Enabled.'
        : selectedArchiveAction.kind === 'retrieve' || selectedArchiveAction.kind === 'repair-local-archive'
          ? retrievalBlockReason
          : plan.blockingReasons[0] ?? selectedArchiveAction.reason;
    plan.diagnostics = {
      ...plan.diagnostics,
      archiveState: {
        ...plan.diagnostics.archiveState,
        retrievalEligibility: plan.canRetrieve ? 'Available' : 'Blocked',
        retrievalBlockReason,
        actionEnabled,
        disabledReason,
        handlerPresent: archiveActionHasHandler(selectedArchiveAction),
        repairEligibility: isPartialLocalArchive && plan.canRetrieve ? 'Available' : 'Blocked',
        repairStage: isPartialLocalArchive ? 'Awaiting repair retrieval.' : 'Not required.',
        selectedAction: selectedArchiveAction.label,
        selectedActionReason: selectedArchiveAction.reason,
      },
      reconciliation: {
        ...plan.diagnostics.reconciliation,
        automaticGateReason:
          plan.blockingReasons[0] ??
          (baselineState.canRebuild
            ? 'Synchronization baseline rebuild waiting.'
            : uploadActions.length > 0
              ? 'Local changes waiting.'
              : 'Archive up to date.'),
        outboundGateReason:
          plan.canSynchronize
            ? 'Outbound synchronization available.'
            : plan.blockingReasons[0] ??
              (uploadActions.length === 0
                ? 'No outbound Local Archive changes detected.'
                : 'Outbound synchronization is blocked by archive safety checks.'),
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
    const uploadActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && (action.action === 'upload-local-only' || action.action === 'upload-local-newer'))
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && (action.action === 'upload-local-only' || action.action === 'upload-local-newer'))
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && (action.action === 'upload-local-only' || action.action === 'upload-local-newer'))
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && (action.action === 'upload-local-only' || action.action === 'upload-local-newer'))
          .map((action) => action.id),
      ),
    };
    const retrievalActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && (action.action === 'retrieve-cloud-only' || action.action === 'retrieve-cloud-newer'))
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && (action.action === 'retrieve-cloud-only' || action.action === 'retrieve-cloud-newer'))
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && (action.action === 'retrieve-cloud-only' || action.action === 'retrieve-cloud-newer'))
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && (action.action === 'retrieve-cloud-only' || action.action === 'retrieve-cloud-newer'))
          .map((action) => action.id),
      ),
    };
    const uploadArchive: LocalArchiveSnapshot = {
      cases: localArchive.cases.filter((record) => uploadActionIds.cases.has(record.id)),
      dossiers: localArchive.dossiers.filter((record) => uploadActionIds.dossiers.has(record.id)),
      bonds: localArchive.bonds.filter((record) => uploadActionIds.bonds.has(record.id)),
      boardPins: localArchive.boardPins.filter((record) => uploadActionIds.boardPins.has(record.id)),
      activeCaseId: localArchive.activeCaseId,
    };
    const totalRecords =
      uploadArchive.cases.length +
      uploadArchive.dossiers.length +
      uploadArchive.bonds.length +
      uploadArchive.boardPins.length +
      retrievalActionIds.cases.size +
      retrievalActionIds.dossiers.size +
      retrievalActionIds.bonds.size +
      retrievalActionIds.boardPins.size;
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
      const imagePreparation = await prepareCloudImages(uploadArchive, user.id);

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
      const imagePaths = getPlannedImagePaths(uploadArchive, user.id);
      const caseRows = uploadArchive.cases.map((record) =>
        mapCaseToCloudRow(record, user.id, imagePaths.cases[record.id]),
      );
      const dossierRows = uploadArchive.dossiers.map((record) =>
        mapDossierToCloudRow(record, user.id, imagePaths.dossiers[record.id]),
      );
      const bondRows = uploadArchive.bonds.map((record) => mapBondToCloudRow(record, user.id));
      const boardEntryRows = uploadArchive.boardPins.map((record) => mapBoardPinToCloudRow(record, user.id));

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

      this.verifyOnlineArchive(uploadArchive, onlineArchive, user.id);
      completeStage('Verifying Investigation');
      let synchronizedArchive = localArchive;

      if (
        retrievalActionIds.cases.size > 0 ||
        retrievalActionIds.dossiers.size > 0 ||
        retrievalActionIds.bonds.size > 0 ||
        retrievalActionIds.boardPins.size > 0
      ) {
        report('Retrieving Investigations', 'Retrieving safe LoreBound Online updates.');
        const retrievedCases = await restoreCaseImages(
          onlineArchive.cases
            .filter((record) => retrievalActionIds.cases.has(record.id))
            .map(mapCloudCaseToLocal),
          onlineArchive.cases,
        );
        completeStage('Retrieving Investigations');
        report('Retrieving Dossiers', 'Retrieving safe Dossier updates.');
        const retrievedDossiers = await restoreDossierImages(
          onlineArchive.dossiers
            .filter((record) => retrievalActionIds.dossiers.has(record.id))
            .map(mapCloudDossierToLocal),
          onlineArchive.dossiers,
        );
        completeStage('Retrieving Dossiers');
        report('Retrieving Bonds', 'Retrieving safe Bond updates.');
        const retrievedBonds = onlineArchive.bonds
          .filter((record) => retrievalActionIds.bonds.has(record.id))
          .map(mapCloudBondToLocal);
        completeStage('Retrieving Bonds');
        report('Retrieving Evidence Pins', 'Retrieving safe Evidence Board updates.');
        const retrievedBoardPins = onlineArchive.boardEntries
          .filter((record) => retrievalActionIds.boardPins.has(record.id))
          .map(mapCloudBoardEntryToLocal);
        completeStage('Retrieving Evidence Pins');
        const casesById = new Map(localArchive.cases.map((record) => [record.id, record]));
        const dossiersById = new Map(localArchive.dossiers.map((record) => [record.id, record]));
        const bondsById = new Map(localArchive.bonds.map((record) => [record.id, record]));
        const boardPinsById = new Map(localArchive.boardPins.map((record) => [record.id, record]));

        retrievedCases.forEach((record) => casesById.set(record.id, record));
        retrievedDossiers.forEach((record) => dossiersById.set(record.id, record));
        retrievedBonds.forEach((record) => bondsById.set(record.id, record));
        retrievedBoardPins.forEach((record) => boardPinsById.set(record.id, record));
        synchronizedArchive = {
          cases: [...casesById.values()],
          dossiers: [...dossiersById.values()],
          bonds: [...bondsById.values()],
          boardPins: [...boardPinsById.values()],
          activeCaseId: localArchive.activeCaseId,
        };
        await importFullLocalArchive(synchronizedArchive);
        completedRecords +=
          retrievedCases.length +
          retrievedDossiers.length +
          retrievedBonds.length +
          retrievedBoardPins.length;
        notifyLocalArchiveRestored();
      }

      this.verifyOnlineArchive(synchronizedArchive, onlineArchive, user.id);
      report('Verifying Stored Images', 'Verifying secured stored images.');
      await verifyPreparedImages(imagePreparation.preparedImages);
      completeStage('Verifying Stored Images');
      report('Finalizing Investigation', 'Recording the local synchronization marker.');
      const cloudImagePaths = getCloudImagePaths(onlineArchive);
      await recordLocalSyncState({
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: createBaselineRecordIds(synchronizedArchive),
        synchronizedUpdatedAt: createBaselineUpdatedAt(synchronizedArchive),
        synchronizedFingerprints: createLocalFingerprintSnapshot(synchronizedArchive, cloudImagePaths),
        cloudImagePaths,
        synchronizationVersion: 1,
      });
      completeStage('Finalizing Investigation');

      return {
        ok: true,
        message: 'Investigation Secured',
        counts: {
          cases: synchronizedArchive.cases.length,
          dossiers: synchronizedArchive.dossiers.length,
          bonds: synchronizedArchive.bonds.length,
          boardEntries: synchronizedArchive.boardPins.length,
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

  async rebuildBaseline(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
    const user = await authService.getCurrentUser();

    if (!user) {
      return {
        ok: false,
        message: 'Investigator Connect is required before rebuilding the synchronization baseline.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        completedStages: [],
        itemsRequiringReview: 0,
      };
    }

    let activeStage: SyncStage = 'Preparing Archive';
    const completedStages: SyncStage[] = [];
    const completeStage = (stage: SyncStage) => {
      if (!completedStages.includes(stage)) {
        completedStages.push(stage);
      }
    };
    const report = (stage: SyncStage, detail: string) => {
      activeStage = stage;
      emit(onProgress, stage, detail);
    };

    try {
      report('Preparing Archive', 'Reviewing Local Archive records.');
      const planResult = await this.createPlan();

      if (!planResult.ok || !planResult.plan.diagnostics.reconciliation.canRebuildBaseline) {
        return {
          ok: false,
          message:
            planResult.plan.blockingReasons[0] ??
            planResult.plan.diagnostics.reconciliation.baselineReason ??
            'Synchronization baseline rebuild is not available.',
          counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
          failedStage: activeStage,
          completedStages,
          itemsRequiringReview: Object.values(planResult.plan.sections).reduce(
            (total, section) => total + section.itemsRequiringReview,
            0,
          ),
        };
      }

      completeStage('Preparing Archive');
      report('Verifying Investigation', 'Verifying Local Archive against LoreBound Online.');
      const localArchive = await readFullLocalArchive();
      const onlineArchive = await cloudArchiveRepository.readArchive();
      const cloudImagePaths = getCloudImagePaths(onlineArchive);
      const localFingerprints = createLocalFingerprintSnapshot(localArchive, cloudImagePaths);
      const cloudFingerprints = createCloudFingerprintSnapshot(onlineArchive);
      const baselineState = getBaselineState(
        localArchive,
        onlineArchive,
        await readLocalSyncState(),
        user.id,
        localFingerprints,
        cloudFingerprints,
      );

      if (!baselineState.canRebuild) {
        throw new Error(baselineState.reason);
      }

      validateDependencies(localArchive).forEach((reason) => {
        throw new Error(reason);
      });
      completeStage('Verifying Investigation');
      report('Finalizing Investigation', 'Recording the verified synchronization baseline.');
      await recordLocalSyncState({
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: createBaselineRecordIds(localArchive),
        synchronizedUpdatedAt: createBaselineUpdatedAt(localArchive),
        synchronizedFingerprints: localFingerprints,
        cloudImagePaths,
        synchronizationVersion: 1,
      });
      completeStage('Finalizing Investigation');

      return {
        ok: true,
        message: 'Synchronization Baseline Rebuilt',
        counts: {
          cases: localArchive.cases.length,
          dossiers: localArchive.dossiers.length,
          bonds: localArchive.bonds.length,
          boardEntries: localArchive.boardPins.length,
          images: countLocalImages(localArchive),
        },
        completedStages,
        itemsRequiringReview: 0,
        transferSize: 0,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to rebuild this synchronization baseline. No records were changed.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        failedStage: activeStage,
        completedStages,
        itemsRequiringReview: 0,
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

    const user = await authService.getCurrentUser();
    const isRepair = planResult.plan.diagnostics.archiveState.classification === 'Partial Local Archive';
    const isEmptyShellRepair = planResult.plan.diagnostics.archiveState.emptyLocalCaseShell;
    let activeStage: SyncStage = 'Retrieving Investigations';
    const completedStages: SyncStage[] = [];
    const completeStage = (stage: SyncStage) => {
      if (!completedStages.includes(stage)) {
        completedStages.push(stage);
      }
    };
    const report = (stage: SyncStage, detail: string) => {
      activeStage = stage;
      emit(onProgress, stage, detail);
    };

    try {
      const localArchive = await readFullLocalArchive();
      const onlineArchive = await cloudArchiveRepository.readArchive();

      if (isRepair) {
        const localCaseId = getPrimaryLocalCaseId(localArchive);
        const cloudCaseId = getPrimaryCloudCaseId(onlineArchive);

        if (!user || !cloudCaseId || (!isEmptyShellRepair && localCaseId !== cloudCaseId)) {
          throw new Error('Repair Local Archive could not verify matching Investigation ownership.');
        }

        if (isEmptyShellRepair && onlineArchive.cases[0]?.user_id !== user.id) {
          throw new Error('Repair Local Archive could not verify Investigation ownership.');
        }
      }

      report('Retrieving Investigations', `${onlineArchive.cases.length} Investigation records.`);
      const casesWithoutImages = onlineArchive.cases.map(mapCloudCaseToLocal);
      completeStage('Retrieving Investigations');
      report('Retrieving Dossiers', `${onlineArchive.dossiers.length} Dossier records.`);
      const dossiersWithoutImages = onlineArchive.dossiers.map(mapCloudDossierToLocal);
      completeStage('Retrieving Dossiers');
      report('Retrieving Stored Images', 'Retrieving stored images from LoreBound Online.');
      const [cases, dossiers] = await Promise.all([
        restoreCaseImages(casesWithoutImages, onlineArchive.cases),
        restoreDossierImages(dossiersWithoutImages, onlineArchive.dossiers),
      ]);
      completeStage('Retrieving Stored Images');
      report('Retrieving Bonds', `${onlineArchive.bonds.length} Bond records.`);
      const bonds = onlineArchive.bonds.map(mapCloudBondToLocal);
      completeStage('Retrieving Bonds');
      report('Retrieving Evidence Pins', `${onlineArchive.boardEntries.length} Evidence Pin records.`);
      const boardPins = onlineArchive.boardEntries.map(mapCloudBoardEntryToLocal);
      completeStage('Retrieving Evidence Pins');
      const repairedArchive =
        isRepair && !isEmptyShellRepair
          ? mergePartialRepairArchive(localArchive, { cases, dossiers, bonds, boardPins })
          : { cases, dossiers, bonds, boardPins, activeCaseId: cases[0]?.id ?? null };

      if (isEmptyShellRepair) {
        const shellCaseId = localArchive.cases[0]?.id;

        if (!shellCaseId) {
          throw new Error('Repair Local Archive could not find the empty local Investigation shell.');
        }

        await replaceEmptyCaseShellWithCloudArchive(shellCaseId, repairedArchive);
      } else {
        await importFullLocalArchive(repairedArchive);
      }
      report('Verifying Local Archive', isRepair ? 'Verifying repaired Local Archive records.' : 'Verifying retrieved records.');
      const verifiedLocalArchive = await readFullLocalArchive();

      if (
        verifiedLocalArchive.cases.length < repairedArchive.cases.length ||
        verifiedLocalArchive.dossiers.length < repairedArchive.dossiers.length ||
        verifiedLocalArchive.bonds.length < repairedArchive.bonds.length ||
        verifiedLocalArchive.boardPins.length < repairedArchive.boardPins.length
      ) {
        throw new Error(isRepair ? 'Repair Local Archive could not be verified.' : 'Retrieve Investigation could not be verified.');
      }

      validateDependencies(verifiedLocalArchive).forEach((reason) => {
        throw new Error(reason);
      });
      completeStage('Verifying Local Archive');
      report('Finalizing Investigation', 'Recording local synchronization marker.');
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
            cases: repairedArchive.cases.map((record) => record.id),
            dossiers: repairedArchive.dossiers.map((record) => record.id),
            bonds: repairedArchive.bonds.map((record) => record.id),
            boardPins: repairedArchive.boardPins.map((record) => record.id),
          },
          synchronizedUpdatedAt: Object.fromEntries([
            ...repairedArchive.cases.map((record) => [record.id, record.dateLastModified]),
            ...repairedArchive.dossiers.map((record) => [record.id, record.dateModified]),
            ...repairedArchive.bonds.map((record) => [record.id, record.dateModified]),
            ...repairedArchive.boardPins.map((record) => [record.id, record.datePinned]),
          ]),
          synchronizedFingerprints: createLocalFingerprintSnapshot(
            repairedArchive,
            cloudImagePaths,
          ),
          cloudImagePaths,
          synchronizationVersion: 1,
        });
      }
      completeStage('Finalizing Investigation');
      notifyLocalArchiveRestored();

      return {
        ok: true,
        message: isRepair ? 'Local Archive Repaired' : 'Investigation Retrieved',
        counts: {
          cases: repairedArchive.cases.length,
          dossiers: repairedArchive.dossiers.length,
          bonds: repairedArchive.bonds.length,
          boardEntries: repairedArchive.boardPins.length,
        },
        failedStage: undefined,
        completedStages,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to retrieve this Investigation. Your Local Archive remains available.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        failedStage: activeStage,
        completedStages,
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

      const localFingerprint = fingerprint(
        normalizeDossierContent({
          ...record,
          coverImageCloudPath: onlineRecord.cover_image_cloud_path,
          metadata: buildDossierMetadataForSync(record),
        }),
      );
      const cloudFingerprint = fingerprint(normalizeDossierContent(onlineRecord));

      if (localFingerprint !== cloudFingerprint) {
        throw new Error('Unable to verify synchronized Dossier sections.');
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
