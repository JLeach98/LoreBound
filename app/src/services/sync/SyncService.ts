import {
  DELETION_SYNC_VERSION,
  createDeletionBaselineEntries,
  importFullLocalArchive,
  localArchiveStorageInfo,
  markDeletionTombstoneFailed,
  markDeletionTombstonesVerified,
  readFullLocalArchive,
  readLocalSyncState,
  readOrCreateLocalClientId,
  recordLocalSyncState,
  replaceEmptyCaseShellWithCloudArchive,
} from '../../features/cases/storage/caseStorage';
import type { DeletionEntityType, DeletionTombstone, LocalSyncState } from '../../features/cases/storage/caseStorage';
import { recordThreadmarkSynchronizationDiagnostics } from '../../features/threadmarks';
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
  mapCloudDeletionLedgerToLocalTombstone,
  mapDeletionTombstoneToCloudLedgerRow,
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
  discoverCloudCases: () => Promise<LoreCase[]>;
  retrieveCase: (caseId: string, onProgress?: (progress: SyncProgress) => void) => Promise<SyncResult>;
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

function notifySynchronizationCompleted(result: SyncResult) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('lorebound:synchronization-completed', {
      detail: {
        ok: result.ok,
        completedAt: result.completedAt ?? new Date().toISOString(),
        counts: result.counts,
      },
    }),
  );
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
        deletionLedger: failedQuery,
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
        deletionDiagnostics: {
          deletionModelVersion: DELETION_SYNC_VERSION,
          localTombstoneCount: 0,
          pendingDeletionCount: 0,
          verifiedDeletionCount: 0,
          failedDeletionCount: 0,
          orphanedTombstoneCount: 0,
          cloudDeleteAttemptedCount: 0,
          cloudDeleteVerifiedCount: 0,
          remoteDeleteAppliedCount: 0,
          staleResurrectionPreventedCount: 0,
          repairRestorationBlockedByTombstoneCount: 0,
          generatedBondPairDeletionsPending: 0,
          lastFailedEntityType: null,
          lastFailedEntityId: null,
          lastFailedDeletionStage: null,
          deletionBaselineCount: 0,
          cloudLedgerAvailable: false,
          cloudLedgerRowCount: 0,
          ledgerUpsertAttempted: 0,
          ledgerUpsertSucceeded: 0,
          ledgerVerificationSucceeded: 0,
          ledgerReadFailureCount: 0,
          acknowledgedRowCount: 0,
          compactedRowCount: 0,
          sharedDeletionAuthorityCount: 0,
          localTombstoneOnlyCount: 0,
          cloudLedgerOnlyCount: 0,
          combinedAuthorityCount: 0,
          liveLocalRecordsSuppressed: 0,
          liveCloudRecordsSuppressed: 0,
          staleUploadsBlocked: 0,
          staleImportsBlocked: 0,
          repairRestorationsBlocked: 0,
          contradictoryDeletionRetrievalPlanCount: 0,
          cloudDeleteVerificationFailureCount: 0,
          liveDeletedBaselineCollisionCount: 0,
        },
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

function sortCasesByCloudUpdatedAt(cases: LoreCase[]) {
  return [...cases].sort(
    (left, right) =>
      new Date(right.dateLastModified).getTime() - new Date(left.dateLastModified).getTime(),
  );
}

function scopeLocalArchiveToCase(localArchive: LocalArchiveSnapshot, caseId: string | null): LocalArchiveSnapshot {
  if (!caseId) {
    return localArchive;
  }

  return {
    cases: localArchive.cases.filter((record) => record.id === caseId),
    dossiers: localArchive.dossiers.filter((record) => record.caseId === caseId),
    bonds: localArchive.bonds.filter((record) => record.caseId === caseId),
    boardPins: localArchive.boardPins.filter((record) => record.caseId === caseId),
    deletionTombstones: localArchive.deletionTombstones.filter(
      (tombstone) =>
        tombstone.caseId === caseId ||
        (tombstone.entityType === 'cases' && tombstone.entityId === caseId),
    ),
    activeCaseId: caseId,
  };
}

function getPrimaryCloudCaseId(onlineArchive: CloudArchiveSnapshot) {
  return onlineArchive.cases[0]?.id ?? null;
}

function scopeCloudArchiveToCase(onlineArchive: CloudArchiveSnapshot, caseId: string | null): CloudArchiveSnapshot {
  if (!caseId) {
    return onlineArchive;
  }

  return {
    cases: onlineArchive.cases.filter((record) => record.id === caseId),
    dossiers: onlineArchive.dossiers.filter((record) => record.case_id === caseId),
    bonds: onlineArchive.bonds.filter((record) => record.case_id === caseId),
    boardEntries: onlineArchive.boardEntries.filter((record) => record.case_id === caseId),
    deletionLedger: onlineArchive.deletionLedger.filter(
      (record) =>
        record.case_id === caseId ||
        (record.entity_type === 'cases' && record.entity_id === caseId),
    ),
  };
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

function hasMissingCloudDependents(
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
) {
  const localDossierIds = new Set(localArchive.dossiers.map((record) => record.id));
  const localBondIds = new Set(localArchive.bonds.map((record) => record.id));
  const localBoardPinIds = new Set(localArchive.boardPins.map((record) => record.id));
  const localImageCount = countLocalImages(localArchive);
  const cloudImageCount = countCloudImages(onlineArchive);

  return (
    onlineArchive.dossiers.some((record) => !localDossierIds.has(record.id) && !hasDeletionAuthority(deletionAuthority, 'dossiers', record.id)) ||
    onlineArchive.bonds.some((record) => !localBondIds.has(record.id) && !hasDeletionAuthority(deletionAuthority, 'bonds', record.id)) ||
    onlineArchive.boardEntries.some((record) => !localBoardPinIds.has(record.id) && !hasDeletionAuthority(deletionAuthority, 'boardEntries', record.id)) ||
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
    new Map(),
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

function createLocalOnlyPlanSection(recordCount: number): SyncPlanSection {
  return {
    ...emptyPlanSection,
    newRecords: recordCount,
    localOnly: recordCount,
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
  retrievedArchive: Omit<LocalArchiveSnapshot, 'activeCaseId' | 'deletionTombstones'>,
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
    deletionTombstones: localArchive.deletionTombstones,
    activeCaseId: localArchive.activeCaseId ?? localArchive.cases[0]?.id ?? retrievedArchive.cases[0]?.id ?? null,
  };
}

function mergeScopedArchiveIntoFullArchive(
  fullArchive: LocalArchiveSnapshot,
  scopedArchive: LocalArchiveSnapshot,
  caseId: string | null,
): LocalArchiveSnapshot {
  if (!caseId) {
    return scopedArchive;
  }

  return {
    cases: [
      ...fullArchive.cases.filter((record) => record.id !== caseId),
      ...scopedArchive.cases,
    ],
    dossiers: [
      ...fullArchive.dossiers.filter((record) => record.caseId !== caseId),
      ...scopedArchive.dossiers,
    ],
    bonds: [
      ...fullArchive.bonds.filter((record) => record.caseId !== caseId),
      ...scopedArchive.bonds,
    ],
    boardPins: [
      ...fullArchive.boardPins.filter((record) => record.caseId !== caseId),
      ...scopedArchive.boardPins,
    ],
    deletionTombstones: [
      ...fullArchive.deletionTombstones.filter(
        (tombstone) =>
          tombstone.caseId !== caseId &&
          !(tombstone.entityType === 'cases' && tombstone.entityId === caseId),
      ),
      ...scopedArchive.deletionTombstones,
    ],
    activeCaseId: fullArchive.activeCaseId ?? scopedArchive.activeCaseId,
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

function getDeletionKey(entityType: SyncEntityType, id: string) {
  return getFingerprintKey(entityType, id);
}

function syncEntityTypeToDeletionEntityType(entityType: SyncEntityType): DeletionEntityType {
  return entityType === 'boardEntries' ? 'boardEntries' : entityType;
}

function getDeletedBaselineKeys(localSyncState: Awaited<ReturnType<typeof readLocalSyncState>>) {
  return new Set(Object.keys(localSyncState?.deletionBaselines ?? {}));
}

type SharedDeletionAuthorityEntry = {
  key: string;
  entityType: SyncEntityType;
  deletionEntityType: DeletionEntityType;
  entityId: string;
  caseId: string | null;
  deletedAt: string;
  source: 'cloud-ledger' | 'local-tombstone' | 'deleted-baseline';
  tombstone?: DeletionTombstone;
};

function deletionEntityTypeToSyncEntityType(entityType: DeletionEntityType): SyncEntityType {
  return entityType === 'boardEntries' ? 'boardEntries' : entityType;
}

function getAuthorityEntryPriority(entry: SharedDeletionAuthorityEntry) {
  if (entry.source === 'cloud-ledger') {
    return 3;
  }

  if (entry.source === 'local-tombstone') {
    return 2;
  }

  return 1;
}

function createSharedDeletionAuthority(
  localTombstones: DeletionTombstone[],
  cloudLedger: CloudArchiveSnapshot['deletionLedger'],
  localSyncState: Awaited<ReturnType<typeof readLocalSyncState>>,
) {
  const entries = new Map<string, SharedDeletionAuthorityEntry>();
  const addEntry = (entry: SharedDeletionAuthorityEntry) => {
    const existingEntry = entries.get(entry.key);

    if (!existingEntry || getAuthorityEntryPriority(entry) > getAuthorityEntryPriority(existingEntry)) {
      entries.set(entry.key, entry);
    }
  };

  Object.values(localSyncState?.deletionBaselines ?? {}).forEach((baseline) => {
    const syncEntityType = deletionEntityTypeToSyncEntityType(baseline.entityType);

    addEntry({
      key: getDeletionKey(syncEntityType, baseline.entityId),
      entityType: syncEntityType,
      deletionEntityType: baseline.entityType,
      entityId: baseline.entityId,
      caseId: null,
      deletedAt: baseline.deletedAt,
      source: 'deleted-baseline',
    });
  });

  localTombstones.forEach((tombstone) => {
    const syncEntityType = deletionEntityTypeToSyncEntityType(tombstone.entityType);

    addEntry({
      key: getDeletionKey(syncEntityType, tombstone.entityId),
      entityType: syncEntityType,
      deletionEntityType: tombstone.entityType,
      entityId: tombstone.entityId,
      caseId: tombstone.caseId,
      deletedAt: tombstone.deletedAt,
      source: 'local-tombstone',
      tombstone,
    });
  });

  cloudLedger.forEach((row) => {
    const tombstone = mapCloudDeletionLedgerToLocalTombstone(row);
    const syncEntityType = deletionEntityTypeToSyncEntityType(tombstone.entityType);

    addEntry({
      key: getDeletionKey(syncEntityType, tombstone.entityId),
      entityType: syncEntityType,
      deletionEntityType: tombstone.entityType,
      entityId: tombstone.entityId,
      caseId: tombstone.caseId,
      deletedAt: tombstone.deletedAt,
      source: 'cloud-ledger',
      tombstone,
    });
  });

  return entries;
}

function expandDeletionAuthorityWithCaseDependents(
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
  localArchive: LocalArchiveSnapshot,
  onlineArchive: CloudArchiveSnapshot,
) {
  const entries = new Map(deletionAuthority);
  const addDerivedEntry = (
    entityType: SyncEntityType,
    entityId: string,
    caseId: string | null,
    parentEntry: SharedDeletionAuthorityEntry,
  ) => {
    const deletionEntityType = syncEntityTypeToDeletionEntityType(entityType);
    const key = getDeletionKey(entityType, entityId);

    if (entries.has(key)) {
      return;
    }

    entries.set(key, {
      key,
      entityType,
      deletionEntityType,
      entityId,
      caseId,
      deletedAt: parentEntry.deletedAt,
      source: parentEntry.source,
    });
  };
  const deletedCaseEntries = [...entries.values()].filter((entry) => entry.entityType === 'cases');
  const deletedCaseIds = new Set(deletedCaseEntries.map((entry) => entry.entityId));

  deletedCaseEntries.forEach((caseEntry) => {
    localArchive.dossiers
      .filter((record) => record.caseId === caseEntry.entityId)
      .forEach((record) => addDerivedEntry('dossiers', record.id, record.caseId, caseEntry));
    onlineArchive.dossiers
      .filter((record) => record.case_id === caseEntry.entityId)
      .forEach((record) => addDerivedEntry('dossiers', record.id, record.case_id, caseEntry));
  });

  const deletedDossierIds = new Set(
    [...entries.values()]
      .filter((entry) => entry.entityType === 'dossiers')
      .map((entry) => entry.entityId),
  );

  deletedCaseEntries.forEach((caseEntry) => {
    localArchive.bonds
      .filter(
        (record) =>
          record.caseId === caseEntry.entityId ||
          deletedDossierIds.has(record.sourceDossierId) ||
          deletedDossierIds.has(record.targetDossierId),
      )
      .forEach((record) => addDerivedEntry('bonds', record.id, record.caseId, caseEntry));
    onlineArchive.bonds
      .filter(
        (record) =>
          record.case_id === caseEntry.entityId ||
          deletedDossierIds.has(record.source_dossier_id) ||
          deletedDossierIds.has(record.target_dossier_id),
      )
      .forEach((record) => addDerivedEntry('bonds', record.id, record.case_id, caseEntry));
    localArchive.boardPins
      .filter(
        (record) =>
          record.caseId === caseEntry.entityId ||
          deletedDossierIds.has(record.dossierId),
      )
      .forEach((record) => addDerivedEntry('boardEntries', record.id, record.caseId, caseEntry));
    onlineArchive.boardEntries
      .filter(
        (record) =>
          record.case_id === caseEntry.entityId ||
          deletedDossierIds.has(record.dossier_id),
      )
      .forEach((record) => addDerivedEntry('boardEntries', record.id, record.case_id, caseEntry));
  });

  deletedCaseIds.forEach((caseId) => {
    const caseEntry = entries.get(getDeletionKey('cases', caseId));

    if (!caseEntry) {
      return;
    }

    [...entries.values()]
      .filter((entry) => entry.caseId === caseId && entry.entityType !== 'cases')
      .forEach((entry) => {
        if (!entries.has(entry.key)) {
          entries.set(entry.key, entry);
        }
      });
  });

  return entries;
}

function hasDeletionAuthority(
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
  entityType: SyncEntityType,
  entityId: string,
) {
  return deletionAuthority.has(getDeletionKey(entityType, entityId));
}

function filterRecordsByDeletionAuthority<TRecord extends { id: string }>(
  records: TRecord[],
  entityType: SyncEntityType,
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
) {
  return records.filter((record) => !hasDeletionAuthority(deletionAuthority, entityType, record.id));
}

function getDeletionAuthorityIds(
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
  entityType: SyncEntityType,
) {
  return new Set(
    [...deletionAuthority.values()]
      .filter((entry) => entry.entityType === entityType)
      .map((entry) => entry.entityId),
  );
}

function hasActionId(
  actionIds: {
    cases: Set<string>;
    dossiers: Set<string>;
    bonds: Set<string>;
    boardPins: Set<string>;
  },
  entry: SharedDeletionAuthorityEntry,
) {
  if (entry.entityType === 'cases') {
    return actionIds.cases.has(entry.entityId);
  }

  if (entry.entityType === 'dossiers') {
    return actionIds.dossiers.has(entry.entityId);
  }

  if (entry.entityType === 'bonds') {
    return actionIds.bonds.has(entry.entityId);
  }

  return actionIds.boardPins.has(entry.entityId);
}

function sanitizeEntityId(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return id.length <= 12 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function createRemoteDeletionBaselineEntry(entityType: SyncEntityType, entityId: string, deletedAt: string) {
  const deletionEntityType = syncEntityTypeToDeletionEntityType(entityType);

  return {
    entityType: deletionEntityType,
    entityId,
    deletedAt,
    deletionFingerprint: fingerprint({
      state: 'deleted',
      entityType: deletionEntityType,
      entityId,
      deletedAt,
      deletionVersion: DELETION_SYNC_VERSION,
    }),
    deletionVersion: DELETION_SYNC_VERSION as typeof DELETION_SYNC_VERSION,
  };
}

function createRemoteDeletionBaselineEntries(deletedIds: {
  cases: Set<string>;
  dossiers: Set<string>;
  bonds: Set<string>;
  boardPins: Set<string>;
}) {
  const deletedAt = new Date().toISOString();

  return {
    ...Object.fromEntries(
      [...deletedIds.cases].map((id) => [
        getDeletionKey('cases', id),
        createRemoteDeletionBaselineEntry('cases', id, deletedAt),
      ]),
    ),
    ...Object.fromEntries(
      [...deletedIds.dossiers].map((id) => [
        getDeletionKey('dossiers', id),
        createRemoteDeletionBaselineEntry('dossiers', id, deletedAt),
      ]),
    ),
    ...Object.fromEntries(
      [...deletedIds.bonds].map((id) => [
        getDeletionKey('bonds', id),
        createRemoteDeletionBaselineEntry('bonds', id, deletedAt),
      ]),
    ),
    ...Object.fromEntries(
      [...deletedIds.boardPins].map((id) => [
        getDeletionKey('boardEntries', id),
        createRemoteDeletionBaselineEntry('boardEntries', id, deletedAt),
      ]),
    ),
  };
}

function createDeletionBaselineEntriesFromAuthority(
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
) {
  return Object.fromEntries(
    [...deletionAuthority.values()].map((entry) => [
      entry.key,
      createRemoteDeletionBaselineEntry(entry.entityType, entry.entityId, entry.deletedAt),
    ]),
  );
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
  const origin = record.origin ?? record.evidence?.origin;
  const threadmark = record.threadmark ?? record.evidence?.threadmark;
  const evidence = {
    ...(record.evidence ?? {}),
    origin,
    threadmark,
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

function getGeneratedBondMetadata(record: {
  origin?: string;
  threadmark?: unknown;
  evidence?: Record<string, unknown> | null;
}) {
  const origin = record.origin ?? record.evidence?.origin;
  const threadmark = record.threadmark ?? record.evidence?.threadmark;

  return origin === 'threadmark' && threadmark && typeof threadmark === 'object'
    ? threadmark as Record<string, unknown>
    : null;
}

function isGeneratedBondRecord(record: {
  origin?: string;
  threadmark?: unknown;
  evidence?: Record<string, unknown> | null;
}) {
  return Boolean(getGeneratedBondMetadata(record));
}

function getGeneratedBondRole(record: {
  origin?: string;
  threadmark?: unknown;
  evidence?: Record<string, unknown> | null;
}) {
  const role = getGeneratedBondMetadata(record)?.role;

  return role === 'forward' || role === 'inverse' ? role : null;
}

function countGeneratedBondsByRole(records: Array<{
  origin?: string;
  threadmark?: unknown;
  evidence?: Record<string, unknown> | null;
}>) {
  return {
    total: records.filter(isGeneratedBondRecord).length,
    forward: records.filter((record) => getGeneratedBondRole(record) === 'forward').length,
    inverse: records.filter((record) => getGeneratedBondRole(record) === 'inverse').length,
  };
}

function generatedMetadataPreserved(records: Array<{
  origin?: string;
  threadmark?: unknown;
  evidence?: Record<string, unknown> | null;
}>) {
  return records
    .filter(isGeneratedBondRecord)
    .every((record) => {
      const metadata = getGeneratedBondMetadata(record);

      return Boolean(
        metadata?.ownerId &&
        metadata?.pairId &&
        metadata?.role &&
        metadata?.effectiveRelationshipKey,
      );
    });
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
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
  stats: ReconciliationStats,
) {
  const onlineById = new Map(onlineRecords.map((record) => [record.id, record]));
  const localIds = new Set(localRecords.map((record) => record.id));
  const deletionAuthorityIds = getDeletionAuthorityIds(deletionAuthority, entityType);
  const section = { ...emptyPlanSection };

  localRecords.forEach((localRecord) => {
    if (!isValidStableId(localRecord.id)) {
      section.invalidRecords += 1;
      section.requiresReview += 1;
      section.itemsRequiringReview += 1;
      stats.invalidIds += 1;
      return;
    }

    if (deletionAuthorityIds.has(localRecord.id)) {
      section.cloudUpdatesAvailable += 1;
      section.onlineNewer += 1;
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

    if (deletionAuthorityIds.has(record.id)) {
      section.localNewer += 1;
      section.updatedRecords += 1;
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
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
): SyncRecordAction[] {
  const onlineById = new Map(onlineRecords.map((record) => [record.id, record]));
  const localIds = new Set(localRecords.map((record) => record.id));
  const deletionAuthorityEntries = [...deletionAuthority.values()].filter((entry) => entry.entityType === entityType);
  const deletionAuthorityIds = new Set(deletionAuthorityEntries.map((entry) => entry.entityId));
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

    if (deletionAuthorityIds.has(localRecord.id)) {
      actions.push({
        entityType,
        id: localRecord.id,
        action: 'delete-local',
        baselineStatus,
        safeReason: 'Shared deletion authority marks this local record deleted.',
      });
      return;
    }

    const onlineRecord = onlineById.get(localRecord.id);

    if (!onlineRecord) {
      const deletionKey = getDeletionKey(entityType, localRecord.id);
      const baselineFingerprint = baselineFingerprints?.[deletionKey];

      if (baselineFingerprint) {
        const localFingerprint = fingerprint(normalizeLocalForComparison(localRecord));

        if (localFingerprint === baselineFingerprint) {
          actions.push({
            entityType,
            id: localRecord.id,
            action: 'delete-local',
            baselineStatus,
            safeReason: 'This record was deleted from another synchronized device.',
          });
          return;
        }

        actions.push({
          entityType,
          id: localRecord.id,
          action: 'deletion-conflict',
          baselineStatus,
          safeReason: 'Deletion Review Required. LoreBound found changes to an item that was deleted on another device.',
        });
        return;
      }

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

    if (deletionAuthorityIds.has(onlineRecord.id)) {
      actions.push({
        entityType,
        id: onlineRecord.id,
        action: 'delete-cloud',
        baselineStatus,
        safeReason: 'This record was intentionally deleted from the Local Archive and must be removed from LoreBound Online.',
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

  deletionAuthorityEntries.forEach((entry) => {
    if (localIds.has(entry.entityId) || onlineById.has(entry.entityId)) {
      return;
    }

    actions.push({
      entityType,
      id: entry.entityId,
      action:
        entry.tombstone?.synchronizationStatus === 'verified' || entry.source === 'cloud-ledger'
          ? 'deletion-verified'
          : 'deletion-pending',
      baselineStatus,
      safeReason:
        entry.tombstone?.synchronizationStatus === 'verified' || entry.source === 'cloud-ledger'
          ? 'This deletion has been verified against LoreBound Online.'
          : 'This deletion is waiting for LoreBound Online verification.',
    });
  });

  return actions;
}

function findContradictoryDeletionActions(actions: SyncRecordAction[]) {
  const actionsByEntity = new Map<string, Set<SyncRecordAction['action']>>();

  actions.forEach((action) => {
    const key = getDeletionKey(action.entityType, action.id);
    const entityActions = actionsByEntity.get(key) ?? new Set<SyncRecordAction['action']>();
    entityActions.add(action.action);
    actionsByEntity.set(key, entityActions);
  });

  return [...actionsByEntity.entries()].filter(([, entityActions]) => {
    const hasDeletionAction =
      entityActions.has('delete-cloud') ||
      entityActions.has('delete-local') ||
      entityActions.has('deletion-pending') ||
      entityActions.has('deletion-verified') ||
      entityActions.has('remote-record-recreated');
    const hasLiveAction =
      entityActions.has('upload-local-only') ||
      entityActions.has('upload-local-newer') ||
      entityActions.has('retrieve-cloud-only') ||
      entityActions.has('retrieve-cloud-newer') ||
      entityActions.has('unchanged');

    return hasDeletionAction && hasLiveAction;
  });
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

function createRecordKeySet(localArchive: LocalArchiveSnapshot) {
  return new Set([
    ...localArchive.cases.map((record) => getFingerprintKey('cases', record.id)),
    ...localArchive.dossiers.map((record) => getFingerprintKey('dossiers', record.id)),
    ...localArchive.bonds.map((record) => getFingerprintKey('bonds', record.id)),
    ...localArchive.boardPins.map((record) => getFingerprintKey('boardEntries', record.id)),
  ]);
}

function filterObjectByKeys<T>(values: Record<string, T> | undefined, keys: Set<string>) {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([key]) => keys.has(key)),
  ) as Record<string, T>;
}

function scopeLocalSyncStateToArchive(
  localSyncState: LocalSyncState | null,
  localArchive: LocalArchiveSnapshot,
) {
  if (!localSyncState) {
    return null;
  }

  const caseIds = new Set(localArchive.cases.map((record) => record.id));
  const hasCaseBaseline = localSyncState.synchronizedRecordIds.cases.some((id) => caseIds.has(id));

  if (!hasCaseBaseline) {
    return null;
  }

  const dossierIds = new Set(localArchive.dossiers.map((record) => record.id));
  const bondIds = new Set(localArchive.bonds.map((record) => record.id));
  const boardPinIds = new Set(localArchive.boardPins.map((record) => record.id));
  const recordKeys = createRecordKeySet(localArchive);
  const deletionKeys = new Set(
    localArchive.deletionTombstones.map((tombstone) =>
      getDeletionKey(deletionEntityTypeToSyncEntityType(tombstone.entityType), tombstone.entityId),
    ),
  );

  return {
    ...localSyncState,
    synchronizedRecordIds: {
      cases: localSyncState.synchronizedRecordIds.cases.filter((id) => caseIds.has(id)),
      dossiers: localSyncState.synchronizedRecordIds.dossiers.filter((id) => dossierIds.has(id)),
      bonds: localSyncState.synchronizedRecordIds.bonds.filter((id) => bondIds.has(id)),
      boardPins: localSyncState.synchronizedRecordIds.boardPins.filter((id) => boardPinIds.has(id)),
    },
    synchronizedUpdatedAt: filterObjectByKeys(localSyncState.synchronizedUpdatedAt, new Set([
      ...localArchive.cases.map((record) => record.id),
      ...localArchive.dossiers.map((record) => record.id),
      ...localArchive.bonds.map((record) => record.id),
      ...localArchive.boardPins.map((record) => record.id),
    ])),
    synchronizedFingerprints: localSyncState.synchronizedFingerprints
      ? filterObjectByKeys(localSyncState.synchronizedFingerprints, recordKeys)
      : undefined,
    deletionBaselines: filterObjectByKeys(localSyncState.deletionBaselines, deletionKeys),
    cloudImagePaths: {
      cases: Object.fromEntries(
        Object.entries(localSyncState.cloudImagePaths?.cases ?? {}).filter(([id]) => caseIds.has(id)),
      ),
      dossiers: Object.fromEntries(
        Object.entries(localSyncState.cloudImagePaths?.dossiers ?? {}).filter(([id]) => dossierIds.has(id)),
      ),
    },
  };
}

function mergeLocalSyncState(
  existingState: LocalSyncState | null,
  nextState: LocalSyncState,
  scopedArchive: LocalArchiveSnapshot,
): LocalSyncState {
  if (!existingState || existingState.investigatorId !== nextState.investigatorId) {
    return nextState;
  }

  const caseIds = new Set(scopedArchive.cases.map((record) => record.id));
  const dossierIds = new Set(scopedArchive.dossiers.map((record) => record.id));
  const bondIds = new Set(scopedArchive.bonds.map((record) => record.id));
  const boardPinIds = new Set(scopedArchive.boardPins.map((record) => record.id));
  const scopedRecordKeys = createRecordKeySet(scopedArchive);

  return {
    ...nextState,
    synchronizedRecordIds: {
      cases: [
        ...existingState.synchronizedRecordIds.cases.filter((id) => !caseIds.has(id)),
        ...nextState.synchronizedRecordIds.cases,
      ],
      dossiers: [
        ...existingState.synchronizedRecordIds.dossiers.filter((id) => !dossierIds.has(id)),
        ...nextState.synchronizedRecordIds.dossiers,
      ],
      bonds: [
        ...existingState.synchronizedRecordIds.bonds.filter((id) => !bondIds.has(id)),
        ...nextState.synchronizedRecordIds.bonds,
      ],
      boardPins: [
        ...existingState.synchronizedRecordIds.boardPins.filter((id) => !boardPinIds.has(id)),
        ...nextState.synchronizedRecordIds.boardPins,
      ],
    },
    synchronizedUpdatedAt: {
      ...Object.fromEntries(
        Object.entries(existingState.synchronizedUpdatedAt).filter(([id]) =>
          !caseIds.has(id) && !dossierIds.has(id) && !bondIds.has(id) && !boardPinIds.has(id),
        ),
      ),
      ...nextState.synchronizedUpdatedAt,
    },
    synchronizedFingerprints: {
      ...Object.fromEntries(
        Object.entries(existingState.synchronizedFingerprints ?? {}).filter(([key]) => !scopedRecordKeys.has(key)),
      ),
      ...(nextState.synchronizedFingerprints ?? {}),
    },
    deletionBaselines: {
      ...(existingState.deletionBaselines ?? {}),
      ...(nextState.deletionBaselines ?? {}),
    },
    cloudImagePaths: {
      cases: {
        ...Object.fromEntries(
          Object.entries(existingState.cloudImagePaths?.cases ?? {}).filter(([id]) => !caseIds.has(id)),
        ),
        ...(nextState.cloudImagePaths?.cases ?? {}),
      },
      dossiers: {
        ...Object.fromEntries(
          Object.entries(existingState.cloudImagePaths?.dossiers ?? {}).filter(([id]) => !dossierIds.has(id)),
        ),
        ...(nextState.cloudImagePaths?.dossiers ?? {}),
      },
    },
  };
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

function createCrescentCityDeletionTrace(
  fullLocalArchive: LocalArchiveSnapshot,
  fullOnlineArchive: CloudArchiveSnapshot,
  scopedLocalArchive: LocalArchiveSnapshot,
  scopedOnlineArchive: CloudArchiveSnapshot,
  deletionAuthority: Map<string, SharedDeletionAuthorityEntry>,
  recordActions: SyncRecordAction[],
  localSyncState: LocalSyncState | null,
  userId: string,
  canSynchronize: boolean,
  selectedSynchronizationMode: SyncPlan['diagnostics']['reconciliation']['selectedSynchronizationMode'],
  selectedAction: string,
) {
  const localCase =
    fullLocalArchive.cases.find((record) => record.caseName.trim().toLowerCase() === 'crescent city') ?? null;
  const cloudCase =
    fullOnlineArchive.cases.find((record) => record.name.trim().toLowerCase() === 'crescent city') ?? null;
  const caseId = localCase?.id ?? cloudCase?.id ?? null;
  const ledgerRows = caseId
    ? fullOnlineArchive.deletionLedger.filter(
        (row) => row.case_id === caseId && row.entity_type === 'dossiers',
      )
    : [];
  const scopedLedgerRows = caseId
    ? scopedOnlineArchive.deletionLedger.filter(
        (row) => row.case_id === caseId && row.entity_type === 'dossiers',
      )
    : [];
  const tombstones = caseId
    ? fullLocalArchive.deletionTombstones.filter(
        (tombstone) => tombstone.caseId === caseId && tombstone.entityType === 'dossiers',
      )
    : [];
  const candidateIds = [
    ...new Set([
      ...ledgerRows.map((row) => row.entity_id),
      ...tombstones.map((tombstone) => tombstone.entityId),
    ]),
  ];
  const candidateId =
    candidateIds.find((id) => scopedLocalArchive.dossiers.some((record) => record.id === id)) ??
    candidateIds[0] ??
    null;
  const ledgerRow = candidateId
    ? ledgerRows.find((row) => row.entity_id === candidateId) ?? null
    : null;
  const scopedLedgerRow = candidateId
    ? scopedLedgerRows.find((row) => row.entity_id === candidateId) ?? null
    : null;
  const tombstone = candidateId
    ? tombstones.find((record) => record.entityId === candidateId) ?? null
    : null;
  const localDossierExists = Boolean(
    candidateId && scopedLocalArchive.dossiers.some((record) => record.id === candidateId),
  );
  const liveCloudDossierExists = Boolean(
    candidateId && fullOnlineArchive.dossiers.some((record) => record.id === candidateId),
  );
  const deletionKey = candidateId ? getDeletionKey('dossiers', candidateId) : null;
  const plannerAction = candidateId
    ? recordActions.find((action) => action.entityType === 'dossiers' && action.id === candidateId)?.action ?? null
    : null;
  const sharedAuthorityContains = Boolean(
    candidateId && hasDeletionAuthority(deletionAuthority, 'dossiers', candidateId),
  );
  const matchingDeletedBaselineExists = Boolean(
    deletionKey && localSyncState?.deletionBaselines?.[deletionKey],
  );
  const firstFalseStage = (() => {
    if (!caseId) {
      return 'Crescent City Case was not found locally or in LoreBound Online.';
    }

    if (!candidateId) {
      return 'No deleted Dossier candidate was found from local tombstones or LoreBound Online ledger rows.';
    }

    if (!ledgerRow && !tombstone && !matchingDeletedBaselineExists) {
      return 'No deletion authority source exists for the candidate Dossier.';
    }

    if (ledgerRow && !scopedLedgerRow) {
      return 'The LoreBound Online ledger row exists but is filtered out of the active Case cloud snapshot.';
    }

    if ((ledgerRow || tombstone || matchingDeletedBaselineExists) && !sharedAuthorityContains) {
      return 'Deletion authority source exists but shared deletion authority does not contain the Dossier.';
    }

    if (localDossierExists && !plannerAction) {
      return 'The stale local Dossier exists but no planner action was created for it.';
    }

    if (localDossierExists && plannerAction !== 'delete-local') {
      return `The stale local Dossier exists but planner action is ${plannerAction}.`;
    }

    if (localDossierExists && plannerAction === 'delete-local' && !canSynchronize) {
      return 'The planner created delete-local but synchronization is not executable.';
    }

    if (ledgerRow && liveCloudDossierExists) {
      return 'The ledger row exists but the live LoreBound Online Dossier row still exists.';
    }

    if (!localDossierExists && !liveCloudDossierExists && sharedAuthorityContains) {
      return 'No failing stage detected for this origin.';
    }

    return 'Trace complete; run synchronization on this origin and refresh Operations Console.';
  })();

  return {
    caseId,
    deletedDossierId: candidateId,
    deletedDossierCandidates: candidateIds,
    deletingClientSourceClientId: ledgerRow?.source_client_id ?? tombstone?.sourceClientId ?? null,
    localDeletedDossierExists: localDossierExists,
    localTombstoneExists: Boolean(tombstone),
    localTombstoneEntityType: tombstone?.entityType ?? null,
    localTombstoneEntityId: tombstone?.entityId ?? null,
    localTombstoneCaseId: tombstone?.caseId ?? null,
    localTombstoneStatus: tombstone?.synchronizationStatus ?? null,
    localTombstoneAttemptCount: 'Not tracked',
    localTombstoneLastError: tombstone?.lastFailedStage ?? null,
    localTombstoneDeletedAt: tombstone?.deletedAt ?? null,
    localTombstoneSourceClientId: tombstone?.sourceClientId ?? null,
    localTombstoneIncludedInPlan: Boolean(
      tombstone && scopedLocalArchive.deletionTombstones.some((record) => record.id === tombstone.id),
    ),
    cloudLedgerRowExists: Boolean(ledgerRow),
    cloudLedgerRowId: ledgerRow?.id ?? null,
    cloudLedgerEntityType: ledgerRow?.entity_type ?? null,
    cloudLedgerEntityId: ledgerRow?.entity_id ?? null,
    cloudLedgerCaseId: ledgerRow?.case_id ?? null,
    cloudLedgerUserIdMatches: ledgerRow ? ledgerRow.user_id === userId : null,
    cloudLedgerDeletedAt: ledgerRow?.deleted_at ?? null,
    cloudLedgerAcknowledgedAt: ledgerRow?.acknowledged_at ?? null,
    cloudLedgerSourceClientId: ledgerRow?.source_client_id ?? null,
    cloudLedgerDeletionVersion: ledgerRow?.deletion_version ?? null,
    liveCloudDossierExists,
    scopedCloudLedgerIncludesRow: Boolean(scopedLedgerRow),
    sharedDeletionAuthorityContainsDossier: sharedAuthorityContains,
    matchingDeletedBaselineExists,
    plannerRecordAction: plannerAction,
    deleteLocalActionExists: plannerAction === 'delete-local',
    planCanSynchronize: canSynchronize,
    selectedSynchronizationMode,
    selectedAction,
    firstFalseStage,
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

  async discoverCloudCases(): Promise<LoreCase[]> {
    const user = await authService.getCurrentUser();

    if (!user) {
      return [];
    }

    const [localArchive, onlineArchive, localSyncState] = await Promise.all([
      readFullLocalArchive(),
      cloudArchiveRepository.readArchive(),
      readLocalSyncState(),
    ]);
    const deletionAuthority = createSharedDeletionAuthority(
      localArchive.deletionTombstones,
      onlineArchive.deletionLedger,
      localSyncState,
    );
    const localCaseIds = new Set(localArchive.cases.map((record) => record.id));

    return sortCasesByCloudUpdatedAt(
      onlineArchive.cases
        .filter((record) => record.user_id === user.id)
        .filter((record) => !localCaseIds.has(record.id))
        .filter((record) => !hasDeletionAuthority(deletionAuthority, 'cases', record.id))
        .map(mapCloudCaseToLocal),
    );
  }

  async createPlan(): Promise<SyncPlanResult> {
    const plan = createEmptyPlan();
    const user = await authService.getCurrentUser();

    if (!user) {
      plan.blockingReasons.push('Investigator Connect is required.');
      return { ok: false, plan, message: 'Connect your Investigator Profile first.' };
    }

    const fullLocalArchive = await readFullLocalArchive();
    const activeCaseId = getPrimaryLocalCaseId(fullLocalArchive);
    const localArchive = scopeLocalArchiveToCase(fullLocalArchive, activeCaseId);
    const fullLocalSyncState = await readLocalSyncState();
    const localSyncState = scopeLocalSyncStateToArchive(fullLocalSyncState, localArchive);
    const localImageCount = countLocalImages(localArchive);
    const localArchiveIsEmpty = isArchiveEmpty(localArchive);

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
    plan.isLocalArchiveEmpty = localArchiveIsEmpty;
    plan.sections = {
      cases: createLocalOnlyPlanSection(localArchive.cases.length),
      dossiers: createLocalOnlyPlanSection(localArchive.dossiers.length),
      bonds: createLocalOnlyPlanSection(localArchive.bonds.length),
      boardEntries: createLocalOnlyPlanSection(localArchive.boardPins.length),
    };
    plan.lastSynchronizedAt = localSyncState?.lastSuccessfulSynchronizationAt ?? null;
    plan.diagnostics = {
      ...plan.diagnostics,
      localInvestigationsRead: localArchive.cases.length,
      localDossiersRead: localArchive.dossiers.length,
      localBondsRead: localArchive.bonds.length,
      localEvidencePinsRead: localArchive.boardPins.length,
      archiveState: {
        ...plan.diagnostics.archiveState,
        activeInvestigationIdPresent: Boolean(localArchive.activeCaseId),
        localCaseStableId: getPrimaryLocalCaseId(localArchive),
        classification: localArchiveIsEmpty ? 'Empty' : 'Complete Local Archive',
        disabledReason: 'LoreBound Online has not been reviewed yet.',
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : 'Unknown',
        localImageReferences: localImageCount,
      },
    };
    const onlineRead = await cloudArchiveRepository.readArchiveWithDiagnostics();
    const onlineArchive: CloudArchiveSnapshot = scopeCloudArchiveToCase(onlineRead.archive, activeCaseId);

    plan.diagnostics = {
      ...plan.diagnostics,
      cloudQueries: onlineRead.queries,
    };

    if (!onlineRead.isAvailable) {
      plan.blockingReasons.push('LoreBound Online could not be reviewed.');
      plan.diagnostics = {
        ...plan.diagnostics,
        archiveState: {
          ...plan.diagnostics.archiveState,
          classification: localArchiveIsEmpty ? 'Empty' : 'Complete Local Archive',
          actionEnabled: false,
          disabledReason: 'LoreBound Online could not be reviewed.',
          handlerPresent: true,
          selectedAction: 'Update Investigation',
          selectedActionReason: 'Local Archive changes exist, but LoreBound Online is unavailable.',
        },
        reconciliation: {
          ...plan.diagnostics.reconciliation,
          selectedSynchronizationMode: localArchiveIsEmpty ? 'none' : 'upload-only',
          uploadActionsCount:
            localArchive.cases.length +
            localArchive.dossiers.length +
            localArchive.bonds.length +
            localArchive.boardPins.length,
          outboundGateReason: 'LoreBound Online could not be reviewed.',
        },
      };
      return { ok: false, plan, message: 'LoreBound Online could not be reviewed.' };
    }

    const imageReadiness = await cloudImageProvider.checkReadiness(user.id);
    const imagePreparation =
      localImageCount > 0
        ? await prepareCloudImages(localArchive, user.id)
        : { candidates: [], preparedImages: [], failures: [] };
    const plannedImagePaths = getPlannedImagePaths(localArchive, user.id);
    const deletionAuthority = expandDeletionAuthorityWithCaseDependents(
      createSharedDeletionAuthority(
        localArchive.deletionTombstones,
        onlineArchive.deletionLedger,
        localSyncState,
      ),
      localArchive,
      onlineArchive,
    );
    const liveLocalArchive = {
      ...localArchive,
      cases: filterRecordsByDeletionAuthority(localArchive.cases, 'cases', deletionAuthority),
      dossiers: filterRecordsByDeletionAuthority(localArchive.dossiers, 'dossiers', deletionAuthority),
      bonds: filterRecordsByDeletionAuthority(localArchive.bonds, 'bonds', deletionAuthority),
      boardPins: filterRecordsByDeletionAuthority(localArchive.boardPins, 'boardEntries', deletionAuthority),
    };
    const liveOnlineArchive = {
      ...onlineArchive,
      cases: filterRecordsByDeletionAuthority(onlineArchive.cases, 'cases', deletionAuthority),
      dossiers: filterRecordsByDeletionAuthority(onlineArchive.dossiers, 'dossiers', deletionAuthority),
      bonds: filterRecordsByDeletionAuthority(onlineArchive.bonds, 'bonds', deletionAuthority),
      boardEntries: filterRecordsByDeletionAuthority(onlineArchive.boardEntries, 'boardEntries', deletionAuthority),
    };
    const cloudImagePaths = getCloudImagePaths(liveOnlineArchive);
    const localBaselineFingerprints = createLocalFingerprintSnapshot(liveLocalArchive, cloudImagePaths);
    const cloudBaselineFingerprints = createCloudFingerprintSnapshot(liveOnlineArchive);
    const dependencyReasons = validateDependencies(liveLocalArchive);
    const isLocalArchiveEmpty = isArchiveEmpty(liveLocalArchive);
    const isOnlineArchiveEmpty = isArchiveEmpty(liveOnlineArchive);
    const sameInvestigationIdLocalAndCloud = hasSamePrimaryInvestigation(liveLocalArchive, liveOnlineArchive);
    const localCaseStableId = getPrimaryLocalCaseId(liveLocalArchive);
    const cloudCaseStableId = getPrimaryCloudCaseId(liveOnlineArchive);
    const caseNormalizedMatch = hasMatchingPrimaryCaseContent(liveLocalArchive, liveOnlineArchive);
    const emptyShellState = getEmptyLocalCaseShellState(liveLocalArchive, liveOnlineArchive, localSyncState, user.id);
    const cloudImageCount = countCloudImages(liveOnlineArchive);
    const baselineState = getBaselineState(
      liveLocalArchive,
      liveOnlineArchive,
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
        liveLocalArchive.cases,
        liveOnlineArchive.cases,
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
        deletionAuthority,
        reconciliationStats,
      ),
      dossiers: compareById(
        'dossiers',
        liveLocalArchive.dossiers,
        liveOnlineArchive.dossiers,
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
        deletionAuthority,
        reconciliationStats,
      ),
      bonds: compareById(
        'bonds',
        liveLocalArchive.bonds,
        liveOnlineArchive.bonds,
        (record) => record.dateModified,
        (record) => record.updated_at,
        normalizeBondContent,
        normalizeBondContent,
        localSyncState?.synchronizedFingerprints,
        deletionAuthority,
        reconciliationStats,
      ),
      boardEntries: compareById(
        'boardEntries',
        liveLocalArchive.boardPins,
        liveOnlineArchive.boardEntries,
        (record) => record.datePinned,
        (record) => record.updated_at,
        normalizeBoardEntryContent,
        normalizeBoardEntryContent,
        localSyncState?.synchronizedFingerprints,
        deletionAuthority,
        reconciliationStats,
      ),
    };
    plan.sections =
      sameInvestigationIdLocalAndCloud && caseNormalizedMatch
        ? {
            ...comparedSections,
            cases: createMatchingCaseSection(liveLocalArchive, liveOnlineArchive),
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
        deletionAuthority,
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
        deletionAuthority,
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
        deletionAuthority,
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
        deletionAuthority,
      ),
    ];
    const contradictoryDeletionActions = findContradictoryDeletionActions(recordActions);
    const uploadActions = recordActions.filter(
      (action) =>
        action.action === 'upload-local-only' ||
        action.action === 'upload-local-newer' ||
        action.action === 'delete-cloud' ||
        action.action === 'remote-record-recreated',
    );
    const retrievalActions = recordActions.filter(
      (action) =>
        action.action === 'retrieve-cloud-only' ||
        action.action === 'retrieve-cloud-newer' ||
        action.action === 'delete-local',
    );
    const conflictActions = recordActions.filter(
      (action) =>
        action.action === 'conflict' ||
        action.action === 'requires-review' ||
        action.action === 'deletion-conflict' ||
        action.action === 'tombstone-orphaned',
    );
    if (contradictoryDeletionActions.length > 0) {
      conflictActions.push({
        entityType: 'bonds',
        id: 'contradictory-deletion-plan',
        action: 'requires-review',
        baselineStatus: baselineState.status,
        safeReason: 'Deletion plan contains contradictory live and deleted actions.',
      });
    }
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
    const localGeneratedBondCounts = countGeneratedBondsByRole(localArchive.bonds);
    const generatedLocalBondIds = new Set(
      localArchive.bonds.filter(isGeneratedBondRecord).map((record) => record.id),
    );
    const generatedBondActions = recordActions.filter(
      (action) => action.entityType === 'bonds' && generatedLocalBondIds.has(action.id),
    );
    const generatedLocalOnlyCount = generatedBondActions.filter(
      (action) => action.action === 'upload-local-only',
    ).length;
    const generatedLocalNewerCount = generatedBondActions.filter(
      (action) => action.action === 'upload-local-newer',
    ).length;
    const generatedMatchingCount = generatedBondActions.filter(
      (action) => action.action === 'unchanged',
    ).length;
    const generatedForwardIds = new Set(
      localArchive.bonds
        .filter((record) => getGeneratedBondRole(record) === 'forward')
        .map((record) => record.id),
    );
    const generatedInverseIds = new Set(
      localArchive.bonds
        .filter((record) => getGeneratedBondRole(record) === 'inverse')
        .map((record) => record.id),
    );
    const localTombstoneKeys = new Set(
      localArchive.deletionTombstones.map((tombstone) =>
        getDeletionKey(deletionEntityTypeToSyncEntityType(tombstone.entityType), tombstone.entityId),
      ),
    );
    const cloudLedgerKeys = new Set(
      onlineArchive.deletionLedger.map((row) => {
        const tombstone = mapCloudDeletionLedgerToLocalTombstone(row);

        return getDeletionKey(deletionEntityTypeToSyncEntityType(tombstone.entityType), tombstone.entityId);
      }),
    );
    const liveLocalSuppressed =
      localArchive.cases.length - liveLocalArchive.cases.length +
      localArchive.dossiers.length - liveLocalArchive.dossiers.length +
      localArchive.bonds.length - liveLocalArchive.bonds.length +
      localArchive.boardPins.length - liveLocalArchive.boardPins.length;
    const liveCloudSuppressed =
      onlineArchive.cases.length - liveOnlineArchive.cases.length +
      onlineArchive.dossiers.length - liveOnlineArchive.dossiers.length +
      onlineArchive.bonds.length - liveOnlineArchive.bonds.length +
      onlineArchive.boardEntries.length - liveOnlineArchive.boardEntries.length;

    recordThreadmarkSynchronizationDiagnostics({
      generatedBondsPendingUpload: generatedLocalOnlyCount + generatedLocalNewerCount,
      generatedForwardBondsPendingUpload: generatedBondActions.filter(
        (action) =>
          (action.action === 'upload-local-only' || action.action === 'upload-local-newer') &&
          generatedForwardIds.has(action.id),
      ).length,
      generatedInverseBondsPendingUpload: generatedBondActions.filter(
        (action) =>
          (action.action === 'upload-local-only' || action.action === 'upload-local-newer') &&
          generatedInverseIds.has(action.id),
      ).length,
      generatedBondsUploaded: generatedMatchingCount,
      generatedBondsVerifiedInCloud: 0,
      generatedBondsRetrieved: 0,
      generatedMetadataPreserved: generatedMetadataPreserved(localArchive.bonds),
      desiredForwardCount: localGeneratedBondCounts.forward,
      desiredInverseCount: localGeneratedBondCounts.inverse,
      lastFailedStage: 'None',
    });
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
        deletionDiagnostics: {
          deletionModelVersion: DELETION_SYNC_VERSION,
          localTombstoneCount: localArchive.deletionTombstones.length,
          pendingDeletionCount: localArchive.deletionTombstones.filter(
            (tombstone) => tombstone.synchronizationStatus === 'pending',
          ).length,
          verifiedDeletionCount: localArchive.deletionTombstones.filter(
            (tombstone) => tombstone.synchronizationStatus === 'verified',
          ).length,
          failedDeletionCount: localArchive.deletionTombstones.filter(
            (tombstone) => tombstone.synchronizationStatus === 'failed',
          ).length,
          orphanedTombstoneCount: recordActions.filter((action) => action.action === 'tombstone-orphaned').length,
          cloudDeleteAttemptedCount: recordActions.filter(
            (action) => action.action === 'delete-cloud' || action.action === 'remote-record-recreated',
          ).length,
          cloudDeleteVerifiedCount: recordActions.filter((action) => action.action === 'deletion-verified').length,
          remoteDeleteAppliedCount: recordActions.filter((action) => action.action === 'delete-local').length,
          staleResurrectionPreventedCount: recordActions.filter(
            (action) => action.action === 'remote-record-recreated',
          ).length,
          repairRestorationBlockedByTombstoneCount: recordActions.filter((action) => action.action === 'delete-cloud').length,
          generatedBondPairDeletionsPending: localArchive.deletionTombstones.filter(
            (tombstone) => tombstone.entityType === 'bonds' && tombstone.synchronizationStatus === 'pending',
          ).length,
          lastFailedEntityType:
            localArchive.deletionTombstones.find((tombstone) => tombstone.synchronizationStatus === 'failed')?.entityType ??
            null,
          lastFailedEntityId:
            sanitizeEntityId(
              localArchive.deletionTombstones.find((tombstone) => tombstone.synchronizationStatus === 'failed')?.entityId,
            ),
          lastFailedDeletionStage:
            localArchive.deletionTombstones.find((tombstone) => tombstone.synchronizationStatus === 'failed')?.lastFailedStage ??
            null,
          deletionBaselineCount: Object.keys(localSyncState?.deletionBaselines ?? {}).length,
          cloudLedgerAvailable: onlineRead.queries.deletionLedger?.status === 'Success',
          cloudLedgerRowCount: onlineArchive.deletionLedger.length,
          ledgerReadFailureCount: onlineRead.queries.deletionLedger?.status === 'Failed' ? 1 : 0,
          acknowledgedRowCount: onlineArchive.deletionLedger.filter((row) => row.acknowledged_at).length,
          compactedRowCount: onlineArchive.deletionLedger.filter((row) => row.compacted_at).length,
          sharedDeletionAuthorityCount: deletionAuthority.size,
          localTombstoneOnlyCount: [...localTombstoneKeys].filter((key) => !cloudLedgerKeys.has(key)).length,
          cloudLedgerOnlyCount: [...cloudLedgerKeys].filter((key) => !localTombstoneKeys.has(key)).length,
          combinedAuthorityCount: [...localTombstoneKeys].filter((key) => cloudLedgerKeys.has(key)).length,
          liveLocalRecordsSuppressed: liveLocalSuppressed,
          liveCloudRecordsSuppressed: liveCloudSuppressed,
          staleUploadsBlocked: recordActions.filter((action) => action.action === 'delete-local').length,
          staleImportsBlocked: recordActions.filter((action) => action.action === 'delete-cloud').length,
          repairRestorationsBlocked: recordActions.filter((action) => action.action === 'delete-cloud').length,
          contradictoryDeletionRetrievalPlanCount: contradictoryDeletionActions.length,
          liveDeletedBaselineCollisionCount: [...(localSyncState ? getDeletedBaselineKeys(localSyncState) : new Set<string>())].filter(
            (key) => localSyncState?.synchronizedFingerprints?.[key],
          ).length,
        },
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
    const hasReviewRequiredItems =
      !isLocalArchiveEmpty &&
      !isOnlineArchiveEmpty &&
      Object.values(plan.sections).some((section) => section.itemsRequiringReview > 0);
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
    const hasDeletionRetrievalActions = retrievalActions.some((action) => action.action === 'delete-local');
    const hasOnlyDeletionRetrievalActions =
      hasDeletionRetrievalActions &&
      uploadActions.length === 0 &&
      retrievalActions.every((action) => action.action === 'delete-local');
    const hasConflicts = Object.values(plan.sections).some((section) => section.conflictRecords > 0);
    const hasDeletionUploadActions = uploadActions.some(
      (action) => action.action === 'delete-cloud' || action.action === 'remote-record-recreated',
    );
    const hasDeletionFinalizationActions = recordActions.some((action) => {
      if (action.action !== 'deletion-verified') {
        return false;
      }

      return localArchive.deletionTombstones.some(
        (tombstone) =>
          tombstone.synchronizationStatus !== 'verified' &&
          deletionEntityTypeToSyncEntityType(tombstone.entityType) === action.entityType &&
          tombstone.entityId === action.id,
      );
    });
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
      hasMissingCloudDependents(liveLocalArchive, liveOnlineArchive, deletionAuthority) &&
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
        return hasDeletionUploadActions ? 'Local Changes' as const : 'Cloud Only' as const;
      }

      if (hasConflicts) {
        return 'Conflict' as const;
      }

      if (hasReviewRequiredItems) {
        return 'Review Required' as const;
      }

      if (isPartialLocalArchive) {
        return 'Partial Local Archive' as const;
      }

      if (hasLocalChanges || hasDeletionUploadActions) {
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
        ? [
            hasConflicts
              ? 'Archive Reconciliation Required. Review conflicts before synchronization.'
              : 'Archive Review Required. Review records without a verified synchronization baseline before synchronization.',
          ]
        : []),
      ...(hasCloudUpdates &&
      !hasOnlyDeletionRetrievalActions &&
      !isPartialLocalArchive &&
      selectedSynchronizationMode !== 'bidirectional'
        ? ['LoreBound Online Updates Available. Review retrieval before updating this archive.']
        : []),
      ...(isPartialLocalArchive
        ? ['Local Archive Repair Required. LoreBound Online contains additional records for this Investigation.']
        : []),
    ];
    plan.canSynchronize =
      (uploadActions.length > 0 || hasDeletionFinalizationActions || hasDeletionRetrievalActions) &&
      (sameInvestigationIdLocalAndCloud ||
        isOnlineArchiveEmpty ||
        hasDeletionUploadActions ||
        hasDeletionFinalizationActions ||
        hasDeletionRetrievalActions) &&
      !baselineState.canRebuild &&
      !isPartialLocalArchive &&
      conflictActions.length === 0 &&
      plan.blockingReasons.length === 0 &&
      plan.online.isAvailable;
    plan.canRetrieve =
      ((isLocalArchiveEmpty && !isOnlineArchiveEmpty) ||
        isPartialLocalArchive ||
        hasSafeCloudOnlyChanges ||
        hasDeletionRetrievalActions) &&
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
            : uploadActions.length > 0 || hasDeletionFinalizationActions
              ? 'Local changes waiting.'
              : 'Archive up to date.'),
        outboundGateReason:
          plan.canSynchronize
            ? 'Outbound synchronization available.'
            : plan.blockingReasons[0] ??
              (uploadActions.length === 0 && !hasDeletionFinalizationActions
                ? 'No outbound Local Archive changes detected.'
                : 'Outbound synchronization is blocked by archive safety checks.'),
        deletionDiagnostics: {
          ...plan.diagnostics.reconciliation.deletionDiagnostics!,
          crescentCityTrace: createCrescentCityDeletionTrace(
            fullLocalArchive,
            onlineRead.archive,
            localArchive,
            onlineArchive,
            deletionAuthority,
            recordActions,
            localSyncState,
            user.id,
            plan.canSynchronize,
            selectedSynchronizationMode,
            selectedArchiveAction.label,
          ),
        },
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

    const fullLocalArchive = await readFullLocalArchive();
    const activeCaseId = getPrimaryLocalCaseId(fullLocalArchive);
    const localArchive = scopeLocalArchiveToCase(fullLocalArchive, activeCaseId);
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
    const deleteCloudActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && (action.action === 'delete-cloud' || action.action === 'remote-record-recreated'))
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && (action.action === 'delete-cloud' || action.action === 'remote-record-recreated'))
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && (action.action === 'delete-cloud' || action.action === 'remote-record-recreated'))
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && (action.action === 'delete-cloud' || action.action === 'remote-record-recreated'))
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
    const deleteLocalActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
    };
    const deletionFinalizationActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && action.action === 'deletion-verified')
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && action.action === 'deletion-verified')
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && action.action === 'deletion-verified')
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && action.action === 'deletion-verified')
          .map((action) => action.id),
      ),
    };
    const uploadArchive: LocalArchiveSnapshot = {
      cases: localArchive.cases.filter((record) => uploadActionIds.cases.has(record.id)),
      dossiers: localArchive.dossiers.filter((record) => uploadActionIds.dossiers.has(record.id)),
      bonds: localArchive.bonds.filter((record) => uploadActionIds.bonds.has(record.id)),
      boardPins: localArchive.boardPins.filter((record) => uploadActionIds.boardPins.has(record.id)),
      deletionTombstones: localArchive.deletionTombstones,
      activeCaseId: localArchive.activeCaseId,
    };
    const deleteCloudTombstones = localArchive.deletionTombstones.filter((tombstone) => {
      if (tombstone.entityType === 'cases') {
        return deleteCloudActionIds.cases.has(tombstone.entityId);
      }

      if (tombstone.entityType === 'dossiers') {
        return deleteCloudActionIds.dossiers.has(tombstone.entityId);
      }

      if (tombstone.entityType === 'bonds') {
        return deleteCloudActionIds.bonds.has(tombstone.entityId);
      }

      return deleteCloudActionIds.boardPins.has(tombstone.entityId);
    });
    const deleteCloudTargetCount =
      deleteCloudActionIds.cases.size +
      deleteCloudActionIds.dossiers.size +
      deleteCloudActionIds.bonds.size +
      deleteCloudActionIds.boardPins.size;
    const deletionFinalizationTombstones = localArchive.deletionTombstones.filter((tombstone) => {
      if (tombstone.synchronizationStatus === 'verified') {
        return false;
      }

      if (tombstone.entityType === 'cases') {
        return deletionFinalizationActionIds.cases.has(tombstone.entityId);
      }

      if (tombstone.entityType === 'dossiers') {
        return deletionFinalizationActionIds.dossiers.has(tombstone.entityId);
      }

      if (tombstone.entityType === 'bonds') {
        return deletionFinalizationActionIds.bonds.has(tombstone.entityId);
      }

      return deletionFinalizationActionIds.boardPins.has(tombstone.entityId);
    });
    const totalRecords =
      uploadArchive.cases.length +
      uploadArchive.dossiers.length +
      uploadArchive.bonds.length +
      uploadArchive.boardPins.length +
      deleteCloudTargetCount +
      deletionFinalizationTombstones.length +
      deleteLocalActionIds.cases.size +
      deleteLocalActionIds.dossiers.size +
      deleteLocalActionIds.bonds.size +
      deleteLocalActionIds.boardPins.size +
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
      const localSyncStateBeforeDelete = scopeLocalSyncStateToArchive(await readLocalSyncState(), localArchive);
      let onlineArchive = scopeCloudArchiveToCase(await cloudArchiveRepository.readArchive(), activeCaseId);
      let synchronizationDeletionAuthority = expandDeletionAuthorityWithCaseDependents(
        createSharedDeletionAuthority(
          localArchive.deletionTombstones,
          onlineArchive.deletionLedger,
          localSyncStateBeforeDelete,
        ),
        localArchive,
        onlineArchive,
      );
      const deleteCloudAuthorityEntries = [...synchronizationDeletionAuthority.values()].filter((entry) =>
        hasActionId(deleteCloudActionIds, entry),
      );
      const localClientId = await readOrCreateLocalClientId();
      const deleteCloudLedgerRows = deleteCloudAuthorityEntries
        .map((entry) =>
          mapDeletionTombstoneToCloudLedgerRow(
            entry.tombstone ?? {
              id: entry.key,
              caseId: entry.caseId,
              entityType: entry.deletionEntityType,
              entityId: entry.entityId,
              deletedAt: entry.deletedAt,
              sourceClientId: localClientId,
              synchronizationStatus: 'verified',
              deletionVersion: DELETION_SYNC_VERSION,
            },
            user.id,
          ),
        );

      if (deleteCloudTargetCount > 0) {
        try {
          report('Synchronizing Investigation', `Writing ${deleteCloudLedgerRows.length} shared deletion records.`);

          if (deleteCloudLedgerRows.length > 0) {
            await cloudArchiveRepository.upsertDeletionLedger(deleteCloudLedgerRows);

            const ledgerVerifications = await Promise.all(
              deleteCloudLedgerRows.map((row) =>
                cloudArchiveRepository.verifyDeletionLedgerEntry(row.entity_type, row.entity_id),
              ),
            );

            if (ledgerVerifications.some((verified) => !verified)) {
              await Promise.all(
                deleteCloudTombstones.map((tombstone) =>
                  markDeletionTombstoneFailed(tombstone, 'Cloud deletion ledger verification'),
                ),
              );
              throw new Error('Deletion Sync Incomplete. LoreBound deleted the item locally, but shared deletion could not be fully verified. It will remain hidden locally and can be retried.');
            }
          }

          report('Synchronizing Investigation', `Deleting ${deleteCloudTargetCount} archived records from LoreBound Online.`);
          await cloudArchiveRepository.deleteBoardEntries([...deleteCloudActionIds.boardPins]);
          await cloudArchiveRepository.deleteBonds([...deleteCloudActionIds.bonds]);
          await cloudArchiveRepository.deleteDossiers([...deleteCloudActionIds.dossiers]);
          await cloudArchiveRepository.deleteCases([...deleteCloudActionIds.cases]);

          const [
            casesAbsent,
            dossiersAbsent,
            bondsAbsent,
            boardEntriesAbsent,
          ] = await Promise.all([
            cloudArchiveRepository.verifyCasesAbsent([...deleteCloudActionIds.cases]),
            cloudArchiveRepository.verifyDossiersAbsent([...deleteCloudActionIds.dossiers]),
            cloudArchiveRepository.verifyBondsAbsent([...deleteCloudActionIds.bonds]),
            cloudArchiveRepository.verifyBoardEntriesAbsent([...deleteCloudActionIds.boardPins]),
          ]);

          if (!casesAbsent || !dossiersAbsent || !bondsAbsent || !boardEntriesAbsent) {
            await Promise.all(
              deleteCloudTombstones.map((tombstone) =>
                markDeletionTombstoneFailed(tombstone, 'Cloud deletion verification'),
              ),
            );
            throw new Error('Deletion Sync Incomplete. LoreBound deleted the item locally, but shared deletion could not be fully verified. It will remain hidden locally and can be retried.');
          }

          if (deleteCloudLedgerRows.length > 0) {
            const acknowledgedAt = new Date().toISOString();

            await cloudArchiveRepository.updateDeletionLedgerAcknowledgement(
              deleteCloudLedgerRows.map((row) => ({
                ...row,
                acknowledged_at: acknowledgedAt,
                updated_at: acknowledgedAt,
              })),
            );
          }
        } catch (error) {
          await Promise.all(
            deleteCloudTombstones.map((tombstone) =>
              markDeletionTombstoneFailed(tombstone, 'Shared deletion synchronization'),
            ),
          );
          throw error;
        }

        completedRecords += deleteCloudTargetCount;
      }

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
      onlineArchive = scopeCloudArchiveToCase(await cloudArchiveRepository.readArchive(), activeCaseId);
      synchronizationDeletionAuthority = expandDeletionAuthorityWithCaseDependents(
        createSharedDeletionAuthority(
          localArchive.deletionTombstones,
          onlineArchive.deletionLedger,
          scopeLocalSyncStateToArchive(await readLocalSyncState(), localArchive),
        ),
        localArchive,
        onlineArchive,
      );

      const failedDeletion = deleteCloudTombstones.find((tombstone) => {
        if (tombstone.entityType === 'cases') {
          return onlineArchive.cases.some((record) => record.id === tombstone.entityId);
        }

        if (tombstone.entityType === 'dossiers') {
          return onlineArchive.dossiers.some((record) => record.id === tombstone.entityId);
        }

        if (tombstone.entityType === 'bonds') {
          return onlineArchive.bonds.some((record) => record.id === tombstone.entityId);
        }

        return onlineArchive.boardEntries.some((record) => record.id === tombstone.entityId);
      });

      if (failedDeletion) {
        await markDeletionTombstoneFailed(failedDeletion, 'Cloud deletion verification');
        throw new Error('Deletion Sync Incomplete. LoreBound deleted the item locally, but the deletion has not reached your other devices yet.');
      }

      await markDeletionTombstonesVerified(deleteCloudTombstones);
      await markDeletionTombstonesVerified(deletionFinalizationTombstones);
      completedRecords += deletionFinalizationTombstones.length;
      this.verifyOnlineArchive(uploadArchive, onlineArchive, user.id);
      const uploadedGeneratedBondCounts = countGeneratedBondsByRole(uploadArchive.bonds);
      const uploadedGeneratedBondIds = new Set(
        uploadArchive.bonds.filter(isGeneratedBondRecord).map((record) => record.id),
      );
      const uploadedGeneratedCloudRecords = onlineArchive.bonds.filter((record) =>
        uploadedGeneratedBondIds.has(record.id),
      );
      recordThreadmarkSynchronizationDiagnostics({
        generatedBondsUploaded: uploadedGeneratedBondCounts.total,
        generatedBondsVerifiedInCloud: uploadedGeneratedCloudRecords.length,
        generatedMetadataPreserved:
          generatedMetadataPreserved(uploadArchive.bonds) &&
          generatedMetadataPreserved(uploadedGeneratedCloudRecords),
        desiredForwardCount: uploadedGeneratedBondCounts.forward,
        desiredInverseCount: uploadedGeneratedBondCounts.inverse,
        lastFailedStage: 'None',
      });
      completeStage('Verifying Investigation');
      let synchronizedArchive = localArchive;

      if (
        retrievalActionIds.cases.size > 0 ||
        retrievalActionIds.dossiers.size > 0 ||
        retrievalActionIds.bonds.size > 0 ||
        retrievalActionIds.boardPins.size > 0 ||
        deleteLocalActionIds.cases.size > 0 ||
        deleteLocalActionIds.dossiers.size > 0 ||
        deleteLocalActionIds.bonds.size > 0 ||
        deleteLocalActionIds.boardPins.size > 0
      ) {
        report('Retrieving Investigations', 'Retrieving safe LoreBound Online updates.');
        const retrievedCases = await restoreCaseImages(
          onlineArchive.cases
            .filter((record) => !hasDeletionAuthority(synchronizationDeletionAuthority, 'cases', record.id))
            .filter((record) => retrievalActionIds.cases.has(record.id))
            .map(mapCloudCaseToLocal),
          onlineArchive.cases,
        );
        completeStage('Retrieving Investigations');
        report('Retrieving Dossiers', 'Retrieving safe Dossier updates.');
        const retrievedDossiers = await restoreDossierImages(
          onlineArchive.dossiers
            .filter((record) => !hasDeletionAuthority(synchronizationDeletionAuthority, 'dossiers', record.id))
            .filter((record) => retrievalActionIds.dossiers.has(record.id))
            .map(mapCloudDossierToLocal),
          onlineArchive.dossiers,
        );
        completeStage('Retrieving Dossiers');
        report('Retrieving Bonds', 'Retrieving safe Bond updates.');
        const retrievedBonds = onlineArchive.bonds
          .filter((record) => !hasDeletionAuthority(synchronizationDeletionAuthority, 'bonds', record.id))
          .filter((record) => retrievalActionIds.bonds.has(record.id))
          .map(mapCloudBondToLocal);
        const retrievedGeneratedBondCounts = countGeneratedBondsByRole(retrievedBonds);
        recordThreadmarkSynchronizationDiagnostics({
          generatedBondsRetrieved: retrievedGeneratedBondCounts.total,
          generatedMetadataPreserved: generatedMetadataPreserved(retrievedBonds),
          desiredForwardCount: retrievedGeneratedBondCounts.forward,
          desiredInverseCount: retrievedGeneratedBondCounts.inverse,
          lastFailedStage: 'None',
        });
        completeStage('Retrieving Bonds');
        report('Retrieving Evidence Pins', 'Retrieving safe Evidence Board updates.');
        const retrievedBoardPins = onlineArchive.boardEntries
          .filter((record) => !hasDeletionAuthority(synchronizationDeletionAuthority, 'boardEntries', record.id))
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
        deleteLocalActionIds.cases.forEach((id) => casesById.delete(id));
        deleteLocalActionIds.dossiers.forEach((id) => dossiersById.delete(id));
        deleteLocalActionIds.bonds.forEach((id) => bondsById.delete(id));
        deleteLocalActionIds.boardPins.forEach((id) => boardPinsById.delete(id));
        synchronizedArchive = {
          cases: [...casesById.values()],
          dossiers: [...dossiersById.values()],
          bonds: [...bondsById.values()],
          boardPins: [...boardPinsById.values()],
          deletionTombstones: localArchive.deletionTombstones,
          activeCaseId: localArchive.activeCaseId,
        };
        await importFullLocalArchive(
          mergeScopedArchiveIntoFullArchive(fullLocalArchive, synchronizedArchive, activeCaseId),
        );
        completedRecords +=
          retrievedCases.length +
          retrievedDossiers.length +
          retrievedBonds.length +
          retrievedBoardPins.length +
          deleteLocalActionIds.cases.size +
          deleteLocalActionIds.dossiers.size +
          deleteLocalActionIds.bonds.size +
          deleteLocalActionIds.boardPins.size;
        notifyLocalArchiveRestored();
      }

      this.verifyOnlineArchive(synchronizedArchive, onlineArchive, user.id);
      report('Verifying Stored Images', 'Verifying secured stored images.');
      await verifyPreparedImages(imagePreparation.preparedImages);
      completeStage('Verifying Stored Images');
      report('Finalizing Investigation', 'Recording the local synchronization marker.');
      const cloudImagePaths = getCloudImagePaths(onlineArchive);
      const verifiedDeletionTombstoneIds = new Set([
        ...deleteCloudTombstones.map((tombstone) => tombstone.id),
        ...deletionFinalizationTombstones.map((tombstone) => tombstone.id),
      ]);
      const synchronizedDeletionTombstones = synchronizedArchive.deletionTombstones.map((tombstone) =>
        verifiedDeletionTombstoneIds.has(tombstone.id)
          ? {
              ...tombstone,
              synchronizationStatus: 'verified' as const,
              verifiedAt: new Date().toISOString(),
              lastFailedStage: undefined,
            }
          : tombstone,
      );
      const nextSyncState: LocalSyncState = {
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: createBaselineRecordIds(synchronizedArchive),
        synchronizedUpdatedAt: createBaselineUpdatedAt(synchronizedArchive),
        synchronizedFingerprints: createLocalFingerprintSnapshot(synchronizedArchive, cloudImagePaths),
        deletionBaselines: {
          ...createDeletionBaselineEntries(synchronizedDeletionTombstones),
          ...createRemoteDeletionBaselineEntries(deleteLocalActionIds),
          ...createDeletionBaselineEntriesFromAuthority(synchronizationDeletionAuthority),
        },
        cloudImagePaths,
        synchronizationVersion: 1,
      };
      await recordLocalSyncState(mergeLocalSyncState(await readLocalSyncState(), nextSyncState, synchronizedArchive));
      completeStage('Finalizing Investigation');

      const result: SyncResult = {
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
      notifySynchronizationCompleted(result);

      return result;
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

  async retrieveCase(caseId: string, onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
    const user = await authService.getCurrentUser();

    if (!user) {
      return {
        ok: false,
        message: 'Investigator Connect is required before retrieving this Investigation.',
        counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
        completedStages: [],
      };
    }

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
      const fullLocalArchive = await readFullLocalArchive();
      const onlineArchive = await cloudArchiveRepository.readArchive();
      const localSyncState = await readLocalSyncState();
      const deletionAuthority = createSharedDeletionAuthority(
        fullLocalArchive.deletionTombstones,
        onlineArchive.deletionLedger,
        localSyncState,
      );

      if (hasDeletionAuthority(deletionAuthority, 'cases', caseId)) {
        throw new Error('This Investigation has been deleted from LoreBound Online.');
      }

      const cloudCase = onlineArchive.cases.find((record) => record.id === caseId && record.user_id === user.id);

      if (!cloudCase) {
        throw new Error('LoreBound Online could not find this Investigation for the connected Investigator Profile.');
      }

      const caseOnlineArchive = scopeCloudArchiveToCase(onlineArchive, caseId);
      const caseDeletionAuthority = expandDeletionAuthorityWithCaseDependents(
        deletionAuthority,
        fullLocalArchive,
        onlineArchive,
      );
      const liveOnlineArchive = {
        ...caseOnlineArchive,
        cases: filterRecordsByDeletionAuthority(caseOnlineArchive.cases, 'cases', caseDeletionAuthority),
        dossiers: filterRecordsByDeletionAuthority(caseOnlineArchive.dossiers, 'dossiers', caseDeletionAuthority),
        bonds: filterRecordsByDeletionAuthority(caseOnlineArchive.bonds, 'bonds', caseDeletionAuthority),
        boardEntries: filterRecordsByDeletionAuthority(caseOnlineArchive.boardEntries, 'boardEntries', caseDeletionAuthority),
      };

      report('Retrieving Investigations', 'Retrieving selected Investigation record.');
      const casesWithoutImages = liveOnlineArchive.cases.map(mapCloudCaseToLocal);
      completeStage('Retrieving Investigations');
      report('Retrieving Dossiers', `${liveOnlineArchive.dossiers.length} Dossier records.`);
      const dossiersWithoutImages = liveOnlineArchive.dossiers.map(mapCloudDossierToLocal);
      completeStage('Retrieving Dossiers');
      report('Retrieving Stored Images', 'Retrieving stored images from LoreBound Online.');
      const [cases, dossiers] = await Promise.all([
        restoreCaseImages(casesWithoutImages, liveOnlineArchive.cases),
        restoreDossierImages(dossiersWithoutImages, liveOnlineArchive.dossiers),
      ]);
      completeStage('Retrieving Stored Images');
      report('Retrieving Bonds', `${liveOnlineArchive.bonds.length} Bond records.`);
      const bonds = liveOnlineArchive.bonds.map(mapCloudBondToLocal);
      completeStage('Retrieving Bonds');
      report('Retrieving Evidence Pins', `${liveOnlineArchive.boardEntries.length} Evidence Pin records.`);
      const boardPins = liveOnlineArchive.boardEntries.map(mapCloudBoardEntryToLocal);
      completeStage('Retrieving Evidence Pins');

      const retrievedArchive: LocalArchiveSnapshot = {
        cases,
        dossiers,
        bonds,
        boardPins,
        deletionTombstones: fullLocalArchive.deletionTombstones.filter(
          (tombstone) =>
            tombstone.caseId === caseId ||
            (tombstone.entityType === 'cases' && tombstone.entityId === caseId),
        ),
        activeCaseId: caseId,
      };
      await importFullLocalArchive(
        mergeScopedArchiveIntoFullArchive(fullLocalArchive, retrievedArchive, caseId),
      );
      report('Verifying Local Archive', 'Verifying retrieved Investigation records.');
      const verifiedLocalArchive = scopeLocalArchiveToCase(await readFullLocalArchive(), caseId);

      if (verifiedLocalArchive.cases.length !== retrievedArchive.cases.length) {
        throw new Error('Retrieve Investigation could not be verified.');
      }

      validateDependencies(verifiedLocalArchive).forEach((reason) => {
        throw new Error(reason);
      });
      completeStage('Verifying Local Archive');
      report('Finalizing Investigation', 'Recording local synchronization marker.');
      const cloudImagePaths = getCloudImagePaths(liveOnlineArchive);
      const nextSyncState: LocalSyncState = {
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: createBaselineRecordIds(retrievedArchive),
        synchronizedUpdatedAt: createBaselineUpdatedAt(retrievedArchive),
        synchronizedFingerprints: createLocalFingerprintSnapshot(retrievedArchive, cloudImagePaths),
        deletionBaselines: {
          ...createDeletionBaselineEntries(retrievedArchive.deletionTombstones),
          ...createDeletionBaselineEntriesFromAuthority(caseDeletionAuthority),
        },
        cloudImagePaths,
        synchronizationVersion: 1,
      };
      await recordLocalSyncState(mergeLocalSyncState(await readLocalSyncState(), nextSyncState, retrievedArchive));
      completeStage('Finalizing Investigation');
      notifyLocalArchiveRestored();

      const result: SyncResult = {
        ok: true,
        message: 'Investigation Retrieved',
        counts: {
          cases: retrievedArchive.cases.length,
          dossiers: retrievedArchive.dossiers.length,
          bonds: retrievedArchive.bonds.length,
          boardEntries: retrievedArchive.boardPins.length,
        },
        completedStages,
        completedAt: new Date().toISOString(),
      };
      notifySynchronizationCompleted(result);

      return result;
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
      const fullLocalArchive = await readFullLocalArchive();
      const activeCaseId = getPrimaryLocalCaseId(fullLocalArchive);
      const localArchive = scopeLocalArchiveToCase(fullLocalArchive, activeCaseId);
      const onlineArchive = scopeCloudArchiveToCase(await cloudArchiveRepository.readArchive(), activeCaseId);
      const localSyncState = scopeLocalSyncStateToArchive(await readLocalSyncState(), localArchive);
      const deletionAuthority = expandDeletionAuthorityWithCaseDependents(
        createSharedDeletionAuthority(
          localArchive.deletionTombstones,
          onlineArchive.deletionLedger,
          localSyncState,
        ),
        localArchive,
        onlineArchive,
      );
      const liveLocalArchive = {
        ...localArchive,
        cases: filterRecordsByDeletionAuthority(localArchive.cases, 'cases', deletionAuthority),
        dossiers: filterRecordsByDeletionAuthority(localArchive.dossiers, 'dossiers', deletionAuthority),
        bonds: filterRecordsByDeletionAuthority(localArchive.bonds, 'bonds', deletionAuthority),
        boardPins: filterRecordsByDeletionAuthority(localArchive.boardPins, 'boardEntries', deletionAuthority),
      };
      const liveOnlineArchive = {
        ...onlineArchive,
        cases: filterRecordsByDeletionAuthority(onlineArchive.cases, 'cases', deletionAuthority),
        dossiers: filterRecordsByDeletionAuthority(onlineArchive.dossiers, 'dossiers', deletionAuthority),
        bonds: filterRecordsByDeletionAuthority(onlineArchive.bonds, 'bonds', deletionAuthority),
        boardEntries: filterRecordsByDeletionAuthority(onlineArchive.boardEntries, 'boardEntries', deletionAuthority),
      };
      const cloudImagePaths = getCloudImagePaths(liveOnlineArchive);
      const localFingerprints = createLocalFingerprintSnapshot(liveLocalArchive, cloudImagePaths);
      const cloudFingerprints = createCloudFingerprintSnapshot(liveOnlineArchive);
      const baselineState = getBaselineState(
        liveLocalArchive,
        liveOnlineArchive,
        localSyncState,
        user.id,
        localFingerprints,
        cloudFingerprints,
      );

      if (!baselineState.canRebuild) {
        throw new Error(baselineState.reason);
      }

      validateDependencies(liveLocalArchive).forEach((reason) => {
        throw new Error(reason);
      });
      completeStage('Verifying Investigation');
      report('Finalizing Investigation', 'Recording the verified synchronization baseline.');
      const nextSyncState: LocalSyncState = {
        investigatorId: user.id,
        lastSuccessfulSynchronizationAt: new Date().toISOString(),
        synchronizedRecordIds: createBaselineRecordIds(liveLocalArchive),
        synchronizedUpdatedAt: createBaselineUpdatedAt(liveLocalArchive),
        synchronizedFingerprints: localFingerprints,
        deletionBaselines: {
          ...createDeletionBaselineEntries(liveLocalArchive.deletionTombstones),
          ...createDeletionBaselineEntriesFromAuthority(deletionAuthority),
        },
        cloudImagePaths,
        synchronizationVersion: 1,
      };
      await recordLocalSyncState(mergeLocalSyncState(await readLocalSyncState(), nextSyncState, liveLocalArchive));
      completeStage('Finalizing Investigation');

      const result: SyncResult = {
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
      notifySynchronizationCompleted(result);

      return result;
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
    const retrieveDeleteLocalActionIds = {
      cases: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'cases' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      dossiers: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'dossiers' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      bonds: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'bonds' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
      boardPins: new Set(
        planResult.plan.diagnostics.reconciliation.recordActions
          .filter((action) => action.entityType === 'boardEntries' && action.action === 'delete-local')
          .map((action) => action.id),
      ),
    };
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
      const fullLocalArchive = await readFullLocalArchive();
      const activeCaseId = getPrimaryLocalCaseId(fullLocalArchive);
      const localArchive = scopeLocalArchiveToCase(fullLocalArchive, activeCaseId);
      const onlineArchive = scopeCloudArchiveToCase(await cloudArchiveRepository.readArchive(), activeCaseId);
      const localSyncState = scopeLocalSyncStateToArchive(await readLocalSyncState(), localArchive);
      const deletionAuthority = expandDeletionAuthorityWithCaseDependents(
        createSharedDeletionAuthority(
          localArchive.deletionTombstones,
          onlineArchive.deletionLedger,
          localSyncState,
        ),
        localArchive,
        onlineArchive,
      );
      const liveLocalArchive = {
        ...localArchive,
        cases: filterRecordsByDeletionAuthority(localArchive.cases, 'cases', deletionAuthority),
        dossiers: filterRecordsByDeletionAuthority(localArchive.dossiers, 'dossiers', deletionAuthority),
        bonds: filterRecordsByDeletionAuthority(localArchive.bonds, 'bonds', deletionAuthority),
        boardPins: filterRecordsByDeletionAuthority(localArchive.boardPins, 'boardEntries', deletionAuthority),
      };
      const liveOnlineArchive = {
        ...onlineArchive,
        cases: filterRecordsByDeletionAuthority(onlineArchive.cases, 'cases', deletionAuthority),
        dossiers: filterRecordsByDeletionAuthority(onlineArchive.dossiers, 'dossiers', deletionAuthority),
        bonds: filterRecordsByDeletionAuthority(onlineArchive.bonds, 'bonds', deletionAuthority),
        boardEntries: filterRecordsByDeletionAuthority(onlineArchive.boardEntries, 'boardEntries', deletionAuthority),
      };

      if (isRepair) {
        const localCaseId = getPrimaryLocalCaseId(localArchive);
        const cloudCaseId = getPrimaryCloudCaseId(liveOnlineArchive);

        if (!user || !cloudCaseId || (!isEmptyShellRepair && localCaseId !== cloudCaseId)) {
          throw new Error('Repair Local Archive could not verify matching Investigation ownership.');
        }

        if (isEmptyShellRepair && liveOnlineArchive.cases[0]?.user_id !== user.id) {
          throw new Error('Repair Local Archive could not verify Investigation ownership.');
        }
      }

      report('Retrieving Investigations', `${liveOnlineArchive.cases.length} Investigation records.`);
      const casesWithoutImages = liveOnlineArchive.cases.map(mapCloudCaseToLocal);
      completeStage('Retrieving Investigations');
      report('Retrieving Dossiers', `${liveOnlineArchive.dossiers.length} Dossier records.`);
      const dossiersWithoutImages = liveOnlineArchive.dossiers.map(mapCloudDossierToLocal);
      completeStage('Retrieving Dossiers');
      report('Retrieving Stored Images', 'Retrieving stored images from LoreBound Online.');
      const [cases, dossiers] = await Promise.all([
        restoreCaseImages(casesWithoutImages, liveOnlineArchive.cases),
        restoreDossierImages(dossiersWithoutImages, liveOnlineArchive.dossiers),
      ]);
      completeStage('Retrieving Stored Images');
      report('Retrieving Bonds', `${liveOnlineArchive.bonds.length} Bond records.`);
      const bonds = liveOnlineArchive.bonds.map(mapCloudBondToLocal);
      const retrievedGeneratedBondCounts = countGeneratedBondsByRole(bonds);
      recordThreadmarkSynchronizationDiagnostics({
        generatedBondsRetrieved: retrievedGeneratedBondCounts.total,
        generatedMetadataPreserved: generatedMetadataPreserved(bonds),
        desiredForwardCount: retrievedGeneratedBondCounts.forward,
        desiredInverseCount: retrievedGeneratedBondCounts.inverse,
        lastFailedStage: 'None',
      });
      completeStage('Retrieving Bonds');
      report('Retrieving Evidence Pins', `${liveOnlineArchive.boardEntries.length} Evidence Pin records.`);
      const boardPins = liveOnlineArchive.boardEntries.map(mapCloudBoardEntryToLocal);
      completeStage('Retrieving Evidence Pins');
      const repairedArchive =
        isRepair && !isEmptyShellRepair
          ? mergePartialRepairArchive(liveLocalArchive, { cases, dossiers, bonds, boardPins })
          : {
              cases,
              dossiers,
              bonds,
              boardPins,
              deletionTombstones: localArchive.deletionTombstones,
              activeCaseId: cases[0]?.id ?? null,
            };

      if (isEmptyShellRepair) {
        const shellCaseId = localArchive.cases[0]?.id;

        if (!shellCaseId) {
          throw new Error('Repair Local Archive could not find the empty local Investigation shell.');
        }

        await replaceEmptyCaseShellWithCloudArchive(shellCaseId, repairedArchive);
      } else {
        await importFullLocalArchive(
          mergeScopedArchiveIntoFullArchive(fullLocalArchive, repairedArchive, activeCaseId),
        );
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
          liveOnlineArchive.cases
            .filter((record) => record.cover_image_cloud_path)
            .map((record) => [record.id, record.cover_image_cloud_path as string]),
        ),
        dossiers: Object.fromEntries(
          liveOnlineArchive.dossiers
            .filter((record) => record.cover_image_cloud_path)
            .map((record) => [record.id, record.cover_image_cloud_path as string]),
        ),
      };

      if (user) {
        const nextSyncState: LocalSyncState = {
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
          deletionBaselines: {
            ...createDeletionBaselineEntries(repairedArchive.deletionTombstones),
            ...createRemoteDeletionBaselineEntries(retrieveDeleteLocalActionIds),
            ...createDeletionBaselineEntriesFromAuthority(deletionAuthority),
          },
          cloudImagePaths,
          synchronizationVersion: 1,
        };
        await recordLocalSyncState(mergeLocalSyncState(await readLocalSyncState(), nextSyncState, repairedArchive));
      }
      completeStage('Finalizing Investigation');
      notifyLocalArchiveRestored();

      const result: SyncResult = {
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
      notifySynchronizationCompleted(result);

      return result;
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

      const localFingerprint = fingerprint(normalizeBondContent(record));
      const cloudFingerprint = fingerprint(normalizeBondContent(onlineRecord));

      if (localFingerprint !== cloudFingerprint) {
        throw new Error('Unable to verify synchronized Bond metadata.');
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
