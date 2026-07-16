import {
  getThreadmarkDefinition,
  isThreadmarkDeprecated,
  parseThreadmarks,
} from './index';
import {
  THREADMARK_RESOLVER_VERSION,
  type ThreadmarkDocumentResolutionRequest,
  type ThreadmarkResolutionDiagnostic,
  type ThreadmarkResolutionDossierCandidate,
  type ThreadmarkResolutionMatchMethod,
  type ThreadmarkResolutionRequest,
  type ThreadmarkResolutionResult,
  type ThreadmarkResolutionSelection,
  type ThreadmarkResolverDiagnostics,
} from './threadmarkResolverTypes';
import {
  buildThreadmarkResolutionIndex,
  isThreadmarkResolutionCandidateAvailable,
  normalizeResolutionText,
  normalizeResolutionTextCaseFold,
  type ThreadmarkResolutionIndex,
} from './threadmarkResolutionIndex';
import { summarizeResolutionCandidates } from './threadmarkResolutionSelectors';
import { getResolutionSummary } from './threadmarkResolutionValidation';
import { THREADMARK_PARSER_VERSION } from './threadmarkParserTypes';
import { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';
import { isThreadmarkPairAllowed, isThreadmarkSourceAllowed } from './threadmarkValidation';

const selfReferenceAllowedKeys = new Set(['associatedWith']);

const defaultResolverDiagnostics: ThreadmarkResolverDiagnostics = Object.freeze({
  resolverVersion: THREADMARK_RESOLVER_VERSION,
  resolverAvailable: true,
  activeInvestigationDossierCount: 0,
  resolutionIndexSize: 0,
  nameIndexKeyCount: 0,
  aliasIndexKeyCount: 0,
  mostRecentOccurrenceCount: 0,
  resolvedCount: 0,
  unresolvedCount: 0,
  ambiguousCount: 0,
  incompatibleCount: 0,
  unavailableCount: 0,
  selectedIdResolutionCount: 0,
  exactNameResolutionCount: 0,
  exactAliasResolutionCount: 0,
  renamedTargetCount: 0,
  resolutionDurationMs: 0,
  resolverExceptionCount: 0,
  registryVersionUsed: THREADMARK_REGISTRY_VERSION,
  parserVersionUsed: THREADMARK_PARSER_VERSION,
});

let latestResolverDiagnostics = defaultResolverDiagnostics;
let resolverExceptionCount = 0;

function diagnostic(diagnosticValue: ThreadmarkResolutionDiagnostic) {
  return Object.freeze(diagnosticValue);
}

function occurrenceId(request: ThreadmarkResolutionRequest) {
  return `${request.sourceDossierId}:${request.occurrence.startOffset}-${request.occurrence.endOffset}`;
}

function baseResult(
  request: ThreadmarkResolutionRequest,
  status: ThreadmarkResolutionResult['status'],
  diagnostics: readonly ThreadmarkResolutionDiagnostic[],
  extras: Partial<ThreadmarkResolutionResult> = {},
): ThreadmarkResolutionResult {
  return Object.freeze({
    status,
    occurrenceId: occurrenceId(request),
    relationshipKey: request.occurrence.canonicalKey,
    sourceDossierId: request.sourceDossierId,
    targetQuery: request.occurrence.targetQuery,
    matchMethod: 'none',
    confidence: status === 'ambiguous' ? 'ambiguous' : 'none',
    candidates: [],
    diagnostics,
    registryVersion: THREADMARK_REGISTRY_VERSION,
    parserVersion: request.occurrence.parserVersion,
    resolverVersion: THREADMARK_RESOLVER_VERSION,
    ...extras,
  });
}

function isSelfReferenceAllowed(relationshipKey: string) {
  return selfReferenceAllowedKeys.has(relationshipKey);
}

function compatibleCandidates(
  relationshipKey: string,
  sourceType: string,
  candidates: readonly ThreadmarkResolutionDossierCandidate[],
) {
  const definition = getThreadmarkDefinition(relationshipKey);

  if (!definition) {
    return [];
  }

  return candidates.filter((candidate) =>
    isThreadmarkPairAllowed(definition, sourceType, candidate.dossierType),
  );
}

function unavailableSelectedResult(
  request: ThreadmarkResolutionRequest,
  selectedTargetDossierId: string,
) {
  return baseResult(
    request,
    'target-unavailable',
    [
      diagnostic({
        code: 'target-unavailable',
        severity: 'error',
        message: 'Selected target Dossier is unavailable in this Local Archive.',
      }),
    ],
    { targetDossierId: selectedTargetDossierId },
  );
}

function resolveCandidate({
  request,
  candidate,
  matchMethod,
  previousDisplayName,
}: {
  request: ThreadmarkResolutionRequest;
  candidate: ThreadmarkResolutionDossierCandidate;
  matchMethod: ThreadmarkResolutionMatchMethod;
  previousDisplayName?: string;
}) {
  const relationshipKey = request.occurrence.canonicalKey;

  if (!relationshipKey) {
    return baseResult(request, 'unknown-threadmark', [
      diagnostic({
        code: 'threadmark-unknown',
        severity: 'error',
        message: 'Threadmark relationship is unknown.',
      }),
    ]);
  }

  if (!isThreadmarkResolutionCandidateAvailable(candidate)) {
    return unavailableSelectedResult(request, candidate.id);
  }

  if (candidate.id === request.sourceDossierId && !isSelfReferenceAllowed(relationshipKey)) {
    return baseResult(
      request,
      'self-reference-disallowed',
      [
        diagnostic({
          code: 'self-reference',
          severity: 'error',
          message: 'This Threadmark cannot target its source Dossier.',
        }),
      ],
      {
        targetDossierId: candidate.id,
        targetDisplayName: candidate.name,
        targetKnowledgeType: candidate.dossierType,
      },
    );
  }

  const definition = getThreadmarkDefinition(relationshipKey);

  if (!definition || !isThreadmarkPairAllowed(definition, request.sourceKnowledgeType, candidate.dossierType)) {
    return baseResult(
      request,
      'incompatible-target',
      [
        diagnostic({
          code: 'target-incompatible',
          severity: 'error',
          message: 'Target Dossier Knowledge Type is incompatible with this Threadmark.',
        }),
      ],
      {
        targetDossierId: candidate.id,
        targetDisplayName: candidate.name,
        targetKnowledgeType: candidate.dossierType,
        candidates: summarizeResolutionCandidates([candidate]),
      },
    );
  }

  const displayNameChanged = Boolean(previousDisplayName && previousDisplayName !== candidate.name);
  const diagnostics = displayNameChanged
    ? [
        diagnostic({
          code: 'display-name-changed',
          severity: 'warning',
          message: 'Resolved target Dossier display name has changed.',
        }),
      ]
    : [
        diagnostic({
          code: matchMethod === 'selected-id' ? 'resolved-by-selected-id' : matchMethod.includes('alias') ? 'resolved-by-alias' : 'resolved-by-name',
          severity: 'info',
          message: 'Threadmark target resolved.',
        }),
      ];

  return baseResult(request, isThreadmarkDeprecated(relationshipKey) ? 'deprecated-threadmark' : 'resolved', diagnostics, {
    targetDossierId: candidate.id,
    targetDisplayName: candidate.name,
    targetKnowledgeType: candidate.dossierType,
    matchMethod,
    confidence: matchMethod === 'selected-id' ? 'selected' : 'exact',
    displayNameChanged,
    currentDisplayName: candidate.name,
    previousDisplayName,
  });
}

function resolveCandidatesByMatch({
  request,
  matchMethod,
  candidates,
}: {
  request: ThreadmarkResolutionRequest;
  matchMethod: ThreadmarkResolutionMatchMethod;
  candidates: readonly ThreadmarkResolutionDossierCandidate[];
}) {
  const relationshipKey = request.occurrence.canonicalKey;

  if (!relationshipKey) {
    return baseResult(request, 'unknown-threadmark', [
      diagnostic({
        code: 'threadmark-unknown',
        severity: 'error',
        message: 'Threadmark relationship is unknown.',
      }),
    ]);
  }

  const availableCandidates = candidates.filter(isThreadmarkResolutionCandidateAvailable);
  const compatible = compatibleCandidates(relationshipKey, request.sourceKnowledgeType, availableCandidates);
  const nonSelfCandidates = compatible.filter(
    (candidate) => candidate.id !== request.sourceDossierId || isSelfReferenceAllowed(relationshipKey),
  );

  if (availableCandidates.length > 0 && compatible.length === 0) {
    return baseResult(
      request,
      'incompatible-target',
      [
        diagnostic({
          code: 'target-incompatible',
          severity: 'error',
          message: 'Matching Dossier exists but is incompatible with this Threadmark.',
        }),
      ],
      { candidates: summarizeResolutionCandidates(availableCandidates) },
    );
  }

  if (compatible.length > 0 && nonSelfCandidates.length === 0) {
    return baseResult(
      request,
      'self-reference-disallowed',
      [
        diagnostic({
          code: 'self-reference',
          severity: 'error',
          message: 'Matching Dossier is the source Dossier and self-reference is disallowed.',
        }),
      ],
      { candidates: summarizeResolutionCandidates(compatible) },
    );
  }

  if (nonSelfCandidates.length === 1) {
    return resolveCandidate({
      request,
      candidate: nonSelfCandidates[0],
      matchMethod,
    });
  }

  if (nonSelfCandidates.length > 1) {
    return baseResult(
      request,
      'ambiguous',
      [
        diagnostic({
          code: 'target-ambiguous',
          severity: 'warning',
          message: 'Multiple compatible Dossiers match this Threadmark target.',
        }),
      ],
      {
        matchMethod,
        confidence: 'ambiguous',
        candidates: summarizeResolutionCandidates(nonSelfCandidates),
      },
    );
  }

  return null;
}

function findSelection(request: ThreadmarkResolutionRequest) {
  return request.selectedTargetDossierId ?? request.priorResolution?.targetDossierId;
}

export function resolveThreadmarkOccurrence(
  request: ThreadmarkResolutionRequest,
  index = buildThreadmarkResolutionIndex({
    dossiers: request.dossiers,
    activeInvestigationId: request.activeInvestigationId,
  }),
): ThreadmarkResolutionResult {
  try {
    if (!request.occurrence.canonicalKey) {
      return baseResult(request, 'unknown-threadmark', [
        diagnostic({
          code: 'threadmark-unknown',
          severity: 'error',
          message: 'Threadmark relationship is unknown.',
        }),
      ]);
    }

    const definition = getThreadmarkDefinition(request.occurrence.canonicalKey);

    if (!definition) {
      return baseResult(request, 'unknown-threadmark', [
        diagnostic({
          code: 'threadmark-unknown',
          severity: 'error',
          message: 'Threadmark relationship is not registered.',
        }),
      ]);
    }

    if (!isThreadmarkSourceAllowed(definition, request.sourceKnowledgeType)) {
      return baseResult(request, 'invalid-source', [
        diagnostic({
          code: 'source-incompatible',
          severity: 'error',
          message: 'Source Dossier Knowledge Type is incompatible with this Threadmark.',
        }),
      ]);
    }

    if (['malformed', 'incomplete', 'missing-target'].includes(request.occurrence.status)) {
      return baseResult(request, request.occurrence.status === 'malformed' ? 'malformed' : 'missing-target', [
        diagnostic({
          code: 'target-query-missing',
          severity: 'error',
          message: 'Threadmark target query is missing or malformed.',
        }),
      ]);
    }

    const selectedTargetDossierId = findSelection(request);

    if (selectedTargetDossierId) {
      const candidate = index.byId.get(selectedTargetDossierId);

      if (!candidate) {
        return unavailableSelectedResult(request, selectedTargetDossierId);
      }

      return resolveCandidate({
        request,
        candidate,
        matchMethod: 'selected-id',
        previousDisplayName: request.priorResolution?.lastKnownDisplayName ?? request.selectedDisplayName,
      });
    }

    const targetQuery = request.occurrence.targetQuery;

    if (!targetQuery) {
      return baseResult(request, 'missing-target', [
        diagnostic({
          code: 'target-query-missing',
          severity: 'error',
          message: 'Threadmark target query is missing.',
        }),
      ]);
    }

    const exactName = resolveCandidatesByMatch({
      request,
      matchMethod: 'exact-name',
      candidates: index.byExactName.get(normalizeResolutionText(targetQuery)) ?? [],
    });

    if (exactName) {
      return exactName;
    }

    const exactAlias = resolveCandidatesByMatch({
      request,
      matchMethod: 'exact-alias',
      candidates: index.byExactAlias.get(normalizeResolutionText(targetQuery)) ?? [],
    });

    if (exactAlias) {
      return exactAlias;
    }

    const caseInsensitiveName = resolveCandidatesByMatch({
      request,
      matchMethod: 'case-insensitive-name',
      candidates: index.byCaseInsensitiveName.get(normalizeResolutionTextCaseFold(targetQuery)) ?? [],
    });

    if (caseInsensitiveName) {
      return caseInsensitiveName;
    }

    const caseInsensitiveAlias = resolveCandidatesByMatch({
      request,
      matchMethod: 'case-insensitive-alias',
      candidates: index.byCaseInsensitiveAlias.get(normalizeResolutionTextCaseFold(targetQuery)) ?? [],
    });

    if (caseInsensitiveAlias) {
      return caseInsensitiveAlias;
    }

    return baseResult(request, 'unresolved', [
      diagnostic({
        code: 'target-unresolved',
        severity: 'info',
        message: 'No compatible Dossier matches this Threadmark target.',
      }),
    ]);
  } catch {
    resolverExceptionCount += 1;
    return baseResult(request, 'skipped', [
      diagnostic({
        code: 'occurrence-skipped',
        severity: 'error',
        message: 'Threadmark occurrence could not be resolved safely.',
      }),
    ]);
  }
}

function matchingSelection(
  occurrenceStartOffset: number,
  occurrenceEndOffset: number,
  selections?: readonly ThreadmarkResolutionSelection[],
) {
  return selections?.find(
    (selection) =>
      selection.occurrenceStartOffset === occurrenceStartOffset &&
      selection.occurrenceEndOffset === occurrenceEndOffset,
  );
}

function updateResolverDiagnostics(
  index: ThreadmarkResolutionIndex,
  results: readonly ThreadmarkResolutionResult[],
  durationMs: number,
) {
  latestResolverDiagnostics = Object.freeze({
    resolverVersion: THREADMARK_RESOLVER_VERSION,
    resolverAvailable: true,
    activeInvestigationDossierCount: index.activeCandidates.length,
    resolutionIndexSize: index.byId.size,
    nameIndexKeyCount: index.byCaseInsensitiveName.size,
    aliasIndexKeyCount: index.byCaseInsensitiveAlias.size,
    mostRecentOccurrenceCount: results.length,
    resolvedCount: results.filter((result) => result.status === 'resolved').length,
    unresolvedCount: results.filter((result) => result.status === 'unresolved').length,
    ambiguousCount: results.filter((result) => result.status === 'ambiguous').length,
    incompatibleCount: results.filter((result) => result.status === 'incompatible-target').length,
    unavailableCount: results.filter((result) => result.status === 'target-unavailable').length,
    selectedIdResolutionCount: results.filter((result) => result.matchMethod === 'selected-id').length,
    exactNameResolutionCount: results.filter((result) =>
      ['exact-name', 'case-insensitive-name'].includes(result.matchMethod),
    ).length,
    exactAliasResolutionCount: results.filter((result) =>
      ['exact-alias', 'case-insensitive-alias'].includes(result.matchMethod),
    ).length,
    renamedTargetCount: results.filter((result) => result.displayNameChanged).length,
    resolutionDurationMs: durationMs,
    resolverExceptionCount,
    registryVersionUsed: THREADMARK_REGISTRY_VERSION,
    parserVersionUsed: THREADMARK_PARSER_VERSION,
  });
}

export function resolveThreadmarkDocument({
  text,
  occurrences,
  sourceDossier,
  activeInvestigationId,
  dossiers,
  selections,
  priorResolutions,
}: ThreadmarkDocumentResolutionRequest) {
  const startedAt = performance.now();
  const index = buildThreadmarkResolutionIndex({ dossiers, activeInvestigationId });
  const parsedOccurrences = occurrences ?? (text ? parseThreadmarks(text) : []);
  const results = parsedOccurrences.map((occurrence) => {
    const selection = matchingSelection(occurrence.startOffset, occurrence.endOffset, selections);
    const priorResolution = priorResolutions?.find(
      (candidate) => candidate.targetDossierId === selection?.selectedTargetDossierId,
    );

    return resolveThreadmarkOccurrence(
      {
        occurrence,
        sourceDossierId: sourceDossier.id,
        sourceKnowledgeType: sourceDossier.dossierType,
        activeInvestigationId,
        dossiers,
        selectedTargetDossierId:
          'selectedTargetDossierId' in (selection ?? {})
            ? selection?.selectedTargetDossierId
            : undefined,
        selectedDisplayName:
          'selectedDisplayName' in (selection ?? {}) ? selection?.selectedDisplayName : undefined,
        priorResolution,
      },
      index,
    );
  });
  const frozenResults = Object.freeze(results);
  const durationMs = Math.max(0, performance.now() - startedAt);

  updateResolverDiagnostics(index, frozenResults, durationMs);

  return Object.freeze({
    results: frozenResults,
    summary: getResolutionSummary(frozenResults),
    durationMs,
  });
}

export function getThreadmarkResolverDiagnostics() {
  return latestResolverDiagnostics;
}
