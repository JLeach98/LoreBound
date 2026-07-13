import type { StorageProvider } from './StorageProvider';

function unavailableCloudStorage(): never {
  throw new Error('Cloud storage is not configured. LoreBound is running in Local Mode.');
}

export const cloudStorageProvider: StorageProvider = {
  getStatus: () => ({
    mode: 'cloud',
    label: 'Cloud Library Unconfigured',
    isAvailable: false,
  }),
  createCase: unavailableCloudStorage,
  readAllCases: unavailableCloudStorage,
  readCaseById: unavailableCloudStorage,
  updateCase: unavailableCloudStorage,
  deleteCase: unavailableCloudStorage,
  openCase: unavailableCloudStorage,
  readActiveCaseId: unavailableCloudStorage,
  recordActiveCase: unavailableCloudStorage,
  clearActiveCase: unavailableCloudStorage,
  createDossier: unavailableCloudStorage,
  readDossiersByCaseId: unavailableCloudStorage,
  readDossierById: unavailableCloudStorage,
  updateDossier: unavailableCloudStorage,
  deleteDossier: unavailableCloudStorage,
  deleteDossiersByCaseId: unavailableCloudStorage,
  readBoardPinsByCaseId: unavailableCloudStorage,
  pinDossierToBoard: unavailableCloudStorage,
  removeBoardPin: unavailableCloudStorage,
  updateBoardPinPosition: unavailableCloudStorage,
  deleteBoardPinsByDossierId: unavailableCloudStorage,
  deleteBoardPinsByCaseId: unavailableCloudStorage,
  createBond: unavailableCloudStorage,
  readBondsByCaseId: unavailableCloudStorage,
  readBondById: unavailableCloudStorage,
  readBondsByDossierId: unavailableCloudStorage,
  updateBond: unavailableCloudStorage,
  deleteBond: unavailableCloudStorage,
  deleteBondsByDossierId: unavailableCloudStorage,
  deleteBondsByCaseId: unavailableCloudStorage,
};
