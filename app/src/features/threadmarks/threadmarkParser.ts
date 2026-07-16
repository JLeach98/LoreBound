import type { DossierType } from '../cases/types/dossierTypes';
import { bondTypeToThreadmarkKey, threadmarkKeyToBondType } from './bondThreadmarkCompatibility';
import {
  getThreadmarkDefinition,
  getThreadmarkPrefixMatches,
  getThreadmarksByCategory,
  getThreadmarkReplacement,
  isThreadmarkDeprecated,
  resolveCanonicalThreadmarkKey,
  resolveInverseThreadmark,
} from './threadmarkSelectors';
import { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';
import {
  THREADMARK_PARSER_VERSION,
  type ThreadmarkParseDiagnostic,
  type ThreadmarkParseOptions,
  type ThreadmarkParseResult,
  type ThreadmarkParseStatus,
  type ThreadmarkParserDiagnostics,
  type ThreadmarkSourceRange,
} from './threadmarkParserTypes';
import {
  collectTokenizerContext,
  shouldSkipThreadmarkOffset,
  tokenizeThreadmarkAt,
  type ThreadmarkTokenCandidate,
} from './threadmarkTokenizer';
import {
  isThreadmarkSourceAllowed,
  normalizeThreadmarkAlias,
} from './threadmarkValidation';

const defaultMaximumResults = 100;
const defaultMaximumInputLength = 200_000;
const defaultParserDiagnostics: ThreadmarkParserDiagnostics = Object.freeze({
  parserVersion: THREADMARK_PARSER_VERSION,
  parserAvailable: true,
  mostRecentTestInputLength: 0,
  totalParseResults: 0,
  validResultCount: 0,
  incompleteResultCount: 0,
  unknownResultCount: 0,
  malformedResultCount: 0,
  escapedTokenCount: 0,
  excludedRangeCount: 0,
  parseDurationMs: 0,
  maximumResultLimitReached: false,
  registryVersionUsed: THREADMARK_REGISTRY_VERSION,
});

let latestParserDiagnostics = defaultParserDiagnostics;

function normalizeExcludedRanges(ranges?: readonly ThreadmarkSourceRange[]) {
  return Object.freeze(
    (ranges ?? [])
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
      .map((range) => ({
        start: Math.max(0, Math.floor(range.start)),
        end: Math.max(0, Math.floor(range.end)),
      }))
      .filter((range) => range.end > range.start)
      .sort((first, second) => first.start - second.start || first.end - second.end),
  );
}

function createLineIndex(input: string) {
  const lineStarts = [0];

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }

  return lineStarts;
}

function getLineColumn(lineStarts: readonly number[], offset: number) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (lineStarts[middle] <= offset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const lineIndex = Math.max(0, high);

  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
  };
}

function createDiagnostic(
  diagnostic: ThreadmarkParseDiagnostic,
): ThreadmarkParseDiagnostic {
  return Object.freeze(diagnostic);
}

function getIncompleteRelationshipDiagnostic(relationshipInput: string) {
  return createDiagnostic({
    code: relationshipInput ? 'relationship-partial' : 'relationship-expected',
    severity: 'info',
    message: relationshipInput
      ? 'Threadmark relationship is still being entered.'
      : 'Threadmark relationship is expected.',
    expected: 'relationship',
    partialRelationshipQuery: relationshipInput,
  });
}

function getTargetDiagnostic(candidate: ThreadmarkTokenCandidate) {
  if (candidate.hasTargetMarker) {
    return createDiagnostic({
      code: candidate.targetMalformed ? 'target-malformed' : 'target-partial',
      severity: candidate.targetMalformed ? 'error' : 'info',
      message: candidate.targetMalformed
        ? 'Threadmark target is malformed.'
        : 'Threadmark target is still being entered.',
      expected: 'target',
      partialTargetQuery: candidate.targetQuery ?? '',
    });
  }

  return createDiagnostic({
    code: 'target-missing',
    severity: 'error',
    message: 'Threadmark target is missing.',
    expected: 'target',
  });
}

function statusAllowsResult(
  status: ThreadmarkParseStatus,
  includeInvalid: boolean,
  includeIncomplete: boolean,
) {
  if (status === 'valid' || status === 'deprecated') {
    return true;
  }

  if (status === 'incomplete') {
    return includeIncomplete;
  }

  return includeInvalid;
}

function sourceTypeAllowed(sourceKnowledgeType?: DossierType | string) {
  return typeof sourceKnowledgeType === 'string' && sourceKnowledgeType.trim().length > 0;
}

function getKnownRelationshipPrefix(relationshipInput: string) {
  const normalizedInput = normalizeThreadmarkAlias(relationshipInput);

  if (!normalizedInput) {
    return [];
  }

  return getThreadmarkPrefixMatches(normalizedInput);
}

function getStatusAndDiagnostics(
  candidate: ThreadmarkTokenCandidate,
  options: ThreadmarkParseOptions,
): {
  canonicalKey?: string;
  status: ThreadmarkParseStatus;
  diagnostics: readonly ThreadmarkParseDiagnostic[];
} {
  const diagnostics: ThreadmarkParseDiagnostic[] = [];

  if (!candidate.relationshipInput) {
    diagnostics.push(getIncompleteRelationshipDiagnostic(candidate.relationshipInput));
    return { status: 'incomplete', diagnostics: Object.freeze(diagnostics) };
  }

  const canonicalKey = resolveCanonicalThreadmarkKey(candidate.relationshipInput);
  const hasPrefixMatches = getKnownRelationshipPrefix(candidate.relationshipInput).length > 0;

  if (!canonicalKey) {
    if (!candidate.hasTargetMarker && hasPrefixMatches) {
      diagnostics.push(getIncompleteRelationshipDiagnostic(candidate.relationshipInput));
      return { status: 'incomplete', diagnostics: Object.freeze(diagnostics) };
    }

    diagnostics.push(
      createDiagnostic({
        code: 'threadmark-unknown',
        severity: 'error',
        message: 'Threadmark relationship is not registered.',
        partialRelationshipQuery: candidate.relationshipInput,
      }),
    );

    return {
      status: 'unknown-threadmark',
      diagnostics: Object.freeze(diagnostics),
    };
  }

  const definition = getThreadmarkDefinition(canonicalKey);

  if (!definition || (options.category && definition.category !== options.category)) {
    diagnostics.push(
      createDiagnostic({
        code: 'threadmark-unknown',
        severity: 'error',
        message: 'Threadmark relationship is not available for the requested category.',
      }),
    );
    return {
      canonicalKey,
      status: 'unknown-threadmark',
      diagnostics: Object.freeze(diagnostics),
    };
  }

  if (!candidate.hasTargetMarker || !candidate.targetQuery) {
    const targetDiagnostic = getTargetDiagnostic(candidate);
    diagnostics.push(targetDiagnostic);

    return {
      canonicalKey,
      status: targetDiagnostic.code === 'target-malformed' ? 'malformed' : 'incomplete',
      diagnostics: Object.freeze(diagnostics),
    };
  }

  if (sourceTypeAllowed(options.sourceKnowledgeType) && !isThreadmarkSourceAllowed(
    definition,
    options.sourceKnowledgeType as string,
  )) {
    diagnostics.push(
      createDiagnostic({
        code: 'source-disallowed',
        severity: 'warning',
        message: 'Source Knowledge Type is not valid for this Threadmark.',
      }),
    );
    return {
      canonicalKey,
      status: 'disallowed-source',
      diagnostics: Object.freeze(diagnostics),
    };
  }

  if (isThreadmarkDeprecated(canonicalKey)) {
    diagnostics.push(
      createDiagnostic({
        code: 'threadmark-deprecated',
        severity: 'warning',
        message: 'Threadmark is deprecated and remains recognized for compatibility.',
      }),
    );
    return {
      canonicalKey,
      status: 'deprecated',
      diagnostics: Object.freeze(diagnostics),
    };
  }

  return {
    canonicalKey,
    status: 'valid',
    diagnostics: Object.freeze(diagnostics),
  };
}

function createParseResult(
  input: string,
  candidate: ThreadmarkTokenCandidate,
  options: ThreadmarkParseOptions,
  lineStarts: readonly number[],
): ThreadmarkParseResult {
  const { canonicalKey, status, diagnostics } = getStatusAndDiagnostics(candidate, options);
  const definition = canonicalKey ? getThreadmarkDefinition(canonicalKey) : undefined;
  const inverseResolution = canonicalKey
    ? resolveInverseThreadmark({ relationshipKey: canonicalKey })
    : undefined;
  const replacement = canonicalKey ? getThreadmarkReplacement(canonicalKey) : undefined;
  const compatibleBondType = canonicalKey ? threadmarkKeyToBondType(canonicalKey) : undefined;
  const { line, column } = getLineColumn(lineStarts, candidate.startOffset);

  return Object.freeze({
    parserVersion: THREADMARK_PARSER_VERSION,
    status,
    category: definition?.category ?? options.category ?? 'relationship',
    rawText: input.slice(candidate.startOffset, candidate.endOffset),
    relationshipToken: candidate.relationshipToken,
    relationshipInput: candidate.relationshipInput,
    canonicalKey,
    replacementKey: replacement?.key,
    targetToken: candidate.targetToken,
    targetText: candidate.targetText,
    targetQuery: candidate.targetQuery,
    startOffset: candidate.startOffset,
    endOffset: candidate.endOffset,
    line,
    column,
    diagnostics,
    validTargetTypes: definition?.validTargetTypes ?? [],
    compatibleBondType,
    reciprocalBehavior: definition?.reciprocalBehavior,
    inverseResolutionMode: inverseResolution?.status,
  });
}

function updateParserDiagnostics(
  inputLength: number,
  results: readonly ThreadmarkParseResult[],
  escapedTokenCount: number,
  excludedRangeCount: number,
  parseDurationMs: number,
  maximumResultLimitReached: boolean,
) {
  latestParserDiagnostics = Object.freeze({
    parserVersion: THREADMARK_PARSER_VERSION,
    parserAvailable: true,
    mostRecentTestInputLength: inputLength,
    totalParseResults: results.length,
    validResultCount: results.filter((result) => result.status === 'valid').length,
    incompleteResultCount: results.filter((result) => result.status === 'incomplete').length,
    unknownResultCount: results.filter((result) => result.status === 'unknown-threadmark').length,
    malformedResultCount: results.filter((result) => result.status === 'malformed').length,
    escapedTokenCount,
    excludedRangeCount,
    parseDurationMs,
    maximumResultLimitReached,
    registryVersionUsed: THREADMARK_REGISTRY_VERSION,
  });
}

export function parseThreadmarks(
  input: string,
  options: ThreadmarkParseOptions = {},
) {
  const parseStart = performance.now();
  const maximumInputLength = options.maximumInputLength ?? defaultMaximumInputLength;
  const maximumResults = Math.max(1, options.maximumResults ?? defaultMaximumResults);
  const includeInvalid = options.includeInvalid ?? true;
  const includeIncomplete = options.includeIncomplete ?? true;
  const parseInput = input.slice(0, maximumInputLength);
  const excludedRanges = normalizeExcludedRanges(options.excludedRanges);
  const tokenizerContext = collectTokenizerContext(parseInput, excludedRanges);
  const lineStarts = createLineIndex(parseInput);
  const results: ThreadmarkParseResult[] = [];
  let maximumResultLimitReached = false;

  for (let offset = 0; offset < parseInput.length; offset += 1) {
    if (shouldSkipThreadmarkOffset(parseInput, offset, excludedRanges)) {
      continue;
    }

    const candidate = tokenizeThreadmarkAt(parseInput, offset);

    if (!candidate) {
      continue;
    }

    const result = createParseResult(parseInput, candidate, options, lineStarts);

    if (statusAllowsResult(result.status, includeInvalid, includeIncomplete)) {
      results.push(result);
    }

    if (results.length >= maximumResults) {
      maximumResultLimitReached = true;
      break;
    }

    offset = Math.max(offset, candidate.endOffset - 1);
  }

  if (input.length > maximumInputLength && results.length < maximumResults) {
    const { line, column } = getLineColumn(lineStarts, parseInput.length);
    results.push(
      Object.freeze({
        parserVersion: THREADMARK_PARSER_VERSION,
        status: 'malformed',
        category: options.category ?? 'relationship',
        rawText: '',
        startOffset: parseInput.length,
        endOffset: parseInput.length,
        line,
        column,
        diagnostics: Object.freeze([
          createDiagnostic({
            code: 'input-truncated',
            severity: 'warning',
            message: 'Threadmark parser input exceeded the maximum allowed length.',
          }),
        ]),
        validTargetTypes: [],
      }),
    );
  }

  const frozenResults = Object.freeze(results);
  updateParserDiagnostics(
    parseInput.length,
    frozenResults,
    tokenizerContext.escapedTokenCount,
    tokenizerContext.excludedRangeCount,
    Math.max(0, performance.now() - parseStart),
    maximumResultLimitReached,
  );

  return frozenResults;
}

export function getThreadmarkParserDiagnostics() {
  return latestParserDiagnostics;
}

export function getThreadmarkParseResultAtOffset(
  results: readonly ThreadmarkParseResult[],
  offset: number,
) {
  return results.find((result) => offset >= result.startOffset && offset <= result.endOffset);
}

export function getThreadmarkParseResultsBeforeOffset(
  results: readonly ThreadmarkParseResult[],
  offset: number,
) {
  return Object.freeze(results.filter((result) => result.endOffset <= offset));
}

export function getThreadmarkParseResultsAfterOffset(
  results: readonly ThreadmarkParseResult[],
  offset: number,
) {
  return Object.freeze(results.filter((result) => result.startOffset >= offset));
}

export function getSupportedThreadmarkParserCategories() {
  return getThreadmarksByCategory('relationship').length > 0
    ? Object.freeze(['relationship'] as const)
    : Object.freeze([] as const);
}

export function getCompatibleBondTypeForThreadmark(key: string) {
  const canonicalKey = resolveCanonicalThreadmarkKey(key);

  return canonicalKey ? threadmarkKeyToBondType(canonicalKey) : undefined;
}

export function getThreadmarkKeyForCompatibleBondType(bondType: string) {
  return bondTypeToThreadmarkKey(bondType);
}
