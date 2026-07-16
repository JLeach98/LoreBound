import type { DossierType } from '../cases/types/dossierTypes';
import type { ThreadmarkParseResult } from './threadmarkParserTypes';
import type { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';

export const THREADMARK_RESOLVER_VERSION = 1;

export type ThreadmarkResolutionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'missing-target'
  | 'unknown-threadmark'
  | 'incompatible-target'
  | 'invalid-source'
  | 'self-reference-disallowed'
  | 'target-unavailable'
  | 'deprecated-threadmark'
  | 'malformed'
  | 'skipped';

export type ThreadmarkResolutionMatchMethod =
  | 'selected-id'
  | 'exact-name'
  | 'exact-alias'
  | 'case-insensitive-name'
  | 'case-insensitive-alias'
  | 'none';

export type ThreadmarkResolutionConfidence =
  | 'selected'
  | 'exact'
  | 'ambiguous'
  | 'none';

export type ThreadmarkResolutionCandidate = Readonly<{
  dossierId: string;
  displayName: string;
  knowledgeType: DossierType;
  distinguishingMetadata?: string;
}>;

export type ThreadmarkResolutionDiagnostic = Readonly<{
  code:
    | 'resolved-by-selected-id'
    | 'resolved-by-name'
    | 'resolved-by-alias'
    | 'target-query-missing'
    | 'threadmark-unknown'
    | 'target-incompatible'
    | 'source-incompatible'
    | 'self-reference'
    | 'target-unavailable'
    | 'target-ambiguous'
    | 'target-unresolved'
    | 'display-name-changed'
    | 'candidate-invalid'
    | 'occurrence-skipped';
  severity: 'info' | 'warning' | 'error';
  message: string;
}>;

export type ThreadmarkPriorResolution = Readonly<{
  targetDossierId: string;
  lastKnownDisplayName?: string;
}>;

export type ThreadmarkResolutionSelection = Readonly<{
  occurrenceStartOffset: number;
  occurrenceEndOffset: number;
  selectedTargetDossierId: string;
  selectedDisplayName?: string;
  relationshipKey?: string;
  sourceDossierId?: string;
  sectionId?: string;
}>;

export type ThreadmarkResolutionRequest = Readonly<{
  occurrence: ThreadmarkParseResult;
  sourceDossierId: string;
  sourceKnowledgeType: DossierType | string;
  activeInvestigationId: string;
  dossiers: readonly ThreadmarkResolutionDossierCandidate[];
  selectedTargetDossierId?: string;
  selectedDisplayName?: string;
  priorResolution?: ThreadmarkPriorResolution;
}>;

export type ThreadmarkResolutionDossierCandidate = Readonly<{
  id: string;
  caseId: string;
  dossierType: DossierType;
  name: string;
  alias?: string;
  summary?: string;
  affiliation?: string;
  region?: string;
  world?: string;
  leader?: string;
  organizationType?: string;
  eventDate?: string;
  era?: string;
  theoryStatus?: string;
  sections?: readonly {
    title: string;
    body?: string;
    fields?: readonly { value: string }[];
  }[];
  isDeleted?: boolean;
  deleted?: boolean;
  isHidden?: boolean;
  hidden?: boolean;
}>;

export type ThreadmarkResolutionResult = Readonly<{
  status: ThreadmarkResolutionStatus;
  occurrenceId: string;
  relationshipKey?: string;
  sourceDossierId: string;
  targetQuery?: string;
  targetDossierId?: string;
  targetDisplayName?: string;
  targetKnowledgeType?: DossierType;
  matchMethod: ThreadmarkResolutionMatchMethod;
  confidence: ThreadmarkResolutionConfidence;
  candidates: readonly ThreadmarkResolutionCandidate[];
  diagnostics: readonly ThreadmarkResolutionDiagnostic[];
  registryVersion: typeof THREADMARK_REGISTRY_VERSION;
  parserVersion: number;
  resolverVersion: number;
  displayNameChanged?: boolean;
  currentDisplayName?: string;
  previousDisplayName?: string;
}>;

export type ThreadmarkResolutionSummary = Readonly<{
  total: number;
  resolved: number;
  unresolved: number;
  ambiguous: number;
  incompatible: number;
  unavailable: number;
  invalid: number;
}>;

export type ThreadmarkDocumentResolutionRequest = Readonly<{
  text?: string;
  occurrences?: readonly ThreadmarkParseResult[];
  sourceDossier: ThreadmarkResolutionDossierCandidate;
  activeInvestigationId: string;
  dossiers: readonly ThreadmarkResolutionDossierCandidate[];
  selections?: readonly ThreadmarkResolutionSelection[];
  priorResolutions?: readonly ThreadmarkPriorResolution[];
}>;

export type ThreadmarkDocumentResolutionResult = Readonly<{
  results: readonly ThreadmarkResolutionResult[];
  summary: ThreadmarkResolutionSummary;
  durationMs: number;
}>;

export type ThreadmarkResolverDiagnostics = Readonly<{
  resolverVersion: number;
  resolverAvailable: boolean;
  activeInvestigationDossierCount: number;
  resolutionIndexSize: number;
  nameIndexKeyCount: number;
  aliasIndexKeyCount: number;
  mostRecentOccurrenceCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  ambiguousCount: number;
  incompatibleCount: number;
  unavailableCount: number;
  selectedIdResolutionCount: number;
  exactNameResolutionCount: number;
  exactAliasResolutionCount: number;
  renamedTargetCount: number;
  resolutionDurationMs: number;
  resolverExceptionCount: number;
  registryVersionUsed: number;
  parserVersionUsed: number;
}>;

