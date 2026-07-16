import type { Dossier, DossierType } from '../cases/types/dossierTypes';
import {
  getThreadmarkReplacement,
  getValidThreadmarksForSourceType,
} from './threadmarkSelectors';
import { normalizeThreadmarkAlias } from './threadmarkValidation';
import type {
  ThreadmarkRelationshipSuggestion,
  ThreadmarkTargetSuggestion,
} from './threadmarkAuthoringTypes';
import type { ThreadmarkDefinition } from './threadmarkTypes';

const defaultLimit = 10;

function scoreTextMatch(query: string, values: readonly string[]) {
  const normalizedQuery = normalizeThreadmarkAlias(query);

  if (!normalizedQuery) {
    return 50;
  }

  for (const [index, value] of values.entries()) {
    const normalizedValue = normalizeThreadmarkAlias(value);

    if (normalizedValue === normalizedQuery) {
      return index + 1;
    }
  }

  for (const [index, value] of values.entries()) {
    const normalizedValue = normalizeThreadmarkAlias(value);

    if (normalizedValue.startsWith(normalizedQuery)) {
      return 10 + index;
    }
  }

  for (const [index, value] of values.entries()) {
    const normalizedValue = normalizeThreadmarkAlias(value);

    if (normalizedValue.includes(normalizedQuery)) {
      return 20 + index;
    }
  }

  return Number.POSITIVE_INFINITY;
}

function targetTypeSummary(definition: ThreadmarkDefinition) {
  return definition.validTargetTypes.join(', ');
}

export function getRelationshipSuggestions({
  query,
  sourceKnowledgeType,
  limit = defaultLimit,
}: {
  query: string;
  sourceKnowledgeType: DossierType;
  limit?: number;
}) {
  return Object.freeze(
    getValidThreadmarksForSourceType(sourceKnowledgeType)
      .map((definition): ThreadmarkRelationshipSuggestion | null => {
        const score = scoreTextMatch(query, [
          definition.key,
          definition.displayName,
          ...definition.aliases,
        ]);

        if (!Number.isFinite(score)) {
          return null;
        }

        return Object.freeze({
          id: definition.key,
          kind: 'relationship',
          definition,
          displayName: getThreadmarkReplacement(definition.key)?.displayName ?? definition.displayName,
          description: definition.description,
          targetTypeSummary: targetTypeSummary(definition),
          isDeprecated: definition.deprecated,
          replacementKey: definition.replacementKey,
          score,
        });
      })
      .filter((suggestion): suggestion is ThreadmarkRelationshipSuggestion => Boolean(suggestion))
      .sort(
        (first, second) =>
          first.score - second.score ||
          first.definition.sortOrder - second.definition.sortOrder ||
          first.displayName.localeCompare(second.displayName),
      )
      .slice(0, limit),
  );
}

function initialsForName(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');

  return initials || 'LB';
}

function dossierAliases(dossier: Dossier) {
  return [
    dossier.alias,
    ...(dossier.sections ?? [])
      .filter((section) => section.title.toLocaleLowerCase().includes('alias'))
      .flatMap((section) => [
        section.body,
        ...(section.fields ?? []).map((field) => field.value),
      ]),
  ].filter((value): value is string => Boolean(value));
}

export function getTargetDossierSuggestions({
  query,
  dossiers,
  sourceDossierId,
  validTargetTypes,
  limit = defaultLimit,
}: {
  query: string;
  dossiers: readonly Dossier[];
  sourceDossierId: string;
  validTargetTypes: readonly DossierType[];
  limit?: number;
}) {
  const startedAt = performance.now();
  const results = dossiers
    .filter((dossier) => dossier.id !== sourceDossierId)
    .filter((dossier) => validTargetTypes.includes(dossier.dossierType))
    .map((dossier): ThreadmarkTargetSuggestion | null => {
      const score = scoreTextMatch(query, [
        dossier.name,
        ...dossierAliases(dossier),
      ]);

      if (!Number.isFinite(score)) {
        return null;
      }

      return Object.freeze({
        id: dossier.id,
        kind: 'target',
        dossier,
        name: dossier.name,
        dossierType: dossier.dossierType,
        secondaryLine: dossier.dossierType,
        initials: initialsForName(dossier.name),
        score,
      });
    })
    .filter((suggestion): suggestion is ThreadmarkTargetSuggestion => Boolean(suggestion))
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.name.localeCompare(second.name) ||
        first.dossierType.localeCompare(second.dossierType),
    )
    .slice(0, limit);

  return Object.freeze({
    results: Object.freeze(results),
    durationMs: Math.max(0, performance.now() - startedAt),
  });
}
