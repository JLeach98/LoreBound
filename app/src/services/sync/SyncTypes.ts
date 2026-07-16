import type { BoardPin } from '../../features/cases/types/boardTypes';
import type { Bond } from '../../features/cases/types/bondTypes';
import type { LoreCase } from '../../features/cases/types/caseTypes';
import type { Dossier } from '../../features/cases/types/dossierTypes';

export type LocalArchiveSnapshot = {
  cases: LoreCase[];
  dossiers: Dossier[];
  bonds: Bond[];
  boardPins: BoardPin[];
  activeCaseId: string | null;
};

export type CloudArchiveSnapshot = {
  cases: CloudCaseRow[];
  dossiers: CloudDossierRow[];
  bonds: CloudBondRow[];
  boardEntries: CloudBoardEntryRow[];
};

export type CloudQueryStatus = {
  status: 'Success' | 'Failed';
  code?: string;
  message?: string;
  httpStatus?: number | null;
};

export type SyncDiagnostics = {
  localSource: string;
  localDatabaseName: string;
  localDatabaseVersion: number;
  localObjectStores: string[];
  localInvestigationsRead: number;
  localDossiersRead: number;
  localBondsRead: number;
  localEvidencePinsRead: number;
  cloudQueries: {
    cases: CloudQueryStatus;
    dossiers: CloudQueryStatus;
    bonds: CloudQueryStatus;
    boardEntries: CloudQueryStatus;
  };
  storage: {
    bucketReachable: boolean;
    localImagesExtracted: number;
    imagesPrepared: number;
    imageUploadsSucceeded: number;
    imageUploadsFailed: number;
    storageVerificationSucceeded: number;
  };
  reconciliation: {
    baselineMetadataPresent: boolean;
    invalidIds: number;
    timestampParseFailures: number;
    fingerprintMismatches: number;
    automaticGateReason: string;
  };
  archiveState: {
    classification:
      | 'Empty'
      | 'Complete Local Archive'
      | 'Partial Local Archive'
      | 'Cloud Only'
      | 'Matching'
      | 'Local Changes'
      | 'Cloud Updates Available'
      | 'Conflict'
      | 'Corrupt or Invalid';
    activeInvestigationIdPresent: boolean;
    sameInvestigationIdLocalAndCloud: boolean;
    localCaseStableId: string | null;
    cloudCaseStableId: string | null;
    caseNormalizedMatch: boolean;
    retrievalEligibility: 'Available' | 'Blocked';
    retrievalBlockReason: string;
    actionEnabled: boolean;
    disabledReason: string;
    handlerPresent: boolean;
    repairEligibility: 'Available' | 'Blocked';
    repairStage: string;
    selectedAction: string;
    selectedActionReason: string;
    localImageReferences: number;
    cloudImageReferences: number;
  };
};

export type SyncEntityType = 'cases' | 'dossiers' | 'bonds' | 'boardEntries';

export type SyncStage =
  | 'Preparing Archive'
  | 'Preparing Stored Images'
  | 'Securing Stored Images'
  | 'Synchronizing Investigation'
  | 'Synchronizing Evidence Files'
  | 'Synchronizing Connections'
  | 'Synchronizing Evidence Board'
  | 'Verifying Investigation'
  | 'Verifying Stored Images'
  | 'Finalizing Investigation'
  | 'Retrieving Investigations'
  | 'Retrieving Dossiers'
  | 'Retrieving Stored Images'
  | 'Retrieving Bonds'
  | 'Retrieving Evidence Pins'
  | 'Verifying Local Archive';

export type SyncPlanSection = {
  newRecords: number;
  existingRecords: number;
  unchangedRecords: number;
  updatedRecords: number;
  cloudUpdatesAvailable: number;
  conflictRecords: number;
  unsupportedRecords: number;
  invalidRecords: number;
  itemsRequiringReview: number;
  localOnly: number;
  onlineOnly: number;
  matchingIds: number;
  localNewer: number;
  onlineNewer: number;
  conflicts: number;
  requiresReview: number;
  sameTimestampDifferingContents: number;
};

export type SyncPlan = {
  local: {
    investigationName: string | null;
    caseCount: number;
    dossierCount: number;
    bondCount: number;
    boardEntryCount: number;
    localImageCount: number;
    estimatedTransferBytes: number;
  };
  online: {
    isAvailable: boolean;
    caseCount: number;
    dossierCount: number;
    bondCount: number;
    boardEntryCount: number;
  };
  sections: Record<SyncEntityType, SyncPlanSection>;
  canSynchronize: boolean;
  canRetrieve: boolean;
  isLocalArchiveEmpty: boolean;
  isOnlineArchiveEmpty: boolean;
  lastSynchronizedAt: string | null;
  blockingReasons: string[];
  imageStatus: {
    readyToSynchronize: number;
    awaitingStorageSetup: number;
    couldNotProcess: number;
    message: string;
  };
  imagePaths: {
    cases: Record<string, string>;
    dossiers: Record<string, string>;
  };
  diagnostics: SyncDiagnostics;
};

export type SyncProgress = {
  stage: SyncStage;
  detail: string;
  completedStages: SyncStage[];
  completedImages: number;
  completedRecords: number;
  remainingRecords: number;
};

export type SyncResult = {
  ok: boolean;
  message: string;
  counts: {
    cases: number;
    dossiers: number;
    bonds: number;
    boardEntries: number;
    images?: number;
  };
  failedStage?: SyncStage;
  completedStages?: SyncStage[];
  itemsRequiringReview?: number;
  transferSize?: number;
  completedAt?: string;
};

export function getSyncPlanArchiveAction(plan: SyncPlan) {
  const totals = Object.values(plan.sections).reduce(
    (accumulator, section) => ({
      localOnly: accumulator.localOnly + section.localOnly,
      cloudOnly: accumulator.cloudOnly + section.onlineOnly,
      localNewer: accumulator.localNewer + section.localNewer,
      cloudNewer: accumulator.cloudNewer + section.onlineNewer,
      conflicts: accumulator.conflicts + section.conflictRecords,
      requiresReview: accumulator.requiresReview + section.itemsRequiringReview,
    }),
    {
      localOnly: 0,
      cloudOnly: 0,
      localNewer: 0,
      cloudNewer: 0,
      conflicts: 0,
      requiresReview: 0,
    },
  );
  const hasLocalChanges = totals.localOnly > 0 || totals.localNewer > 0;
  const hasCloudChanges = totals.cloudOnly > 0 || totals.cloudNewer > 0;

  if (plan.diagnostics.archiveState.classification === 'Partial Local Archive') {
    return {
      kind: 'repair-local-archive' as const,
      label: 'Repair Local Archive',
      loadingLabel: 'Repairing Local Archive',
      reason: 'The Local Archive is missing records that exist in LoreBound Online.',
      canRun: plan.canRetrieve,
    };
  }

  if (totals.conflicts > 0) {
    return {
      kind: 'review' as const,
      label: 'Review Conflicts',
      reason: 'Conflicting records require review.',
      canRun: false,
    };
  }

  if (totals.requiresReview > 0) {
    return {
      kind: 'review' as const,
      label: 'Review Required Items',
      reason: 'Some records need review before synchronization.',
      canRun: false,
    };
  }

  if (hasLocalChanges && !hasCloudChanges) {
    return {
      kind: 'sync' as const,
      label: 'Update Investigation',
      reason: 'Only this Local Archive has changes.',
      canRun: plan.canSynchronize,
    };
  }

  if (hasCloudChanges && !hasLocalChanges) {
    return {
      kind: 'retrieve' as const,
      label: 'Retrieve Updates',
      reason: 'LoreBound Online contains updates missing from this Local Archive.',
      canRun: plan.canRetrieve,
    };
  }

  if (hasLocalChanges && hasCloudChanges) {
    return {
      kind: 'review' as const,
      label: 'Reconcile Archive',
      reason: 'Both Local Archive and LoreBound Online contain safe changes.',
      canRun: false,
    };
  }

  return {
    kind: 'close' as const,
    label: 'Close',
    reason: 'All meaningful records match.',
    canRun: true,
  };
}

export type CloudCaseRow = {
  id: string;
  user_id: string;
  name: string;
  universe_type: string;
  cover_image_local_value: string | null;
  cover_image_cloud_path: string | null;
  author_or_creator: string | null;
  description: string | null;
  date_last_opened: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CloudDossierRow = {
  id: string;
  user_id: string;
  case_id: string;
  dossier_type: string;
  name: string;
  cover_image_local_value: string | null;
  cover_image_cloud_path: string | null;
  summary: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CloudBondRow = {
  id: string;
  user_id: string;
  case_id: string;
  source_dossier_id: string;
  target_dossier_id: string;
  bond_type: string;
  bond_behavior: string;
  source_label: string | null;
  target_label: string | null;
  status: string | null;
  notes: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CloudBoardEntryRow = {
  id: string;
  user_id: string;
  case_id: string;
  dossier_id: string;
  board_order: number;
  position_x: number;
  position_y: number;
  rotation: number;
  scale: number;
  z_index: number;
  date_pinned: string;
  created_at: string;
  updated_at: string;
};
