import type { CaseFormValues, LoreCase } from '../features/cases/types/caseTypes';
import { getActiveStorageProvider } from '../services/storage/storageProviderRegistry';

export interface CaseRepository {
  create: (values: CaseFormValues) => Promise<LoreCase>;
  readAll: () => Promise<LoreCase[]>;
  readById: (id: string) => Promise<LoreCase | undefined>;
  update: (id: string, values: CaseFormValues) => Promise<LoreCase>;
  delete: (id: string) => Promise<void>;
  open: (id: string) => Promise<LoreCase>;
  readActiveId: () => Promise<string | null>;
  recordActive: (id: string) => Promise<void>;
  clearActive: () => Promise<void>;
}

class LocalFirstCaseRepository implements CaseRepository {
  private get storageProvider() {
    return getActiveStorageProvider();
  }

  create(values: CaseFormValues) {
    return this.storageProvider.createCase(values);
  }

  readAll() {
    return this.storageProvider.readAllCases();
  }

  readById(id: string) {
    return this.storageProvider.readCaseById(id);
  }

  update(id: string, values: CaseFormValues) {
    return this.storageProvider.updateCase(id, values);
  }

  delete(id: string) {
    return this.storageProvider.deleteCase(id);
  }

  open(id: string) {
    return this.storageProvider.openCase(id);
  }

  readActiveId() {
    return this.storageProvider.readActiveCaseId();
  }

  recordActive(id: string) {
    return this.storageProvider.recordActiveCase(id);
  }

  clearActive() {
    return this.storageProvider.clearActiveCase();
  }
}

export const caseRepository: CaseRepository = new LocalFirstCaseRepository();
