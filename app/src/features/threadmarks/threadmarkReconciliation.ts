import {
  builtInBondTypes,
  type Bond,
  type BondFormValues,
  type ThreadmarkBondMetadata,
  type ThreadmarkBondRole,
} from '../cases/types/bondTypes';
import type { Dossier, DossierSection, DossierSectionField } from '../cases/types/dossierTypes';
import { getThreadmarkDefinition, resolveInverseThreadmark } from './threadmarkSelectors';
import { threadmarkKeyToBondType } from './bondThreadmarkCompatibility';
import { resolveThreadmarkDocument } from './threadmarkResolver';
import { canProceedToBondIntegration } from './threadmarkResolutionValidation';
import { THREADMARK_PARSER_VERSION } from './threadmarkParserTypes';
import { THREADMARK_RESOLVER_VERSION, type ThreadmarkResolutionResult } from './threadmarkResolverTypes';
import { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';
import {
  THREADMARK_RECONCILIATION_VERSION,
  type ThreadmarkDesiredBond,
  type ThreadmarkReconciliationConflict,
  type ThreadmarkReconciliationDiagnostics,
  type ThreadmarkReconciliationExecutionResult,
  type ThreadmarkReconciliationExecutor,
  type ThreadmarkReconciliationPlan,
  type ThreadmarkReconciliationRequest,
} from './threadmarkReconciliationTypes';

const defaultReconciliationDiagnostics: ThreadmarkReconciliationDiagnostics = Object.freeze({
  reconciliationVersion: THREADMARK_RECONCILIATION_VERSION,
  reconciliationAvailable: true,
  mostRecentSourceDossierId: null,
  mostRecentSectionCount: 0,
  mostRecentResolvedThreadmarkCount: 0,
  desiredBondCount: 0,
  generatedBondCount: 0,
  createActionCount: 0,
  updateActionCount: 0,
  removeActionCount: 0,
  conflictCount: 0,
  unresolvedThreadmarkCount: 0,
  executionFailureCount: 0,
  desiredForwardCount: 0,
  desiredInverseCount: 0,
  createdForwardCount: 0,
  createdInverseCount: 0,
  missingForwardCount: 0,
  missingInverseCount: 0,
  completePairCount: 0,
  incompletePairCount: 0,
  contextualInverseCount: 0,
  neutralInverseFallbackCount: 0,
  suggestedInverseCount: 0,
  inverseSkippedCount: 0,
  pairIntegrityFailureCount: 0,
  generatedBondsPendingUpload: 0,
  generatedForwardBondsPendingUpload: 0,
  generatedInverseBondsPendingUpload: 0,
  generatedBondsUploaded: 0,
  generatedBondsVerifiedInCloud: 0,
  generatedBondsRetrieved: 0,
  generatedMetadataPreserved: true,
  lastFailedBondId: null,
  lastFailedStage: 'None',
  fieldKitBondRefreshCompleted: false,
});

let latestReconciliationDiagnostics = defaultReconciliationDiagnostics;
let executionFailureCount = 0;
let lastFailedBondId: string | null = null;
let lastFailedStage = 'None';
let fieldKitBondRefreshCompleted = false;

function deterministicHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function stableThreadmarkId(prefix: string, value: string) {
  return `${prefix}-${deterministicHash(value)}`;
}

function getSectionTexts(section: DossierSection) {
  const texts: Array<{ text: string; field?: DossierSectionField }> = [];

  if (section.body?.trim()) {
    texts.push({ text: section.body });
  }

  (section.fields ?? []).forEach((field) => {
    if (field.value.trim()) {
      texts.push({ text: field.value, field });
    }
  });

  return texts;
}

function getThreadmarkMetadata(bond: Bond) {
  return bond.threadmark ?? undefined;
}

export function isThreadmarkGeneratedBond(bond: Bond) {
  return bond.origin === 'threadmark' && bond.threadmark?.origin === 'threadmark';
}

function generatedBondKey(bond: Bond) {
  const metadata = getThreadmarkMetadata(bond);
  return metadata ? `${metadata.ownerId}:${metadata.role}` : bond.id;
}

function desiredBondKey(desired: ThreadmarkDesiredBond) {
  return `${desired.ownerId}:${desired.role}`;
}

function bondLabelsMatch(left: Bond, right: Pick<BondFormValues, 'sourceLabel' | 'targetLabel'>) {
  return (left.sourceLabel ?? '') === (right.sourceLabel ?? '') &&
    (left.targetLabel ?? '') === (right.targetLabel ?? '');
}

function sameBondShape(bond: Bond, values: BondFormValues) {
  return bond.sourceDossierId === values.sourceDossierId &&
    bond.targetDossierId === values.targetDossierId &&
    bond.bondType === values.bondType &&
    bond.bondBehavior === values.bondBehavior &&
    bondLabelsMatch(bond, values);
}

function sameUndirectedBondShape(bond: Bond, values: BondFormValues) {
  const direct =
    bond.sourceDossierId === values.sourceDossierId &&
    bond.targetDossierId === values.targetDossierId;
  const reverse =
    bond.sourceDossierId === values.targetDossierId &&
    bond.targetDossierId === values.sourceDossierId;

  return (direct || reverse) &&
    bond.bondType === values.bondType &&
    bond.bondBehavior === values.bondBehavior &&
    bondLabelsMatch(bond, values);
}

function metadataWithoutGeneratedAt(metadata: ThreadmarkBondMetadata) {
  const { generatedAt, ...rest } = metadata;
  return rest;
}

function desiredMatchesExisting(existing: Bond, desired: ThreadmarkDesiredBond) {
  return sameBondShape(existing, desired.formValues) &&
    JSON.stringify(metadataWithoutGeneratedAt(existing.threadmark as ThreadmarkBondMetadata)) ===
      JSON.stringify(metadataWithoutGeneratedAt(desired.metadata));
}

function getBondDefinition(relationshipKey: string) {
  const bondType = threadmarkKeyToBondType(relationshipKey);

  if (!bondType) {
    return undefined;
  }

  return builtInBondTypes.find((definition) => definition.name === bondType);
}

function occurrenceFingerprint({
  section,
  field,
  result,
}: {
  section: DossierSection;
  field?: DossierSectionField;
  result: ThreadmarkResolutionResult;
}) {
  return stableThreadmarkId(
    'tm-occurrence',
    [
      section.id,
      field?.id ?? 'body',
      result.relationshipKey ?? 'unknown',
      result.targetDossierId ?? 'missing',
      result.occurrenceId,
      result.targetQuery ?? '',
    ].join('|'),
  );
}

function createDesiredBond({
  sourceDossier,
  section,
  field,
  result,
  ordinal,
  role,
  generatedAt,
  sourceRelationshipKey,
  effectiveRelationshipKey,
  effectiveSourceDossierId,
  effectiveTargetDossierId,
  ownerId,
  pairId,
}: {
  sourceDossier: Dossier;
  section: DossierSection;
  field?: DossierSectionField;
  result: ThreadmarkResolutionResult;
  ordinal: number;
  role: ThreadmarkBondRole;
  generatedAt: string;
  sourceRelationshipKey?: string;
  effectiveRelationshipKey?: string;
  effectiveSourceDossierId?: string;
  effectiveTargetDossierId?: string;
  ownerId?: string;
  pairId?: string;
}): ThreadmarkDesiredBond | ThreadmarkReconciliationConflict {
  const originalRelationshipKey = result.relationshipKey;
  const originalTargetDossierId = result.targetDossierId;
  const relationshipKey = effectiveRelationshipKey ?? originalRelationshipKey;
  const bondSourceDossierId = effectiveSourceDossierId ?? sourceDossier.id;
  const bondTargetDossierId = effectiveTargetDossierId ?? originalTargetDossierId;

  if (!originalRelationshipKey || !relationshipKey || !originalTargetDossierId || !bondTargetDossierId) {
    return Object.freeze({
      code: 'unresolved-threadmark',
      severity: 'warning',
      message: 'Threadmark could not be resolved into a Bond.',
      sourceDossierId: sourceDossier.id,
      relationshipKey: originalRelationshipKey,
    });
  }

  const threadmarkDefinition = getThreadmarkDefinition(relationshipKey);
  const bondDefinition = getBondDefinition(relationshipKey);

  if (!threadmarkDefinition || !bondDefinition) {
    return Object.freeze({
      code: 'unsupported-threadmark',
      severity: 'warning',
      message: 'Threadmark has no compatible Bond Type mapping.',
      sourceDossierId: sourceDossier.id,
      targetDossierId: originalTargetDossierId,
      relationshipKey,
    });
  }

  const threadmarkOwnerId = ownerId ?? [
    'threadmark',
    sourceDossier.id,
    section.id,
    field?.id ?? 'body',
    originalRelationshipKey,
    originalTargetDossierId,
    ordinal,
  ].join(':');
  const threadmarkPairId = pairId ?? stableThreadmarkId(
    'threadmark-pair',
    `${sourceDossier.id}:${originalTargetDossierId}:${originalRelationshipKey}:${threadmarkOwnerId}`,
  );
  const metadata: ThreadmarkBondMetadata = {
    origin: 'threadmark',
    ownerId: threadmarkOwnerId,
    sourceDossierId: sourceDossier.id,
    sourceSectionId: section.id,
    relationshipKey: sourceRelationshipKey ?? originalRelationshipKey,
    sourceRelationshipKey: sourceRelationshipKey ?? originalRelationshipKey,
    effectiveRelationshipKey: relationshipKey,
    targetDossierId: originalTargetDossierId,
    occurrenceFingerprint: occurrenceFingerprint({ section, field, result }),
    generatedAt,
    registryVersion: THREADMARK_REGISTRY_VERSION,
    parserVersion: result.parserVersion || THREADMARK_PARSER_VERSION,
    resolverVersion: result.resolverVersion || THREADMARK_RESOLVER_VERSION,
    reconciliationVersion: THREADMARK_RECONCILIATION_VERSION,
    pairId: threadmarkPairId,
    role,
  };
  const formValues: BondFormValues = {
    id: stableThreadmarkId('bond-threadmark', `${threadmarkOwnerId}:${role}`),
    sourceDossierId: bondSourceDossierId,
    targetDossierId: bondTargetDossierId,
    bondType: bondDefinition.name,
    bondBehavior: bondDefinition.behavior,
    sourceLabel: bondDefinition.sourceLabel,
    targetLabel: bondDefinition.targetLabel,
    status: 'Confirmed',
    origin: 'threadmark',
    threadmark: metadata,
  };

  return Object.freeze({
    id: formValues.id as string,
    ownerId: threadmarkOwnerId,
    pairId: threadmarkPairId,
    role,
    formValues,
    metadata,
    resolution: result,
  });
}

function findDossier(dossiers: readonly Dossier[], dossierId?: string) {
  return dossiers.find((dossier) => dossier.id === dossierId) ?? null;
}

function getInverseRelationshipKey({
  result,
  sourceDossier,
  targetDossier,
}: {
  result: ThreadmarkResolutionResult;
  sourceDossier: Dossier;
  targetDossier: Dossier | null;
}) {
  const relationshipKey = result.relationshipKey;
  const definition = relationshipKey ? getThreadmarkDefinition(relationshipKey) : undefined;

  if (!definition) {
    return {
      key: undefined,
      mode: 'none' as const,
      conflict: Object.freeze({
        code: 'inverse-skipped' as const,
        severity: 'warning' as const,
        message: 'Inverse relationship was skipped because the Threadmark definition is unavailable.',
        sourceDossierId: sourceDossier.id,
        targetDossierId: result.targetDossierId,
        relationshipKey,
      }),
    };
  }

  if (definition.reciprocalBehavior === 'none') {
    return { key: undefined, mode: 'none' as const };
  }

  if (definition.reciprocalBehavior === 'suggested') {
    return {
      key: undefined,
      mode: 'suggested' as const,
      conflict: Object.freeze({
        code: 'suggested-inverse-skipped' as const,
        severity: 'info' as const,
        message: 'Suggested inverse relationship was not created automatically.',
        sourceDossierId: sourceDossier.id,
        targetDossierId: result.targetDossierId,
        relationshipKey,
      }),
    };
  }

  const inverseResolution = resolveInverseThreadmark({
    relationshipKey: definition.key,
    sourceDossier,
    targetDossier,
  });

  if (inverseResolution.status === 'resolved' && inverseResolution.key) {
    return { key: inverseResolution.key, mode: 'automatic' as const };
  }

  if (
    definition.reciprocalBehavior === 'contextual' &&
    inverseResolution.status === 'context-required' &&
    inverseResolution.key
  ) {
    return {
      key: inverseResolution.key,
      mode: 'contextual-neutral' as const,
      conflict: Object.freeze({
        code: 'inverse-context-required' as const,
        severity: 'info' as const,
        message: 'Contextual inverse used the Registry neutral inverse fallback.',
        sourceDossierId: sourceDossier.id,
        targetDossierId: result.targetDossierId,
        relationshipKey,
      }),
    };
  }

  return {
    key: undefined,
    mode: 'skipped' as const,
    conflict: Object.freeze({
      code: 'inverse-skipped' as const,
      severity: 'info' as const,
      message: inverseResolution.reason ?? 'No inverse Bond was created for this Threadmark.',
      sourceDossierId: sourceDossier.id,
      targetDossierId: result.targetDossierId,
      relationshipKey,
    }),
  };
}

function collectDesiredBonds(request: ThreadmarkReconciliationRequest, generatedAt: string) {
  const desired: ThreadmarkDesiredBond[] = [];
  const conflicts: ThreadmarkReconciliationConflict[] = [];
  const occurrenceCounts = new Map<string, number>();
  let unresolvedCount = 0;
  let resolvedCount = 0;
  let contextualInverseCount = 0;
  let neutralInverseFallbackCount = 0;
  let suggestedInverseCount = 0;
  let inverseSkippedCount = 0;

  request.sections.forEach((section) => {
    getSectionTexts(section).forEach(({ text, field }) => {
      const resolution = resolveThreadmarkDocument({
        text,
        sourceDossier: request.sourceDossier,
        activeInvestigationId: request.sourceDossier.caseId,
        dossiers: request.dossiers,
      });

      resolution.results.forEach((result) => {
        if (!canProceedToBondIntegration(result)) {
          unresolvedCount += 1;
          conflicts.push(Object.freeze({
            code: 'unresolved-threadmark',
            severity: 'warning',
            message: 'Threadmark was not converted because it did not resolve cleanly.',
            sourceDossierId: request.sourceDossier.id,
            targetDossierId: result.targetDossierId,
            relationshipKey: result.relationshipKey,
          }));
          return;
        }

        resolvedCount += 1;
        const countKey = [
          section.id,
          field?.id ?? 'body',
          result.relationshipKey,
          result.targetDossierId,
        ].join('|');
        const ordinal = occurrenceCounts.get(countKey) ?? 0;
        occurrenceCounts.set(countKey, ordinal + 1);
        const desiredBond = createDesiredBond({
          sourceDossier: request.sourceDossier,
          section,
          field,
          result,
          ordinal,
          role: 'forward',
          generatedAt,
        });

        if ('formValues' in desiredBond) {
          desired.push(desiredBond);

          const targetDossier = findDossier(request.dossiers, result.targetDossierId);
          const inverse = getInverseRelationshipKey({
            result,
            sourceDossier: request.sourceDossier,
            targetDossier,
          });

          if (inverse.mode === 'contextual-neutral') {
            contextualInverseCount += 1;
            neutralInverseFallbackCount += 1;
          } else if (inverse.mode === 'suggested') {
            suggestedInverseCount += 1;
          } else if (inverse.mode === 'skipped' || inverse.mode === 'none') {
            inverseSkippedCount += 1;
          }

          if (inverse.conflict) {
            conflicts.push(inverse.conflict);
          }

          if (inverse.key && result.targetDossierId) {
            const inverseDesiredBond = createDesiredBond({
              sourceDossier: request.sourceDossier,
              section,
              field,
              result,
              ordinal,
              role: 'inverse',
              generatedAt,
              sourceRelationshipKey: result.relationshipKey,
              effectiveRelationshipKey: inverse.key,
              effectiveSourceDossierId: result.targetDossierId,
              effectiveTargetDossierId: request.sourceDossier.id,
              ownerId: desiredBond.ownerId,
              pairId: desiredBond.pairId,
            });

            if ('formValues' in inverseDesiredBond) {
              desired.push(inverseDesiredBond);
            } else {
              conflicts.push(inverseDesiredBond);
            }
          }
        } else {
          conflicts.push(desiredBond);
        }
      });
    });
  });

  return {
    desired,
    conflicts,
    unresolvedCount,
    resolvedCount,
    contextualInverseCount,
    neutralInverseFallbackCount,
    suggestedInverseCount,
    inverseSkippedCount,
  };
}

function withGeneratedAt(desired: ThreadmarkDesiredBond, generatedAt: string) {
  const metadata = { ...desired.metadata, generatedAt };

  return Object.freeze({
    ...desired,
    metadata,
    formValues: {
      ...desired.formValues,
      threadmark: metadata,
    },
  });
}

function getPairIntegrity(plan: ThreadmarkReconciliationPlan) {
  const desiredPairs = new Map<string, { forward: boolean; inverse: boolean }>();
  const generatedPairs = new Map<string, { forward: boolean; inverse: boolean }>();

  plan.desired.forEach((desired) => {
    const pair = desiredPairs.get(desired.pairId) ?? { forward: false, inverse: false };
    pair[desired.role] = true;
    desiredPairs.set(desired.pairId, pair);
  });

  plan.generated.forEach((bond) => {
    if (!bond.threadmark?.pairId) {
      return;
    }

    const pair = generatedPairs.get(bond.threadmark.pairId) ?? { forward: false, inverse: false };
    pair[bond.threadmark.role] = true;
    generatedPairs.set(bond.threadmark.pairId, pair);
  });

  let completePairCount = 0;
  let incompletePairCount = 0;
  let missingForwardCount = 0;
  let missingInverseCount = 0;

  desiredPairs.forEach((desiredPair, pairId) => {
    const generatedPair = generatedPairs.get(pairId) ?? { forward: false, inverse: false };
    const forwardComplete = !desiredPair.forward || generatedPair.forward;
    const inverseComplete = !desiredPair.inverse || generatedPair.inverse;

    if (forwardComplete && inverseComplete) {
      completePairCount += 1;
      return;
    }

    incompletePairCount += 1;

    if (!forwardComplete) {
      missingForwardCount += 1;
    }

    if (!inverseComplete) {
      missingInverseCount += 1;
    }
  });

  return {
    completePairCount,
    incompletePairCount,
    missingForwardCount,
    missingInverseCount,
  };
}

function updateDiagnostics(
  plan: ThreadmarkReconciliationPlan,
  sectionCount: number,
  resolvedCount: number,
  collected?: ReturnType<typeof collectDesiredBonds>,
) {
  const pairIntegrity = getPairIntegrity(plan);
  const desiredForwardCount = plan.desired.filter((desired) => desired.role === 'forward').length;
  const desiredInverseCount = plan.desired.filter((desired) => desired.role === 'inverse').length;
  const createdForwardCount = plan.create.filter((desired) => desired.role === 'forward').length;
  const createdInverseCount = plan.create.filter((desired) => desired.role === 'inverse').length;

  latestReconciliationDiagnostics = Object.freeze({
    reconciliationVersion: THREADMARK_RECONCILIATION_VERSION,
    reconciliationAvailable: true,
    mostRecentSourceDossierId: plan.sourceDossierId,
    mostRecentSectionCount: sectionCount,
    mostRecentResolvedThreadmarkCount: resolvedCount,
    desiredBondCount: plan.desired.length,
    generatedBondCount: plan.generated.length,
    createActionCount: plan.create.length,
    updateActionCount: plan.update.length,
    removeActionCount: plan.remove.length,
    conflictCount: plan.conflicts.length,
    unresolvedThreadmarkCount: plan.summary.unresolvedCount,
    executionFailureCount,
    desiredForwardCount,
    desiredInverseCount,
    createdForwardCount,
    createdInverseCount,
    missingForwardCount: pairIntegrity.missingForwardCount,
    missingInverseCount: pairIntegrity.missingInverseCount,
    completePairCount: pairIntegrity.completePairCount,
    incompletePairCount: pairIntegrity.incompletePairCount,
    contextualInverseCount: collected?.contextualInverseCount ?? latestReconciliationDiagnostics.contextualInverseCount,
    neutralInverseFallbackCount:
      collected?.neutralInverseFallbackCount ?? latestReconciliationDiagnostics.neutralInverseFallbackCount,
    suggestedInverseCount: collected?.suggestedInverseCount ?? latestReconciliationDiagnostics.suggestedInverseCount,
    inverseSkippedCount: collected?.inverseSkippedCount ?? latestReconciliationDiagnostics.inverseSkippedCount,
    pairIntegrityFailureCount: pairIntegrity.incompletePairCount,
    generatedBondsPendingUpload:
      plan.create.length + plan.update.length,
    generatedForwardBondsPendingUpload:
      plan.create.filter((desired) => desired.role === 'forward').length +
      plan.update.filter((entry) => entry.desired.role === 'forward').length,
    generatedInverseBondsPendingUpload:
      plan.create.filter((desired) => desired.role === 'inverse').length +
      plan.update.filter((entry) => entry.desired.role === 'inverse').length,
    generatedBondsUploaded: 0,
    generatedBondsVerifiedInCloud: 0,
    generatedBondsRetrieved: 0,
    generatedMetadataPreserved: true,
    lastFailedBondId,
    lastFailedStage,
    fieldKitBondRefreshCompleted,
  });
}

export function planThreadmarkBondReconciliation(
  request: ThreadmarkReconciliationRequest,
): ThreadmarkReconciliationPlan {
  const generatedAt = new Date().toISOString();
  const currentGenerated = request.bonds.filter(isThreadmarkGeneratedBond);
  const currentManual = request.bonds.filter((bond) => !isThreadmarkGeneratedBond(bond));
  const sourceGenerated = currentGenerated.filter(
    (bond) => getThreadmarkMetadata(bond)?.sourceDossierId === request.sourceDossier.id,
  );
  const collected = collectDesiredBonds(request, generatedAt);
  const conflicts = [...collected.conflicts];
  const generatedByKey = new Map(sourceGenerated.map((bond) => [generatedBondKey(bond), bond]));
  const desiredByKey = new Map<string, ThreadmarkDesiredBond>();

  collected.desired.forEach((desired) => {
    const existing = generatedByKey.get(desiredBondKey(desired));
    desiredByKey.set(
      desiredBondKey(desired),
      existing?.threadmark?.generatedAt ? withGeneratedAt(desired, existing.threadmark.generatedAt) : desired,
    );
  });

  const create: ThreadmarkDesiredBond[] = [];
  const update: Array<{ bond: Bond; desired: ThreadmarkDesiredBond }> = [];
  const remove: Bond[] = [];

  desiredByKey.forEach((desired) => {
    const existing = generatedByKey.get(desiredBondKey(desired));
    const manualConflict = currentManual.find((bond) => sameUndirectedBondShape(bond, desired.formValues));

    if (manualConflict) {
      conflicts.push(Object.freeze({
        code: 'manual-bond-satisfies-threadmark',
        severity: 'info',
        message: 'A manual Bond already satisfies this Threadmark.',
        ownerId: desired.ownerId,
        relationshipKey: desired.metadata.relationshipKey,
        sourceDossierId: desired.metadata.sourceDossierId,
        targetDossierId: desired.metadata.targetDossierId,
        bondId: manualConflict.id,
      }));
      return;
    }

    const idConflict = request.bonds.find((bond) => bond.id === desired.id && !isThreadmarkGeneratedBond(bond));

    if (idConflict) {
      conflicts.push(Object.freeze({
        code: 'generated-bond-id-conflict',
        severity: 'error',
        message: 'A manual Bond already uses the deterministic Threadmark Bond ID.',
        ownerId: desired.ownerId,
        relationshipKey: desired.metadata.relationshipKey,
        sourceDossierId: desired.metadata.sourceDossierId,
        targetDossierId: desired.metadata.targetDossierId,
        bondId: idConflict.id,
      }));
      return;
    }

    if (!existing) {
      create.push(desired);
      return;
    }

    if (!desiredMatchesExisting(existing, desired)) {
      update.push({ bond: existing, desired });
    }
  });

  sourceGenerated.forEach((bond) => {
    if (!desiredByKey.has(generatedBondKey(bond))) {
      remove.push(bond);
    }
  });

  const actions = [
    ...create.map((desired) => Object.freeze({ type: 'create' as const, desired })),
    ...update.map(({ bond, desired }) => Object.freeze({ type: 'update' as const, bond, desired })),
    ...remove.map((bond) => Object.freeze({
      type: 'remove' as const,
      bond,
      reason: 'source-threadmark-removed' as const,
    })),
  ];
  const plan = Object.freeze({
    sourceDossierId: request.sourceDossier.id,
    desired: Array.from(desiredByKey.values()),
    generated: sourceGenerated,
    create,
    update,
    remove,
    conflicts,
    actions,
    summary: {
      desiredCount: desiredByKey.size,
      generatedCount: sourceGenerated.length,
      createCount: create.length,
      updateCount: update.length,
      removeCount: remove.length,
      conflictCount: conflicts.length,
      unresolvedCount: collected.unresolvedCount,
    },
  });

  updateDiagnostics(plan, request.sections.length, collected.resolvedCount, collected);
  return plan;
}

export async function executeThreadmarkBondReconciliation(
  request: ThreadmarkReconciliationRequest,
  executor: ThreadmarkReconciliationExecutor,
): Promise<ThreadmarkReconciliationExecutionResult> {
  const plan = planThreadmarkBondReconciliation(request);
  const created: Bond[] = [];
  const updated: Bond[] = [];
  const removed: Bond[] = [];

  try {
    for (const desired of plan.create) {
      try {
        created.push(await executor.createBond(desired.formValues));
      } catch (error) {
        lastFailedBondId = desired.id;
        lastFailedStage = `create-${desired.role}`;
        throw error;
      }
    }

    for (const update of plan.update) {
      try {
        updated.push(await executor.updateBond(update.bond.id, update.desired.formValues));
      } catch (error) {
        lastFailedBondId = update.bond.id;
        lastFailedStage = `update-${update.desired.role}`;
        throw error;
      }
    }

    for (const bond of plan.remove) {
      try {
        await executor.deleteBond(bond.id);
        removed.push(bond);
      } catch (error) {
        lastFailedBondId = bond.id;
        lastFailedStage = `remove-${bond.threadmark?.role ?? 'unknown'}`;
        throw error;
      }
    }
  } catch (error) {
    executionFailureCount += 1;
    updateDiagnostics(plan, request.sections.length, plan.summary.desiredCount);
    throw error;
  }

  lastFailedBondId = null;
  lastFailedStage = 'None';
  updateDiagnostics(plan, request.sections.length, plan.summary.desiredCount);

  return Object.freeze({
    plan,
    created,
    updated,
    removed,
  });
}

export function getThreadmarkReconciliationDiagnostics() {
  return latestReconciliationDiagnostics;
}

export function markThreadmarkFieldKitBondRefreshCompleted() {
  fieldKitBondRefreshCompleted = true;
  latestReconciliationDiagnostics = Object.freeze({
    ...latestReconciliationDiagnostics,
    fieldKitBondRefreshCompleted,
  });
}

export function recordThreadmarkSynchronizationDiagnostics(
  diagnostics: Partial<ThreadmarkReconciliationDiagnostics>,
) {
  latestReconciliationDiagnostics = Object.freeze({
    ...latestReconciliationDiagnostics,
    ...diagnostics,
  });
}
