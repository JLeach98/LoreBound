import type { StorageProvider } from './StorageProvider';

function unavailableCloudStorage(): never {
  throw new Error('LoreBound Online Archive is not configured. LoreBound is using Offline Mode.');
}

export const cloudStorageProvider: StorageProvider = {
  getStatus: () => ({
    mode: 'cloud',
    label: 'LoreBound Online Archive Unavailable',
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
  upsertEvidenceRecord: unavailableCloudStorage,
  readEvidenceRecordById: unavailableCloudStorage,
  readEvidenceRecordsByCaseId: unavailableCloudStorage,
  readEvidenceRecordsByTargetDossierId: unavailableCloudStorage,
  readEvidenceRecordsByOriginDossierId: unavailableCloudStorage,
  readEvidenceRecordsByOriginSectionId: unavailableCloudStorage,
  deleteEvidenceRecord: unavailableCloudStorage,
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
