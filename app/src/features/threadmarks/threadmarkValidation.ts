import { dossierTypes } from '../cases/types/dossierTypes';
import type {
  ThreadmarkCategory,
  ThreadmarkDefinition,
  ThreadmarkValidationIssue,
  ThreadmarkValidationResult,
} from './threadmarkTypes';
import { threadmarkCategories } from './threadmarkTypes';

const validCategories = new Set<ThreadmarkCategory>(threadmarkCategories);
const validKnowledgeTypes = new Set<string>(dossierTypes);
const threadmarkDefinitionKeys = [
  'key',
  'category',
  'displayName',
  'aliases',
  'description',
  'directionality',
  'validSourceTypes',
  'validTargetTypes',
  'inverse',
  'reciprocalBehavior',
  'repeatable',
  'deprecated',
  'replacementKey',
  'sortOrder',
] as const;

export function normalizeThreadmarkAlias(value: string) {
  return value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

export function isThreadmarkSourceAllowed(
  definition: ThreadmarkDefinition,
  sourceType: string,
) {
  return definition.validSourceTypes.includes(sourceType as never);
}

export function isThreadmarkTargetAllowed(
  definition: ThreadmarkDefinition,
  targetType: string,
) {
  return definition.validTargetTypes.includes(targetType as never);
}

export function isThreadmarkPairAllowed(
  definition: ThreadmarkDefinition,
  sourceType: string,
  targetType: string,
) {
  return (
    isThreadmarkSourceAllowed(definition, sourceType) &&
    isThreadmarkTargetAllowed(definition, targetType)
  );
}

function pushIssue(
  issues: ThreadmarkValidationIssue[],
  issue: ThreadmarkValidationIssue,
) {
  issues.push(issue);
}

function hasUnsupportedExecutableValue(definition: ThreadmarkDefinition) {
  return Object.values(definition).some((value) => typeof value === 'function');
}

function validateReplacementChains(
  definitionsByKey: Map<string, ThreadmarkDefinition>,
  issues: ThreadmarkValidationIssue[],
) {
  definitionsByKey.forEach((definition) => {
    if (!definition.replacementKey) {
      return;
    }

    if (!definitionsByKey.has(definition.replacementKey)) {
      pushIssue(issues, {
        code: 'invalid-replacement',
        key: definition.key,
        value: definition.replacementKey,
        message: `Threadmark "${definition.key}" references a missing replacement.`,
      });
      return;
    }

    const visited = new Set<string>([definition.key]);
    let nextKey: string | undefined = definition.replacementKey;

    while (nextKey) {
      if (visited.has(nextKey)) {
        pushIssue(issues, {
          code: 'replacement-loop',
          key: definition.key,
          value: nextKey,
          message: `Threadmark "${definition.key}" has a replacement loop.`,
        });
        return;
      }

      visited.add(nextKey);
      nextKey = definitionsByKey.get(nextKey)?.replacementKey;
    }
  });
}

export function validateThreadmarkRegistry(
  definitions: readonly ThreadmarkDefinition[],
): ThreadmarkValidationResult {
  const issues: ThreadmarkValidationIssue[] = [];
  const keys = new Set<string>();
  const aliases = new Map<string, string>();
  const definitionsByKey = new Map<string, ThreadmarkDefinition>();

  definitions.forEach((definition) => {
    if (keys.has(definition.key)) {
      pushIssue(issues, {
        code: 'duplicate-key',
        key: definition.key,
        message: `Duplicate Threadmark key "${definition.key}".`,
      });
    }

    keys.add(definition.key);
    definitionsByKey.set(definition.key, definition);
  });

  definitions.forEach((definition) => {
    const entryAliases = new Set<string>();
    const normalizedDisplayName = normalizeThreadmarkAlias(definition.displayName);

    if (!definition.displayName.trim()) {
      pushIssue(issues, {
        code: 'missing-display-name',
        key: definition.key,
        message: `Threadmark "${definition.key}" is missing a display name.`,
      });
    }

    if (!Number.isFinite(definition.sortOrder)) {
      pushIssue(issues, {
        code: 'invalid-sort-order',
        key: definition.key,
        message: `Threadmark "${definition.key}" has an invalid sort order.`,
      });
    }

    if (!validCategories.has(definition.category)) {
      pushIssue(issues, {
        code: 'invalid-category',
        key: definition.key,
        value: definition.category,
        message: `Threadmark "${definition.key}" has an invalid category.`,
      });
    }

    if (definition.aliases.length === 0) {
      pushIssue(issues, {
        code: 'missing-alias',
        key: definition.key,
        message: `Threadmark "${definition.key}" must define at least one alias.`,
      });
    }

    definition.aliases.forEach((alias) => {
      const normalizedAlias = normalizeThreadmarkAlias(alias);

      if (!normalizedAlias) {
        pushIssue(issues, {
          code: 'missing-alias',
          key: definition.key,
          message: `Threadmark "${definition.key}" includes an empty alias.`,
        });
        return;
      }

      if (entryAliases.has(normalizedAlias) || normalizedAlias === normalizedDisplayName) {
        pushIssue(issues, {
          code: 'duplicate-entry-alias',
          key: definition.key,
          value: alias,
          message: `Threadmark "${definition.key}" includes a duplicate alias.`,
        });
      }

      entryAliases.add(normalizedAlias);

      const existingKey = aliases.get(normalizedAlias);

      if (existingKey && existingKey !== definition.key) {
        pushIssue(issues, {
          code: 'duplicate-alias',
          key: definition.key,
          value: alias,
          message: `Alias "${alias}" is already used by Threadmark "${existingKey}".`,
        });
      } else {
        aliases.set(normalizedAlias, definition.key);
      }
    });

    [...definition.validSourceTypes, ...definition.validTargetTypes].forEach((knowledgeType) => {
      if (!validKnowledgeTypes.has(knowledgeType)) {
        pushIssue(issues, {
          code: 'invalid-knowledge-type',
          key: definition.key,
          value: knowledgeType,
          message: `Threadmark "${definition.key}" references an invalid Knowledge Type.`,
        });
      }
    });

    if (definition.inverse && !definitionsByKey.has(definition.inverse)) {
      pushIssue(issues, {
        code: 'missing-inverse',
        key: definition.key,
        value: definition.inverse,
        message: `Threadmark "${definition.key}" references a missing inverse.`,
      });
    }

    if (
      definition.inverse === definition.key &&
      definition.directionality !== 'symmetric'
    ) {
      pushIssue(issues, {
        code: 'invalid-self-inverse',
        key: definition.key,
        message: `Threadmark "${definition.key}" cannot be self-inverse unless symmetric.`,
      });
    }

    if (
      definition.directionality === 'symmetric' &&
      definition.inverse !== definition.key
    ) {
      pushIssue(issues, {
        code: 'incoherent-symmetric',
        key: definition.key,
        value: definition.inverse,
        message: `Symmetric Threadmark "${definition.key}" must be self-inverse.`,
      });
    }

    if (hasUnsupportedExecutableValue(definition)) {
      pushIssue(issues, {
        code: 'unsupported-executable-value',
        key: definition.key,
        message: `Threadmark "${definition.key}" contains an executable value.`,
      });
    }

    Object.keys(definition).forEach((key) => {
      if (!threadmarkDefinitionKeys.includes(key as never)) {
        const value = (definition as unknown as Record<string, unknown>)[key];

        if (typeof value === 'function') {
          pushIssue(issues, {
            code: 'unsupported-executable-value',
            key: definition.key,
            value: key,
            message: `Threadmark "${definition.key}" contains unsupported executable metadata.`,
          });
        }
      }
    });
  });

  validateReplacementChains(definitionsByKey, issues);

  return Object.freeze({
    passed: issues.length === 0,
    issues: Object.freeze(issues),
    duplicateAliasCount: issues.filter((issue) => issue.code === 'duplicate-alias').length,
    missingInverseCount: issues.filter((issue) => issue.code === 'missing-inverse').length,
    invalidKnowledgeTypeRuleCount: issues.filter(
      (issue) => issue.code === 'invalid-knowledge-type',
    ).length,
  });
}

