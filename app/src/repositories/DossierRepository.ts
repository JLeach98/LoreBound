import type { Dossier, DossierFormValues } from '../features/cases/types/dossierTypes';
import { getActiveStorageProvider } from '../services/storage/storageProviderRegistry';

export interface DossierRepository {
  create: (caseId: string, values: DossierFormValues) => Promise<Dossier>;
  readByCaseId: (caseId: string) => Promise<Dossier[]>;
  readById: (id: string) => Promise<Dossier | undefined>;
  update: (id: string, values: DossierFormValues) => Promise<Dossier>;
  delete: (id: string) => Promise<void>;
  deleteByCaseId: (caseId: string) => Promise<void>;
}

class LocalFirstDossierRepository implements DossierRepository {
  private get storageProvider() {
    return getActiveStorageProvider();
  }

  create(caseId: string, values: DossierFormValues) {
    return this.storageProvider.createDossier(caseId, values);
  }

  readByCaseId(caseId: string) {
    return this.storageProvider.readDossiersByCaseId(caseId);
  }

  readById(id: string) {
    return this.storageProvider.readDossierById(id);
  }

  update(id: string, values: DossierFormValues) {
    return this.storageProvider.updateDossier(id, values);
  }

  delete(id: string) {
    return this.storageProvider.deleteDossier(id);
  }

  deleteByCaseId(caseId: string) {
    return this.storageProvider.deleteDossiersByCaseId(caseId);
  }
}

export const dossierRepository: DossierRepository = new LocalFirstDossierRepository();
