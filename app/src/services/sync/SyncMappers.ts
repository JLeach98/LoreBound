import type { BoardPin } from '../../features/cases/types/boardTypes';
import type { Bond, BondEvidence } from '../../features/cases/types/bondTypes';
import type { LoreCase, UniverseType } from '../../features/cases/types/caseTypes';
import type {
  CharacterStatus,
  Dossier,
  DossierType,
  TheoryConfidence,
  TheoryStatus,
} from '../../features/cases/types/dossierTypes';
import type {
  CloudBoardEntryRow,
  CloudBondRow,
  CloudCaseRow,
  CloudDossierRow,
} from './SyncTypes';

const metadataFields = [
  'alias',
  'characterStatus',
  'affiliation',
  'region',
  'world',
  'eventDate',
  'era',
  'leader',
  'organizationType',
  'theoryConfidence',
  'theoryStatus',
] as const;

function optional(value?: string | null) {
  return value ?? null;
}

function removeEmptyValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function mapCaseToCloudRow(
  loreCase: LoreCase,
  userId: string,
  cloudImagePath?: string | null,
): CloudCaseRow {
  return {
    id: loreCase.id,
    user_id: userId,
    name: loreCase.caseName,
    universe_type: loreCase.universeType,
    cover_image_local_value: null,
    cover_image_cloud_path: cloudImagePath ?? null,
    author_or_creator: optional(loreCase.authorOrCreator),
    description: optional(loreCase.description),
    date_last_opened: loreCase.dateLastOpened,
    is_archived: false,
    created_at: loreCase.dateCreated,
    updated_at: loreCase.dateLastModified,
  };
}

export function mapDossierToCloudRow(
  dossier: Dossier,
  userId: string,
  cloudImagePath?: string | null,
): CloudDossierRow {
  const metadata = removeEmptyValues(
    metadataFields.reduce<Record<string, unknown>>((values, field) => {
      values[field] = dossier[field];
      return values;
    }, {}),
  );

  return {
    id: dossier.id,
    user_id: userId,
    case_id: dossier.caseId,
    dossier_type: dossier.dossierType,
    name: dossier.name,
    cover_image_local_value: null,
    cover_image_cloud_path: cloudImagePath ?? null,
    summary: optional(dossier.summary),
    notes: optional(dossier.notes),
    metadata,
    created_at: dossier.dateCreated,
    updated_at: dossier.dateModified,
  };
}

export function mapBondToCloudRow(bond: Bond, userId: string): CloudBondRow {
  return {
    id: bond.id,
    user_id: userId,
    case_id: bond.caseId,
    source_dossier_id: bond.sourceDossierId,
    target_dossier_id: bond.targetDossierId,
    bond_type: bond.bondType,
    bond_behavior: bond.bondBehavior,
    source_label: optional(bond.sourceLabel),
    target_label: optional(bond.targetLabel),
    status: optional(bond.status),
    notes: optional(bond.notes),
    evidence: removeEmptyValues((bond.evidence ?? {}) as Record<string, unknown>),
    created_at: bond.dateCreated,
    updated_at: bond.dateModified,
  };
}

export function mapBoardPinToCloudRow(pin: BoardPin, userId: string): CloudBoardEntryRow {
  return {
    id: pin.id,
    user_id: userId,
    case_id: pin.caseId,
    dossier_id: pin.dossierId,
    board_order: pin.order,
    position_x: pin.position.x,
    position_y: pin.position.y,
    rotation: 0,
    scale: 1,
    z_index: pin.order,
    date_pinned: pin.datePinned,
    created_at: pin.datePinned,
    updated_at: pin.datePinned,
  };
}

export function mapCloudCaseToLocal(row: CloudCaseRow): LoreCase {
  return {
    id: row.id,
    caseName: row.name,
    universeType: row.universe_type as UniverseType,
    dateCreated: row.created_at,
    dateLastModified: row.updated_at,
    dateLastOpened: row.date_last_opened,
    authorOrCreator: row.author_or_creator ?? undefined,
    description: row.description ?? undefined,
  };
}

export function mapCloudDossierToLocal(row: CloudDossierRow): Dossier {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    caseId: row.case_id,
    dossierType: row.dossier_type as DossierType,
    name: row.name,
    dateCreated: row.created_at,
    dateModified: row.updated_at,
    summary: row.summary ?? undefined,
    notes: row.notes ?? undefined,
    alias: metadata.alias as string | undefined,
    characterStatus: metadata.characterStatus as CharacterStatus | undefined,
    affiliation: metadata.affiliation as string | undefined,
    region: metadata.region as string | undefined,
    world: metadata.world as string | undefined,
    eventDate: metadata.eventDate as string | undefined,
    era: metadata.era as string | undefined,
    leader: metadata.leader as string | undefined,
    organizationType: metadata.organizationType as string | undefined,
    theoryConfidence: metadata.theoryConfidence as TheoryConfidence | undefined,
    theoryStatus: metadata.theoryStatus as TheoryStatus | undefined,
  };
}

export function mapCloudBondToLocal(row: CloudBondRow): Bond {
  return {
    id: row.id,
    caseId: row.case_id,
    sourceDossierId: row.source_dossier_id,
    targetDossierId: row.target_dossier_id,
    bondType: row.bond_type,
    bondBehavior: row.bond_behavior as Bond['bondBehavior'],
    dateCreated: row.created_at,
    dateModified: row.updated_at,
    sourceLabel: row.source_label ?? undefined,
    targetLabel: row.target_label ?? undefined,
    status: row.status as Bond['status'],
    notes: row.notes ?? undefined,
    evidence: removeEmptyValues(row.evidence ?? {}) as BondEvidence,
  };
}

export function mapCloudBoardEntryToLocal(row: CloudBoardEntryRow): BoardPin {
  return {
    id: row.id,
    caseId: row.case_id,
    dossierId: row.dossier_id,
    order: row.board_order,
    position: {
      x: row.position_x,
      y: row.position_y,
    },
    datePinned: row.date_pinned,
  };
}
