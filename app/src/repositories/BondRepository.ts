import type { Bond, BondFormValues } from '../features/cases/types/bondTypes';
import { getActiveStorageProvider } from '../services/storage/storageProviderRegistry';

export interface BondRepository {
  create: (caseId: string, values: BondFormValues) => Promise<Bond>;
  readByCaseId: (caseId: string) => Promise<Bond[]>;
  readById: (id: string) => Promise<Bond | undefined>;
  readByDossierId: (dossierId: string) => Promise<Bond[]>;
  update: (id: string, values: BondFormValues) => Promise<Bond>;
  delete: (id: string) => Promise<void>;
  deleteByDossierId: (dossierId: string) => Promise<void>;
  deleteByCaseId: (caseId: string) => Promise<void>;
}

class LocalFirstBondRepository implements BondRepository {
  private get storageProvider() {
    return getActiveStorageProvider();
  }

  create(caseId: string, values: BondFormValues) {
    return this.storageProvider.createBond(caseId, values);
  }

  readByCaseId(caseId: string) {
    return this.storageProvider.readBondsByCaseId(caseId);
  }

  readById(id: string) {
    return this.storageProvider.readBondById(id);
  }

  readByDossierId(dossierId: string) {
    return this.storageProvider.readBondsByDossierId(dossierId);
  }

  update(id: string, values: BondFormValues) {
    return this.storageProvider.updateBond(id, values);
  }

  delete(id: string) {
    return this.storageProvider.deleteBond(id);
  }

  deleteByDossierId(dossierId: string) {
    return this.storageProvider.deleteBondsByDossierId(dossierId);
  }

  deleteByCaseId(caseId: string) {
    return this.storageProvider.deleteBondsByCaseId(caseId);
  }
}

export const bondRepository: BondRepository = new LocalFirstBondRepository();
