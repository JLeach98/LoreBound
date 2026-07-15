import type { Bond } from '../../cases/types/bondTypes';
import type { LoreCase } from '../../cases/types/caseTypes';
import type { Dossier, DossierType } from '../../cases/types/dossierTypes';

export const fieldKitDossierTypes: DossierType[] = [
  'Character',
  'Location',
  'Event',
  'Organization',
  'Theory',
  'Artifact',
];

export const fieldKitDossierPluralLabels: Record<DossierType, string> = {
  Character: 'Characters',
  Location: 'Locations',
  Event: 'Events',
  Organization: 'Organizations',
  Theory: 'Theories',
  Artifact: 'Artifacts',
};

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
  if (dossier.dossierType === 'Character') {
    return dossier.alias || dossier.affiliation || dossier.characterStatus || 'Character Dossier';
  }

  if (dossier.dossierType === 'Location') {
    return [dossier.region, dossier.world].filter(Boolean).join(', ') || 'Location Dossier';
  }

  if (dossier.dossierType === 'Event') {
    return [dossier.eventDate, dossier.era].filter(Boolean).join(', ') || 'Event Dossier';
  }

  if (dossier.dossierType === 'Organization') {
    return [dossier.organizationType, dossier.leader].filter(Boolean).join(', ') || 'Organization Dossier';
  }

  if (dossier.dossierType === 'Theory') {
    return [dossier.theoryStatus, dossier.theoryConfidence].filter(Boolean).join(', ') || 'Theory Dossier';
  }

  return dossier.summary || 'Artifact Dossier';
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
