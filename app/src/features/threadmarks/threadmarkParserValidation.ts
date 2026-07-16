import type {
  ThreadmarkParseResult,
  ThreadmarkParseStatus,
} from './threadmarkParserTypes';

const validStatuses = new Set<ThreadmarkParseStatus>([
  'valid',
  'deprecated',
]);
const incompleteStatuses = new Set<ThreadmarkParseStatus>(['incomplete']);
const warningStatuses = new Set<ThreadmarkParseStatus>([
  'deprecated',
  'disallowed-source',
]);
const errorStatuses = new Set<ThreadmarkParseStatus>([
  'unknown-threadmark',
  'missing-target',
  'malformed',
  'ambiguous',
]);

export function validateThreadmarkParseResult(result: ThreadmarkParseResult) {
  return (
    result.startOffset >= 0 &&
    result.endOffset >= result.startOffset &&
    result.rawText.length === result.endOffset - result.startOffset &&
    result.line >= 1 &&
    result.column >= 1 &&
    (result.status !== 'valid' || Boolean(result.canonicalKey && result.targetQuery))
  );
}

export function hasValidThreadmarks(results: readonly ThreadmarkParseResult[]) {
  return results.some((result) => validStatuses.has(result.status));
}

export function hasIncompleteThreadmarks(results: readonly ThreadmarkParseResult[]) {
  return results.some((result) => incompleteStatuses.has(result.status));
}

export function getThreadmarkParseErrors(results: readonly ThreadmarkParseResult[]) {
  return Object.freeze(results.filter((result) => errorStatuses.has(result.status)));
}

export function getThreadmarkParseWarnings(results: readonly ThreadmarkParseResult[]) {
  return Object.freeze(results.filter((result) => warningStatuses.has(result.status)));
}

export function filterValidThreadmarks(results: readonly ThreadmarkParseResult[]) {
  return Object.freeze(results.filter((result) => validStatuses.has(result.status)));
}

