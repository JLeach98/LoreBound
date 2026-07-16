import {
  THREADMARK_AUTHORING_VERSION,
  type ThreadmarkAuthoringDiagnostics,
} from './threadmarkAuthoringTypes';
import { THREADMARK_PARSER_VERSION } from './threadmarkParserTypes';
import { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';

const defaultDiagnostics: ThreadmarkAuthoringDiagnostics = Object.freeze({
  version: THREADMARK_AUTHORING_VERSION,
  activeState: 'idle',
  relationshipMenuOpen: false,
  targetMenuOpen: false,
  currentSourceKnowledgeType: 'None',
  relationshipSuggestionCount: 0,
  targetSuggestionCount: 0,
  parserVersion: THREADMARK_PARSER_VERSION,
  registryVersion: THREADMARK_REGISTRY_VERSION,
  selectionInserted: false,
  insertionFailureCount: 0,
  targetSearchDurationMs: 0,
  mobileSheetActive: false,
  desktopAnchorActive: false,
});

let latestThreadmarkAuthoringDiagnostics = defaultDiagnostics;

export function updateThreadmarkAuthoringDiagnostics(
  diagnostics: Partial<ThreadmarkAuthoringDiagnostics>,
) {
  latestThreadmarkAuthoringDiagnostics = Object.freeze({
    ...latestThreadmarkAuthoringDiagnostics,
    ...diagnostics,
    version: THREADMARK_AUTHORING_VERSION,
    parserVersion: THREADMARK_PARSER_VERSION,
    registryVersion: THREADMARK_REGISTRY_VERSION,
  });
}

export function getThreadmarkAuthoringDiagnostics() {
  return latestThreadmarkAuthoringDiagnostics;
}

