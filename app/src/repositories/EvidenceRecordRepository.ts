import type { EvidenceRecord } from '../features/threadmarks/evidenceRecordTypes';
import { getActiveStorageProvider } from '../services/storage/storageProviderRegistry';

export interface EvidenceRecordRepository {
  create: (record: EvidenceRecord) => Promise<EvidenceRecord>;
  readById: (id: string) => Promise<EvidenceRecord | undefined>;
  update: (record: EvidenceRecord) => Promise<EvidenceRecord>;
  delete: (id: string) => Promise<void>;
  listByCase: (caseId: string) => Promise<EvidenceRecord[]>;
  listByTargetDossier: (targetDossierId: string) => Promise<EvidenceRecord[]>;
  listByOriginDossier: (originDossierId: string) => Promise<EvidenceRecord[]>;
  listByOriginSection: (originSectionId: string) => Promise<EvidenceRecord[]>;
}

class LocalFirstEvidenceRecordRepository implements EvidenceRecordRepository {
  private get storageProvider() {
    return getActiveStorageProvider();
  }

  create(record: EvidenceRecord) {
    return this.storageProvider.upsertEvidenceRecord(record);
  }

  readById(id: string) {
    return this.storageProvider.readEvidenceRecordById(id);
  }

  update(record: EvidenceRecord) {
    return this.storageProvider.upsertEvidenceRecord(record);
  }

  delete(id: string) {
    return this.storageProvider.deleteEvidenceRecord(id);
  }

  listByCase(caseId: string) {
    return this.storageProvider.readEvidenceRecordsByCaseId(caseId);
  }

  listByTargetDossier(targetDossierId: string) {
    return this.storageProvider.readEvidenceRecordsByTargetDossierId(targetDossierId);
  }

  listByOriginDossier(originDossierId: string) {
    return this.storageProvider.readEvidenceRecordsByOriginDossierId(originDossierId);
  }

  listByOriginSection(originSectionId: string) {
    return this.storageProvider.readEvidenceRecordsByOriginSectionId(originSectionId);
  }
}

export const evidenceRecordRepository: EvidenceRecordRepository = new LocalFirstEvidenceRecordRepository();
