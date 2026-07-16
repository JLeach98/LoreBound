import type { DossierType } from '../cases/types/dossierTypes';
import type {
  ThreadmarkCategory,
  ThreadmarkReciprocalBehavior,
} from './threadmarkTypes';

export const THREADMARK_PARSER_VERSION = 1;

export type ThreadmarkParseStatus =
  | 'valid'
  | 'incomplete'
  | 'unknown-threadmark'
  | 'missing-target'
  | 'malformed'
  | 'disallowed-source'
  | 'deprecated'
  | 'ambiguous';

export type ThreadmarkParseDiagnosticSeverity = 'info' | 'warning' | 'error';
export type ThreadmarkParseExpectedToken = 'relationship' | 'target';

export type ThreadmarkSourceRange = Readonly<{
  start: number;
  end: number;
}>;

export type ThreadmarkParseOptions = Readonly<{
  category?: ThreadmarkCategory;
  sourceKnowledgeType?: DossierType | string;
  includeInvalid?: boolean;
  includeIncomplete?: boolean;
  maximumResults?: number;
  maximumInputLength?: number;
  excludedRanges?: readonly ThreadmarkSourceRange[];
}>;

export type ThreadmarkParseDiagnostic = Readonly<{
  code:
    | 'relationship-expected'
    | 'relationship-partial'
    | 'target-expected'
    | 'target-partial'
    | 'target-missing'
    | 'target-malformed'
    | 'threadmark-unknown'
    | 'source-disallowed'
    | 'threadmark-deprecated'
    | 'maximum-results-reached'
    | 'input-truncated';
  severity: ThreadmarkParseDiagnosticSeverity;
  message: string;
  expected?: ThreadmarkParseExpectedToken;
  partialRelationshipQuery?: string;
  partialTargetQuery?: string;
}>;

export type ThreadmarkParseResult = Readonly<{
  parserVersion: number;
  status: ThreadmarkParseStatus;
  category: ThreadmarkCategory;
  rawText: string;
  relationshipToken?: string;
  relationshipInput?: string;
  canonicalKey?: string;
  replacementKey?: string;
  targetToken?: string;
  targetText?: string;
  targetQuery?: string;
  startOffset: number;
  endOffset: number;
  line: number;
  column: number;
  diagnostics: readonly ThreadmarkParseDiagnostic[];
  validTargetTypes: readonly DossierType[];
  compatibleBondType?: string;
  reciprocalBehavior?: ThreadmarkReciprocalBehavior;
  inverseResolutionMode?: 'resolved' | 'context-required' | 'none';
}>;

export type ThreadmarkParserDiagnostics = Readonly<{
  parserVersion: number;
  parserAvailable: boolean;
  mostRecentTestInputLength: number;
  totalParseResults: number;
  validResultCount: number;
  incompleteResultCount: number;
  unknownResultCount: number;
  malformedResultCount: number;
  escapedTokenCount: number;
  excludedRangeCount: number;
  parseDurationMs: number;
  maximumResultLimitReached: boolean;
  registryVersionUsed: number;
}>;

