import type { Dossier, DossierType } from '../cases/types/dossierTypes';

export const THREADMARK_REGISTRY_VERSION = 1;

export const threadmarkCategories = ['relationship'] as const;

export type ThreadmarkCategory = (typeof threadmarkCategories)[number];
export type ThreadmarkDirectionality = 'directional' | 'symmetric' | 'contextual';
export type ThreadmarkReciprocalBehavior = 'automatic' | 'suggested' | 'none' | 'contextual';
export type ThreadmarkInverseStatus = 'resolved' | 'context-required' | 'none';

export type ThreadmarkDefinition = Readonly<{
  key: string;
  category: ThreadmarkCategory;
  displayName: string;
  aliases: readonly string[];
  description: string;
  directionality: ThreadmarkDirectionality;
  validSourceTypes: readonly DossierType[];
  validTargetTypes: readonly DossierType[];
  inverse?: string;
  reciprocalBehavior: ThreadmarkReciprocalBehavior;
  repeatable: boolean;
  deprecated: boolean;
  replacementKey?: string;
  sortOrder: number;
}>;

export type ThreadmarkInverseInput = {
  relationshipKey: string;
  sourceDossier?: Pick<Dossier, 'dossierType' | 'name'> | null;
  targetDossier?: Pick<Dossier, 'dossierType' | 'name'> | null;
};

export type ThreadmarkInverseResolution = Readonly<{
  status: ThreadmarkInverseStatus;
  key?: string;
  displayName?: string;
  reason?: string;
}>;

export type ThreadmarkValidationIssue = Readonly<{
  code:
    | 'duplicate-key'
    | 'duplicate-alias'
    | 'duplicate-entry-alias'
    | 'invalid-category'
    | 'invalid-knowledge-type'
    | 'missing-inverse'
    | 'invalid-self-inverse'
    | 'incoherent-symmetric'
    | 'invalid-replacement'
    | 'replacement-loop'
    | 'invalid-sort-order'
    | 'missing-display-name'
    | 'missing-alias'
    | 'unsupported-executable-value';
  key?: string;
  value?: string;
  message: string;
}>;

export type ThreadmarkValidationResult = Readonly<{
  passed: boolean;
  issues: readonly ThreadmarkValidationIssue[];
  duplicateAliasCount: number;
  missingInverseCount: number;
  invalidKnowledgeTypeRuleCount: number;
}>;

export type ThreadmarkRegistryDiagnostics = Readonly<{
  version: number;
  totalDefinitions: number;
  relationshipDefinitionCount: number;
  aliasCount: number;
  deprecatedDefinitionCount: number;
  validationPassed: boolean;
  duplicateAliasCount: number;
  missingInverseCount: number;
  invalidKnowledgeTypeRuleCount: number;
  bondTypeMappingCoverage: string;
  unmappedBondTypeCount: number;
}>;

