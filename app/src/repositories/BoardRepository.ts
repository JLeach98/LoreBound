import type { BoardPin, BoardPinPosition } from '../features/cases/types/boardTypes';
import { getActiveStorageProvider } from '../services/storage/storageProviderRegistry';

export interface BoardRepository {
  readPinsByCaseId: (caseId: string) => Promise<BoardPin[]>;
  pinDossier: (
    caseId: string,
    dossierId: string,
    position?: BoardPinPosition,
  ) => Promise<BoardPin>;
  removePin: (id: string) => Promise<void>;
  movePin: (id: string, position: BoardPinPosition) => Promise<BoardPin>;
  deletePinsByDossierId: (dossierId: string) => Promise<void>;
  deletePinsByCaseId: (caseId: string) => Promise<void>;
}

class LocalFirstBoardRepository implements BoardRepository {
  private get storageProvider() {
    return getActiveStorageProvider();
  }

  readPinsByCaseId(caseId: string) {
    return this.storageProvider.readBoardPinsByCaseId(caseId);
  }

  pinDossier(caseId: string, dossierId: string, position?: BoardPinPosition) {
    return this.storageProvider.pinDossierToBoard(caseId, dossierId, position);
  }

  removePin(id: string) {
    return this.storageProvider.removeBoardPin(id);
  }

  movePin(id: string, position: BoardPinPosition) {
    return this.storageProvider.updateBoardPinPosition(id, position);
  }

  deletePinsByDossierId(dossierId: string) {
    return this.storageProvider.deleteBoardPinsByDossierId(dossierId);
  }

  deletePinsByCaseId(caseId: string) {
    return this.storageProvider.deleteBoardPinsByCaseId(caseId);
  }
}

export const boardRepository: BoardRepository = new LocalFirstBoardRepository();
