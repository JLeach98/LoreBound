import * as caseStorage from '../../features/cases/storage/caseStorage';
import type { StorageProvider } from './StorageProvider';

export const indexedDbStorageProvider: StorageProvider = {
  getStatus: () => ({
    mode: 'local',
    label: 'Local Archive',
    isAvailable: true,
  }),
  createCase: caseStorage.createCase,
  readAllCases: caseStorage.readAllCases,
  readCaseById: caseStorage.readCaseById,
  updateCase: caseStorage.updateCase,
  deleteCase: async (id) => {
    await caseStorage.deleteCase(id);
  },
  openCase: caseStorage.openCase,
  readActiveCaseId: caseStorage.readActiveCaseId,
  recordActiveCase: caseStorage.recordActiveCase,
  clearActiveCase: async () => {
    await caseStorage.clearActiveCase();
  },
  createDossier: caseStorage.createDossier,
  readDossiersByCaseId: caseStorage.readDossiersByCaseId,
  readDossierById: caseStorage.readDossierById,
  updateDossier: caseStorage.updateDossier,
  deleteDossier: caseStorage.deleteDossier,
  deleteDossiersByCaseId: caseStorage.deleteDossiersByCaseId,
  readBoardPinsByCaseId: caseStorage.readBoardPinsByCaseId,
  pinDossierToBoard: caseStorage.pinDossierToBoard,
  removeBoardPin: async (id) => {
    await caseStorage.removeBoardPin(id);
  },
  updateBoardPinPosition: caseStorage.updateBoardPinPosition,
  deleteBoardPinsByDossierId: caseStorage.deleteBoardPinsByDossierId,
  deleteBoardPinsByCaseId: caseStorage.deleteBoardPinsByCaseId,
  createBond: caseStorage.createBond,
  readBondsByCaseId: caseStorage.readBondsByCaseId,
  readBondById: caseStorage.readBondById,
  readBondsByDossierId: caseStorage.readBondsByDossierId,
  updateBond: caseStorage.updateBond,
  deleteBond: async (id) => {
    await caseStorage.deleteBond(id);
  },
  deleteBondsByDossierId: caseStorage.deleteBondsByDossierId,
  deleteBondsByCaseId: caseStorage.deleteBondsByCaseId,
};
