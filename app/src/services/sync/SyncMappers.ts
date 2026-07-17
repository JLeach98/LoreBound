import type { BoardPin } from '../../features/cases/types/boardTypes';
import type {
  Bond,
  BondEvidence,
  BondOrigin,
  ThreadmarkBondMetadata,
} from '../../features/cases/types/bondTypes';
import type { LoreCase, UniverseType } from '../../features/cases/types/caseTypes';
import type {
  CharacterStatus,
  Dossier,
  DossierSection,
  DossierSectionField,
  DossierSectionKind,
  DossierType,
  TheoryConfidence,
  TheoryStatus,
} from '../../features/cases/types/dossierTypes';
import type {
  CloudBoardEntryRow,
  CloudBondRow,
  CloudCaseRow,
  CloudDeletionEntityType,
  CloudDeletionLedgerRow,
  CloudDossierRow,
} from './SyncTypes';
import type { DeletionEntityType, DeletionTombstone } from '../../features/cases/storage/caseStorage';

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

export function localDeletionEntityToCloud(entityType: DeletionEntityType): CloudDeletionEntityType {
  return entityType === 'boardEntries' ? 'board_entries' : entityType;
}

export function cloudDeletionEntityToLocal(entityType: CloudDeletionEntityType): DeletionEntityType {
  return entityType === 'board_entries' ? 'boardEntries' : entityType;
}

export function createDeletionLedgerId(entityType: DeletionEntityType, entityId: string) {
  return `deletion-ledger:${entityType}:${entityId}`;
}

function removeEmptyValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function buildBondEvidencePayload(bond: Bond) {
  return removeEmptyValues({
    ...((bond.evidence ?? {}) as Record<string, unknown>),
    origin: bond.origin,
    threadmark: bond.threadmark,
  });
}

function extractBondEvidencePayload(evidence: Record<string, unknown> | null | undefined) {
  const {
    origin,
    threadmark,
    ...evidenceValues
  } = removeEmptyValues(evidence ?? {});

  return {
    evidence: removeEmptyValues(evidenceValues) as BondEvidence,
    origin: origin as BondOrigin | undefined,
    threadmark: threadmark as ThreadmarkBondMetadata | undefined,
  };
}

const sectionKinds: DossierSectionKind[] = [
  'identity',
  'overview',
  'notes',
  'relationships',
  'timeline',
  'gallery',
  'evidence',
  'custom',
];

function normalizeSectionFieldForSync(field: unknown, index: number): DossierSectionField | null {
  if (!field || typeof field !== 'object') {
    return null;
  }

  const value = field as Partial<DossierSectionField>;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `field-${index}`;
  const label = typeof value.label === 'string' ? value.label : '';
  const fieldValue = typeof value.value === 'string' ? value.value : '';

  return {
    id,
    label,
    value: fieldValue,
  };
}

export function normalizeDossierSectionsForSync(sections: unknown): DossierSection[] | undefined {
  if (!Array.isArray(sections)) {
    return undefined;
  }

  const normalizedSections = sections
    .map((section, index) => {
      if (!section || typeof section !== 'object') {
        return null;
      }

      const value = section as Partial<DossierSection>;
      const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
      const title = typeof value.title === 'string' ? value.title : null;
      const kind = sectionKinds.includes(value.kind as DossierSectionKind)
        ? value.kind as DossierSectionKind
        : 'custom';

      if (!id || title === null) {
        return null;
      }

      const fields = Array.isArray(value.fields)
        ? value.fields
            .map((field, fieldIndex) => normalizeSectionFieldForSync(field, fieldIndex))
            .filter((field): field is DossierSectionField => Boolean(field))
        : undefined;
      const normalizedSection: DossierSection = {
        id,
        templateId:
          typeof value.templateId === 'string' && value.templateId.trim()
            ? value.templateId.trim()
            : id,
        kind,
        title,
        order: Number.isFinite(value.order) ? Number(value.order) : index,
        isCollapsed: Boolean(value.isCollapsed),
        isSingleton: Boolean(value.isSingleton),
      };

      if (typeof value.body === 'string') {
        normalizedSection.body = value.body;
      }

      if (fields) {
        normalizedSection.fields = fields;
      }

      return normalizedSection;
    })
    .filter((section): section is DossierSection => Boolean(section))
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));

  return normalizedSections.length ? normalizedSections : undefined;
}

export function buildDossierMetadataForSync(dossier: Dossier) {
  return removeEmptyValues({
    ...metadataFields.reduce<Record<string, unknown>>((values, field) => {
      values[field] = dossier[field];
      return values;
    }, {}),
    sections: normalizeDossierSectionsForSync(dossier.sections),
  });
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
  const metadata = buildDossierMetadataForSync(dossier);

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
    evidence: buildBondEvidencePayload(bond),
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
    sections: normalizeDossierSectionsForSync(metadata.sections),
  };
}

export function mapCloudBondToLocal(row: CloudBondRow): Bond {
  const bondEvidence = extractBondEvidencePayload(row.evidence);

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
    evidence: Object.keys(bondEvidence.evidence).length ? bondEvidence.evidence : undefined,
    origin: bondEvidence.origin,
    threadmark: bondEvidence.threadmark,
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

export function mapDeletionTombstoneToCloudLedgerRow(
  tombstone: DeletionTombstone,
  userId: string,
): CloudDeletionLedgerRow {
  return {
    id: createDeletionLedgerId(tombstone.entityType, tombstone.entityId),
    user_id: userId,
    case_id: tombstone.caseId,
    entity_type: localDeletionEntityToCloud(tombstone.entityType),
    entity_id: tombstone.entityId,
    deleted_at: tombstone.deletedAt,
    source_client_id: tombstone.sourceClientId,
    deletion_version: tombstone.deletionVersion,
    acknowledged_at: tombstone.verifiedAt ?? null,
    compacted_at: null,
    created_at: tombstone.deletedAt,
    updated_at: tombstone.verifiedAt ?? tombstone.deletedAt,
  };
}

export function mapCloudDeletionLedgerToLocalTombstone(row: CloudDeletionLedgerRow): DeletionTombstone {
  return {
    id: row.id,
    caseId: row.case_id,
    entityType: cloudDeletionEntityToLocal(row.entity_type),
    entityId: row.entity_id,
    deletedAt: row.deleted_at,
    sourceClientId: row.source_client_id,
    synchronizationStatus: row.acknowledged_at ? 'verified' : 'pending',
    deletionVersion: row.deletion_version === 1 ? 1 : 1,
    verifiedAt: row.acknowledged_at ?? undefined,
  };
}
