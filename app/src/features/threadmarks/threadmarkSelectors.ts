import type { DossierType } from '../cases/types/dossierTypes';
import type {
  ThreadmarkCategory,
  ThreadmarkDefinition,
  ThreadmarkInverseInput,
  ThreadmarkInverseResolution,
} from './threadmarkTypes';
import { threadmarkRegistry } from './threadmarkRegistry';
import {
  isThreadmarkPairAllowed,
  isThreadmarkSourceAllowed,
  isThreadmarkTargetAllowed,
  normalizeThreadmarkAlias,
} from './threadmarkValidation';

const sortedThreadmarks = Object.freeze(
  [...threadmarkRegistry].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder || first.displayName.localeCompare(second.displayName),
  ),
);

const definitionsByKey = new Map(sortedThreadmarks.map((definition) => [definition.key, definition]));
const definitionsByAlias = new Map<string, ThreadmarkDefinition>();

sortedThreadmarks.forEach((definition) => {
  [
    definition.key,
    definition.displayName,
    ...definition.aliases,
  ].forEach((alias) => {
    const normalizedAlias = normalizeThreadmarkAlias(alias);

    if (normalizedAlias && !definitionsByAlias.has(normalizedAlias)) {
      definitionsByAlias.set(normalizedAlias, definition);
    }
  });
});

export function getThreadmarkDefinition(key: string) {
  return definitionsByKey.get(key);
}

export function getThreadmarkByAlias(input: string) {
  return definitionsByAlias.get(normalizeThreadmarkAlias(input));
}

export function getThreadmarkPrefixMatches(input: string) {
  const normalizedInput = normalizeThreadmarkAlias(input);

  if (!normalizedInput) {
    return Object.freeze([]);
  }

  return Object.freeze(
    sortedThreadmarks.filter((definition) =>
      [
        definition.key,
        definition.displayName,
        ...definition.aliases,
      ].some((alias) => normalizeThreadmarkAlias(alias).startsWith(normalizedInput)),
    ),
  );
}

export function getThreadmarksByCategory(category: ThreadmarkCategory) {
  return Object.freeze(
    sortedThreadmarks.filter((definition) => definition.category === category),
  );
}

export function getRelationshipThreadmarks() {
  return getThreadmarksByCategory('relationship');
}

export function getValidThreadmarksForSourceType(sourceType: DossierType | string) {
  return Object.freeze(
    sortedThreadmarks.filter((definition) =>
      isThreadmarkSourceAllowed(definition, sourceType),
    ),
  );
}

export function getValidThreadmarksForTargetType(targetType: DossierType | string) {
  return Object.freeze(
    sortedThreadmarks.filter((definition) =>
      isThreadmarkTargetAllowed(definition, targetType),
    ),
  );
}

export function getValidThreadmarksForPair(
  sourceType: DossierType | string,
  targetType: DossierType | string,
) {
  return Object.freeze(
    sortedThreadmarks.filter((definition) =>
      isThreadmarkPairAllowed(definition, sourceType, targetType),
    ),
  );
}

export function resolveCanonicalThreadmarkKey(input: string) {
  return getThreadmarkDefinition(input)?.key ?? getThreadmarkByAlias(input)?.key;
}

export function getInverseThreadmark(definitionOrKey: ThreadmarkDefinition | string) {
  const definition =
    typeof definitionOrKey === 'string'
      ? getThreadmarkDefinition(definitionOrKey)
      : definitionOrKey;

  return definition?.inverse ? getThreadmarkDefinition(definition.inverse) : undefined;
}

export function isThreadmarkDeprecated(key: string) {
  return getThreadmarkDefinition(key)?.deprecated ?? false;
}

export function getThreadmarkReplacement(key: string) {
  const replacementKey = getThreadmarkDefinition(key)?.replacementKey;

  return replacementKey ? getThreadmarkDefinition(replacementKey) : undefined;
}

export function resolveInverseThreadmark({
  relationshipKey,
  sourceDossier,
  targetDossier,
}: ThreadmarkInverseInput): ThreadmarkInverseResolution {
  const canonicalKey = resolveCanonicalThreadmarkKey(relationshipKey);
  const definition = canonicalKey ? getThreadmarkDefinition(canonicalKey) : undefined;

  if (!definition) {
    return Object.freeze({
      status: 'none',
      reason: 'Threadmark definition was not found.',
    });
  }

  const inverse = getInverseThreadmark(definition);

  if (!inverse) {
    return Object.freeze({
      status: 'none',
      reason: 'Threadmark has no inverse definition.',
    });
  }

  if (definition.reciprocalBehavior === 'none') {
    return Object.freeze({
      status: 'none',
      reason: 'Threadmark does not define reciprocal behavior.',
    });
  }

  if (definition.reciprocalBehavior === 'contextual') {
    return Object.freeze({
      status: 'context-required',
      key: inverse.key,
      displayName: inverse.displayName,
      reason: 'Threadmark requires context before resolving an inverse.',
    });
  }

  if (
    sourceDossier &&
    targetDossier &&
    !isThreadmarkPairAllowed(inverse, targetDossier.dossierType, sourceDossier.dossierType)
  ) {
    return Object.freeze({
      status: 'context-required',
      key: inverse.key,
      displayName: inverse.displayName,
      reason: 'Inverse Threadmark is not valid for this Knowledge Type pair.',
    });
  }

  return Object.freeze({
    status: 'resolved',
    key: inverse.key,
    displayName: inverse.displayName,
  });
}
