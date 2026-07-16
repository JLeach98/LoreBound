import {
  builtInBondTypes,
  type Bond,
  type BondFormValues,
  type ThreadmarkBondMetadata,
  type ThreadmarkBondRole,
} from '../cases/types/bondTypes';
import type { Dossier, DossierSection, DossierSectionField } from '../cases/types/dossierTypes';
import { getThreadmarkDefinition } from './threadmarkSelectors';
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
});

let latestReconciliationDiagnostics = defaultReconciliationDiagnostics;
let executionFailureCount = 0;

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
}: {
  sourceDossier: Dossier;
  section: DossierSection;
  field?: DossierSectionField;
  result: ThreadmarkResolutionResult;
  ordinal: number;
  role: ThreadmarkBondRole;
  generatedAt: string;
}): ThreadmarkDesiredBond | ThreadmarkReconciliationConflict {
  const relationshipKey = result.relationshipKey;
  const targetDossierId = result.targetDossierId;

  if (!relationshipKey || !targetDossierId) {
    return Object.freeze({
      code: 'unresolved-threadmark',
      severity: 'warning',
      message: 'Threadmark could not be resolved into a Bond.',
      sourceDossierId: sourceDossier.id,
      relationshipKey,
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
      targetDossierId,
      relationshipKey,
    });
  }

  const ownerId = [
    'threadmark',
    sourceDossier.id,
    section.id,
    field?.id ?? 'body',
    relationshipKey,
    targetDossierId,
    ordinal,
  ].join(':');
  const pairId = stableThreadmarkId(
    'threadmark-pair',
    `${sourceDossier.id}:${targetDossierId}:${relationshipKey}:${ownerId}`,
  );
  const metadata: ThreadmarkBondMetadata = {
    origin: 'threadmark',
    ownerId,
    sourceDossierId: sourceDossier.id,
    sourceSectionId: section.id,
    relationshipKey,
    targetDossierId,
    occurrenceFingerprint: occurrenceFingerprint({ section, field, result }),
    generatedAt,
    registryVersion: THREADMARK_REGISTRY_VERSION,
    parserVersion: result.parserVersion || THREADMARK_PARSER_VERSION,
    resolverVersion: result.resolverVersion || THREADMARK_RESOLVER_VERSION,
    reconciliationVersion: THREADMARK_RECONCILIATION_VERSION,
    pairId,
    role,
  };
  const formValues: BondFormValues = {
    id: stableThreadmarkId('bond-threadmark', `${ownerId}:${role}`),
    sourceDossierId: sourceDossier.id,
    targetDossierId,
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
    ownerId,
    pairId,
    role,
    formValues,
    metadata,
    resolution: result,
  });
}

function collectDesiredBonds(request: ThreadmarkReconciliationRequest, generatedAt: string) {
  const desired: ThreadmarkDesiredBond[] = [];
  const conflicts: ThreadmarkReconciliationConflict[] = [];
  const occurrenceCounts = new Map<string, number>();
  let unresolvedCount = 0;
  let resolvedCount = 0;

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
        } else {
          conflicts.push(desiredBond);
        }
      });
    });
  });

  return { desired, conflicts, unresolvedCount, resolvedCount };
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

function updateDiagnostics(plan: ThreadmarkReconciliationPlan, sectionCount: number, resolvedCount: number) {
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

  updateDiagnostics(plan, request.sections.length, collected.resolvedCount);
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
      created.push(await executor.createBond(desired.formValues));
    }

    for (const update of plan.update) {
      updated.push(await executor.updateBond(update.bond.id, update.desired.formValues));
    }

    for (const bond of plan.remove) {
      await executor.deleteBond(bond.id);
      removed.push(bond);
    }
  } catch (error) {
    executionFailureCount += 1;
    updateDiagnostics(plan, request.sections.length, plan.summary.desiredCount);
    throw error;
  }

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
