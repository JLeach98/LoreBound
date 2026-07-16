import type { Dossier, DossierType } from '../cases/types/dossierTypes';
import type { ThreadmarkDefinition } from './threadmarkTypes';

export const THREADMARK_AUTHORING_VERSION = 1;

export type ThreadmarkAuthoringMode = 'relationship' | 'target';
export type ThreadmarkAuthoringStateName =
  | 'idle'
  | 'relationshipSearch'
  | 'targetSearch'
  | 'complete'
  | 'dismissed'
  | 'invalidContext';

export type ThreadmarkAuthoringRange = Readonly<{
  start: number;
  end: number;
}>;

export type ThreadmarkAuthoringState = Readonly<{
  state: ThreadmarkAuthoringStateName;
  editorId: string;
  dossierId: string;
  sectionId: string;
  sourceKnowledgeType: DossierType;
  cursorOffset: number;
  selectionRange: ThreadmarkAuthoringRange;
  activeRelationshipFragment: string;
  canonicalRelationshipKey?: string;
  activeTargetFragment: string;
  replacementRange: ThreadmarkAuthoringRange;
  highlightedSuggestionIndex: number;
  triggerOrigin: 'typing' | 'cursor' | 'keyboard' | 'selection';
  menuMode?: ThreadmarkAuthoringMode;
  isMenuOpen: boolean;
}>;

export type ThreadmarkRelationshipSuggestion = Readonly<{
  id: string;
  kind: 'relationship';
  definition: ThreadmarkDefinition;
  displayName: string;
  description: string;
  targetTypeSummary: string;
  isDeprecated: boolean;
  replacementKey?: string;
  score: number;
}>;

export type ThreadmarkTargetSuggestion = Readonly<{
  id: string;
  kind: 'target';
  dossier: Dossier;
  name: string;
  dossierType: DossierType;
  secondaryLine: string;
  initials: string;
  score: number;
}>;

export type ThreadmarkAuthoringSuggestion =
  | ThreadmarkRelationshipSuggestion
  | ThreadmarkTargetSuggestion;

export type ThreadmarkAuthoringDiagnostics = Readonly<{
  version: number;
  activeState: ThreadmarkAuthoringStateName;
  relationshipMenuOpen: boolean;
  targetMenuOpen: boolean;
  currentSourceKnowledgeType: string;
  relationshipSuggestionCount: number;
  targetSuggestionCount: number;
  parserVersion: number;
  registryVersion: number;
  selectionInserted: boolean;
  insertionFailureCount: number;
  targetSearchDurationMs: number;
  mobileSheetActive: boolean;
  desktopAnchorActive: boolean;
}>;

