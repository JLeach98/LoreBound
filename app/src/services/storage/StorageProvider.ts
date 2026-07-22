import type { BoardPin, BoardPinPosition } from '../../features/cases/types/boardTypes';
import type { Bond, BondFormValues } from '../../features/cases/types/bondTypes';
import type { CaseFormValues, LoreCase } from '../../features/cases/types/caseTypes';
import type { Dossier, DossierFormValues } from '../../features/cases/types/dossierTypes';
import type { EvidenceRecord } from '../../features/threadmarks/evidenceRecordTypes';

export type StorageProviderStatus = {
  mode: 'local' | 'cloud';
  label: string;
  isAvailable: boolean;
};

export interface StorageProvider {
  getStatus: () => StorageProviderStatus;
  createCase: (values: CaseFormValues) => Promise<LoreCase>;
  readAllCases: () => Promise<LoreCase[]>;
  readCaseById: (id: string) => Promise<LoreCase | undefined>;
  updateCase: (id: string, values: CaseFormValues) => Promise<LoreCase>;
  deleteCase: (id: string) => Promise<void>;
  openCase: (id: string) => Promise<LoreCase>;
  readActiveCaseId: () => Promise<string | null>;
  recordActiveCase: (id: string) => Promise<void>;
  clearActiveCase: () => Promise<void>;
  createDossier: (caseId: string, values: DossierFormValues) => Promise<Dossier>;
  readDossiersByCaseId: (caseId: string) => Promise<Dossier[]>;
  readDossierById: (id: string) => Promise<Dossier | undefined>;
  updateDossier: (id: string, values: DossierFormValues) => Promise<Dossier>;
  deleteDossier: (id: string) => Promise<void>;
  deleteDossiersByCaseId: (caseId: string) => Promise<void>;
  upsertEvidenceRecord: (record: EvidenceRecord) => Promise<EvidenceRecord>;
  readEvidenceRecordById: (id: string) => Promise<EvidenceRecord | undefined>;
  readEvidenceRecordsByCaseId: (caseId: string) => Promise<EvidenceRecord[]>;
  readEvidenceRecordsByTargetDossierId: (targetDossierId: string) => Promise<EvidenceRecord[]>;
  readEvidenceRecordsByOriginDossierId: (originDossierId: string) => Promise<EvidenceRecord[]>;
  readEvidenceRecordsByOriginSectionId: (originSectionId: string) => Promise<EvidenceRecord[]>;
  deleteEvidenceRecord: (id: string) => Promise<void>;
  readBoardPinsByCaseId: (caseId: string) => Promise<BoardPin[]>;
  pinDossierToBoard: (
    caseId: string,
    dossierId: string,
    position?: BoardPinPosition,
  ) => Promise<BoardPin>;
  removeBoardPin: (id: string) => Promise<void>;
  updateBoardPinPosition: (id: string, position: BoardPinPosition) => Promise<BoardPin>;
  deleteBoardPinsByDossierId: (dossierId: string) => Promise<void>;
  deleteBoardPinsByCaseId: (caseId: string) => Promise<void>;
  createBond: (caseId: string, values: BondFormValues) => Promise<Bond>;
  readBondsByCaseId: (caseId: string) => Promise<Bond[]>;
  readBondById: (id: string) => Promise<Bond | undefined>;
  readBondsByDossierId: (dossierId: string) => Promise<Bond[]>;
  updateBond: (id: string, values: BondFormValues) => Promise<Bond>;
  deleteBond: (id: string) => Promise<void>;
  deleteBondsByDossierId: (dossierId: string) => Promise<void>;
  deleteBondsByCaseId: (caseId: string) => Promise<void>;
}
