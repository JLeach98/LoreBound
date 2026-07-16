import type {
  ThreadmarkResolutionResult,
  ThreadmarkResolutionStatus,
} from './threadmarkResolverTypes';

const resolvedStatuses = new Set<ThreadmarkResolutionStatus>(['resolved']);
const ambiguousStatuses = new Set<ThreadmarkResolutionStatus>(['ambiguous']);
const unavailableStatuses = new Set<ThreadmarkResolutionStatus>(['target-unavailable']);
const issueStatuses = new Set<ThreadmarkResolutionStatus>([
  'unresolved',
  'ambiguous',
  'missing-target',
  'unknown-threadmark',
  'incompatible-target',
  'invalid-source',
  'self-reference-disallowed',
  'target-unavailable',
  'deprecated-threadmark',
  'malformed',
  'skipped',
]);

export function isThreadmarkResolved(result: ThreadmarkResolutionResult) {
  return resolvedStatuses.has(result.status);
}

export function isThreadmarkAmbiguous(result: ThreadmarkResolutionResult) {
  return ambiguousStatuses.has(result.status);
}

export function isThreadmarkUnavailable(result: ThreadmarkResolutionResult) {
  return unavailableStatuses.has(result.status);
}

export function getResolvedTargetId(result: ThreadmarkResolutionResult) {
  return isThreadmarkResolved(result) ? result.targetDossierId : undefined;
}

export function getResolutionIssues(results: readonly ThreadmarkResolutionResult[]) {
  return Object.freeze(results.filter((result) => issueStatuses.has(result.status)));
}

export function getResolutionSummary(results: readonly ThreadmarkResolutionResult[]) {
  return Object.freeze({
    total: results.length,
    resolved: results.filter((result) => result.status === 'resolved').length,
    unresolved: results.filter((result) => result.status === 'unresolved').length,
    ambiguous: results.filter((result) => result.status === 'ambiguous').length,
    incompatible: results.filter((result) => result.status === 'incompatible-target').length,
    unavailable: results.filter((result) => result.status === 'target-unavailable').length,
    invalid: results.filter((result) =>
      ['invalid-source', 'malformed', 'unknown-threadmark', 'self-reference-disallowed'].includes(
        result.status,
      ),
    ).length,
  });
}

export function canProceedToBondIntegration(result: ThreadmarkResolutionResult) {
  return Boolean(
    result.status === 'resolved' &&
      result.sourceDossierId &&
      result.targetDossierId &&
      result.relationshipKey &&
      !result.diagnostics.some((diagnostic) =>
        ['source-incompatible', 'target-incompatible', 'self-reference'].includes(diagnostic.code),
      ),
  );
}

