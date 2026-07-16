import type {
  Bond,
  BondFormValues,
  ThreadmarkBondMetadata,
  ThreadmarkBondRole,
} from '../cases/types/bondTypes';
import type { Dossier, DossierSection } from '../cases/types/dossierTypes';
import type { ThreadmarkResolutionResult } from './threadmarkResolverTypes';

export const THREADMARK_RECONCILIATION_VERSION = 1;

export type ThreadmarkReconciliationConflictCode =
  | 'manual-bond-satisfies-threadmark'
  | 'manual-bond-conflict'
  | 'generated-bond-id-conflict'
  | 'unsupported-threadmark'
  | 'unresolved-threadmark'
  | 'inverse-context-required';

export type ThreadmarkReconciliationConflict = Readonly<{
  code: ThreadmarkReconciliationConflictCode;
  severity: 'info' | 'warning' | 'error';
  message: string;
  ownerId?: string;
  relationshipKey?: string;
  sourceDossierId?: string;
  targetDossierId?: string;
  bondId?: string;
}>;

export type ThreadmarkDesiredBond = Readonly<{
  id: string;
  ownerId: string;
  pairId: string;
  role: ThreadmarkBondRole;
  formValues: BondFormValues;
  metadata: ThreadmarkBondMetadata;
  resolution: ThreadmarkResolutionResult;
}>;

export type ThreadmarkReconciliationAction =
  | Readonly<{ type: 'create'; desired: ThreadmarkDesiredBond }>
  | Readonly<{ type: 'update'; bond: Bond; desired: ThreadmarkDesiredBond }>
  | Readonly<{ type: 'remove'; bond: Bond; reason: 'source-threadmark-removed' | 'unsupported-generated-bond' }>;

export type ThreadmarkReconciliationPlan = Readonly<{
  sourceDossierId: string;
  desired: readonly ThreadmarkDesiredBond[];
  generated: readonly Bond[];
  create: readonly ThreadmarkDesiredBond[];
  update: readonly Readonly<{ bond: Bond; desired: ThreadmarkDesiredBond }>[];
  remove: readonly Bond[];
  conflicts: readonly ThreadmarkReconciliationConflict[];
  actions: readonly ThreadmarkReconciliationAction[];
  summary: ThreadmarkReconciliationSummary;
}>;

export type ThreadmarkReconciliationSummary = Readonly<{
  desiredCount: number;
  generatedCount: number;
  createCount: number;
  updateCount: number;
  removeCount: number;
  conflictCount: number;
  unresolvedCount: number;
}>;

export type ThreadmarkReconciliationDiagnostics = Readonly<{
  reconciliationVersion: number;
  reconciliationAvailable: boolean;
  mostRecentSourceDossierId: string | null;
  mostRecentSectionCount: number;
  mostRecentResolvedThreadmarkCount: number;
  desiredBondCount: number;
  generatedBondCount: number;
  createActionCount: number;
  updateActionCount: number;
  removeActionCount: number;
  conflictCount: number;
  unresolvedThreadmarkCount: number;
  executionFailureCount: number;
}>;

export type ThreadmarkReconciliationRequest = Readonly<{
  sourceDossier: Dossier;
  sections: readonly DossierSection[];
  dossiers: readonly Dossier[];
  bonds: readonly Bond[];
}>;

export type ThreadmarkReconciliationExecutor = Readonly<{
  createBond: (values: BondFormValues) => Promise<Bond>;
  updateBond: (id: string, values: BondFormValues) => Promise<Bond>;
  deleteBond: (id: string) => Promise<void>;
}>;

export type ThreadmarkReconciliationExecutionResult = Readonly<{
  plan: ThreadmarkReconciliationPlan;
  created: readonly Bond[];
  updated: readonly Bond[];
  removed: readonly Bond[];
}>;
