import type { Bond } from '../../cases/types/bondTypes';
import type { LoreCase } from '../../cases/types/caseTypes';
import type { Dossier, DossierType } from '../../cases/types/dossierTypes';
import { dossierTypeLabels } from '../../cases/types/dossierTypes';
import { ensureDossierSections } from '../../cases/utils/dossierSections';

export const fieldKitDossierTypes = [
  'Character',
  'Location',
  'Event',
  'Organization',
  'Theory',
] as const satisfies readonly DossierType[];

export type KnowledgeTypeConfig = {
  canonicalKey: KnowledgeTypeKey | 'unknown';
  dossierType: DossierType | null;
  singularLabel: string;
  pluralLabel: string;
  fallbackIcon: string;
  defaultSectionTemplateId: string;
  getIdentityMetadata: (dossier: Dossier) => string[];
  getListPreview: (dossier: Dossier) => string;
  getDetailHeader: (dossier: Dossier) => string;
};

export type KnowledgeTypeKey = 'character' | 'location' | 'event' | 'organization' | 'theory';
type FieldKitSupportedDossierType = (typeof fieldKitDossierTypes)[number];

const knowledgeTypeAliases: Record<string, KnowledgeTypeKey> = {
  character: 'character',
  characters: 'character',
  'character dossier': 'character',
  location: 'location',
  locations: 'location',
  'location dossier': 'location',
  event: 'event',
  events: 'event',
  'event dossier': 'event',
  organization: 'organization',
  organizations: 'organization',
  organisation: 'organization',
  organisations: 'organization',
  'organization dossier': 'organization',
  theory: 'theory',
  theories: 'theory',
  'theory dossier': 'theory',
};

export function normalizeKnowledgeType(type: unknown): KnowledgeTypeKey | 'unknown' {
  if (typeof type !== 'string') {
    return 'unknown';
  }

  return knowledgeTypeAliases[type.trim().toLocaleLowerCase()] ?? 'unknown';
}

export const knowledgeTypeConfigs: Record<KnowledgeTypeKey, KnowledgeTypeConfig> = {
  character: {
    canonicalKey: 'character',
    dossierType: 'Character',
    singularLabel: dossierTypeLabels.Character,
    pluralLabel: 'Characters',
    fallbackIcon: 'person',
    defaultSectionTemplateId: 'identity',
    getIdentityMetadata: (dossier) => [dossier.alias, dossier.characterStatus, dossier.affiliation].filter(Boolean) as string[],
    getListPreview: (dossier) => dossier.alias || dossier.affiliation || dossier.characterStatus || 'Character Dossier',
    getDetailHeader: (dossier) => dossier.summary || dossier.alias || dossier.affiliation || 'Character Dossier',
  },
  location: {
    canonicalKey: 'location',
    dossierType: 'Location',
    singularLabel: dossierTypeLabels.Location,
    pluralLabel: 'Locations',
    fallbackIcon: 'place',
    defaultSectionTemplateId: 'identity',
    getIdentityMetadata: (dossier) => [dossier.region, dossier.world].filter(Boolean) as string[],
    getListPreview: (dossier) => [dossier.region, dossier.world].filter(Boolean).join(', ') || 'Location Dossier',
    getDetailHeader: (dossier) => dossier.summary || [dossier.region, dossier.world].filter(Boolean).join(', ') || 'Location Dossier',
  },
  event: {
    canonicalKey: 'event',
    dossierType: 'Event',
    singularLabel: dossierTypeLabels.Event,
    pluralLabel: 'Events',
    fallbackIcon: 'event',
    defaultSectionTemplateId: 'timeline',
    getIdentityMetadata: (dossier) => [dossier.eventDate, dossier.era].filter(Boolean) as string[],
    getListPreview: (dossier) => [dossier.eventDate, dossier.era].filter(Boolean).join(', ') || 'Event Dossier',
    getDetailHeader: (dossier) => dossier.summary || [dossier.eventDate, dossier.era].filter(Boolean).join(', ') || 'Event Dossier',
  },
  organization: {
    canonicalKey: 'organization',
    dossierType: 'Organization',
    singularLabel: dossierTypeLabels.Organization,
    pluralLabel: 'Organizations',
    fallbackIcon: 'organization',
    defaultSectionTemplateId: 'identity',
    getIdentityMetadata: (dossier) => [dossier.organizationType, dossier.leader].filter(Boolean) as string[],
    getListPreview: (dossier) => [dossier.organizationType, dossier.leader].filter(Boolean).join(', ') || 'Organization Dossier',
    getDetailHeader: (dossier) => dossier.summary || [dossier.organizationType, dossier.leader].filter(Boolean).join(', ') || 'Organization Dossier',
  },
  theory: {
    canonicalKey: 'theory',
    dossierType: 'Theory',
    singularLabel: dossierTypeLabels.Theory,
    pluralLabel: 'Theories',
    fallbackIcon: 'theory',
    defaultSectionTemplateId: 'evidence',
    getIdentityMetadata: (dossier) => [dossier.theoryStatus, dossier.theoryConfidence].filter(Boolean) as string[],
    getListPreview: (dossier) => [dossier.theoryStatus, dossier.theoryConfidence].filter(Boolean).join(', ') || 'Theory Dossier',
    getDetailHeader: (dossier) => dossier.summary || [dossier.theoryStatus, dossier.theoryConfidence].filter(Boolean).join(', ') || 'Theory Dossier',
  },
};

export const genericKnowledgeTypeConfig: KnowledgeTypeConfig = {
  canonicalKey: 'unknown',
  dossierType: null,
  singularLabel: 'Unknown Dossier Type',
  pluralLabel: 'Dossiers',
  fallbackIcon: 'dossier',
  defaultSectionTemplateId: 'overview',
  getIdentityMetadata: () => [],
  getListPreview: (dossier) => dossier.summary || 'Shared Dossier information available',
  getDetailHeader: (dossier) => dossier.summary || 'Shared Dossier information available',
};

export const fieldKitDossierPluralLabels: Record<DossierType, string> = {
  Character: knowledgeTypeConfigs.character.pluralLabel,
  Location: knowledgeTypeConfigs.location.pluralLabel,
  Event: knowledgeTypeConfigs.event.pluralLabel,
  Organization: knowledgeTypeConfigs.organization.pluralLabel,
  Theory: knowledgeTypeConfigs.theory.pluralLabel,
  Artifact: 'Artifacts',
};

export function getKnowledgeTypeConfig(type: unknown) {
  const canonicalKey = normalizeKnowledgeType(type);

  if (canonicalKey !== 'unknown') {
    return knowledgeTypeConfigs[canonicalKey];
  }

  return genericKnowledgeTypeConfig;
}

export function hasKnowledgeTypeConfig(type: unknown) {
  return normalizeKnowledgeType(type) !== 'unknown';
}

export function getDossierTypeFromKnowledgeType(type: unknown): FieldKitSupportedDossierType | null {
  return getKnowledgeTypeConfig(type).dossierType as FieldKitSupportedDossierType | null;
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'LB';
}

export function getDossierSecondaryLine(dossier: Dossier) {
  const sections = ensureDossierSections(dossier);
  const identityValues = sections
    .find((section) => section.kind === 'identity')
    ?.fields?.map((field) => field.value)
    .filter(Boolean);
  const overview = sections.find((section) => section.kind === 'overview')?.body;
  const notes = sections.find((section) => section.kind === 'notes')?.body;
  const sectionPreview = [...(identityValues ?? []), overview, notes]
    .find((value) => value?.trim())
    ?.trim();

  if (sectionPreview) {
    return sectionPreview;
  }

  return getKnowledgeTypeConfig(dossier.dossierType).getListPreview(dossier);
}

export function getCaseSecondaryLine(loreCase: LoreCase) {
  return [loreCase.universeType, loreCase.authorOrCreator].filter(Boolean).join(' / ');
}

export function getBondLabel(bond: Bond, currentDossierId?: string) {
  if (!currentDossierId || bond.bondBehavior === 'Symmetric') {
    return bond.sourceLabel || bond.bondType;
  }

  if (currentDossierId === bond.targetDossierId) {
    return bond.targetLabel || bond.sourceLabel || bond.bondType;
  }

  return bond.sourceLabel || bond.bondType;
}
