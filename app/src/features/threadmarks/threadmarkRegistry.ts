import type { ThreadmarkDefinition } from './threadmarkTypes';
import { THREADMARK_REGISTRY_VERSION } from './threadmarkTypes';
import { getBondTypeMappingCoverage, getUnmappedBuiltInBondTypes } from './bondThreadmarkCompatibility';
import { relationshipThreadmarks } from './relationshipThreadmarks';
import { validateThreadmarkRegistry } from './threadmarkValidation';

// Registry contract: keys are stable, aliases may expand, display names may evolve,
// deprecated keys remain resolvable, and removals require explicit migration planning.
export const threadmarkRegistry = Object.freeze([
  ...relationshipThreadmarks,
] as const satisfies readonly ThreadmarkDefinition[]);

export const threadmarkRegistryValidation = validateThreadmarkRegistry(threadmarkRegistry);

if (import.meta.env.DEV && !threadmarkRegistryValidation.passed) {
  throw new Error(
    `Threadmark registry validation failed: ${threadmarkRegistryValidation.issues
      .map((issue) => issue.message)
      .join(' ')}`,
  );
}

export const threadmarkRegistryDiagnostics = Object.freeze({
  version: THREADMARK_REGISTRY_VERSION,
  totalDefinitions: threadmarkRegistry.length,
  relationshipDefinitionCount: threadmarkRegistry.filter(
    (definition) => definition.category === 'relationship',
  ).length,
  aliasCount: threadmarkRegistry.reduce(
    (total, definition) => total + definition.aliases.length,
    0,
  ),
  deprecatedDefinitionCount: threadmarkRegistry.filter((definition) => definition.deprecated)
    .length,
  validationPassed: threadmarkRegistryValidation.passed,
  duplicateAliasCount: threadmarkRegistryValidation.duplicateAliasCount,
  missingInverseCount: threadmarkRegistryValidation.missingInverseCount,
  invalidKnowledgeTypeRuleCount: threadmarkRegistryValidation.invalidKnowledgeTypeRuleCount,
  bondTypeMappingCoverage: getBondTypeMappingCoverage(),
  unmappedBondTypeCount: getUnmappedBuiltInBondTypes().length,
});

