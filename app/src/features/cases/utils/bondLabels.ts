import type { Bond } from '../types/bondTypes';
import type { Dossier } from '../types/dossierTypes';

export function getBondLabelFromPerspective(bond: Bond, dossierId: string) {
  if (bond.bondBehavior === 'Symmetric') {
    return bond.sourceLabel ?? bond.bondType;
  }

  if (bond.bondBehavior === 'Inverse') {
    return dossierId === bond.sourceDossierId
      ? (bond.sourceLabel ?? bond.bondType)
      : (bond.targetLabel ?? bond.bondType);
  }

  if (dossierId === bond.sourceDossierId) {
    return bond.sourceLabel ?? bond.bondType;
  }

  return `Connected through: ${bond.sourceLabel ?? bond.bondType}`;
}

export function getConnectedDossier(bond: Bond, dossierId: string, dossiers: Dossier[]) {
  const connectedId =
    bond.sourceDossierId === dossierId ? bond.targetDossierId : bond.sourceDossierId;

  return dossiers.find((dossier) => dossier.id === connectedId) ?? null;
}

export function getBondDisplayLabel(bond: Bond) {
  if (bond.bondBehavior === 'Inverse' && bond.sourceLabel && bond.targetLabel) {
    return `${bond.sourceLabel} / ${bond.targetLabel}`;
  }

  return bond.sourceLabel ?? bond.bondType;
}
