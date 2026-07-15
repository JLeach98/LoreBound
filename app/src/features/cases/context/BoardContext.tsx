import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  pinDossierToBoard,
  readBoardPinsByCaseId,
  removeBoardPin,
  updateBoardPinPosition,
} from '../storage/caseStorage';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import type { BoardPin, BoardPinPosition } from '../types/boardTypes';
import { useCases } from './CaseContext';

type BoardContextValue = {
  boardPins: BoardPin[];
  isLoading: boolean;
  errorMessage: string | null;
  refreshBoardPins: () => Promise<void>;
  pinDossier: (dossierId: string, position?: BoardPinPosition) => Promise<BoardPin>;
  removePin: (pinId: string) => Promise<void>;
  movePin: (pinId: string, position: BoardPinPosition) => Promise<BoardPin>;
  removeDossierFromBoard: (dossierId: string) => Promise<void>;
  isDossierPinned: (dossierId: string) => boolean;
  clearError: () => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

function friendlyError(error: unknown, fallback: string) {
  console.error(error);
  return fallback;
}

function sortPins(pins: BoardPin[]) {
  return [...pins].sort((left, right) => left.order - right.order);
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const { activeCase } = useCases();
  const [boardPins, setBoardPins] = useState<BoardPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshBoardPins = useCallback(async () => {
    if (!activeCase) {
      setBoardPins([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const storedPins = await readBoardPinsByCaseId(activeCase.id);
      setBoardPins(sortPins(storedPins));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        friendlyError(error, 'The Evidence Board could not be loaded.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeCase]);

  useEffect(() => {
    void refreshBoardPins();
  }, [refreshBoardPins]);

  const pinDossier = useCallback(
    async (dossierId: string, position?: BoardPinPosition) => {
      if (!activeCase) {
        throw new Error('Open a Case before pinning evidence to the Board.');
      }

      try {
        const pinnedDossier = await pinDossierToBoard(activeCase.id, dossierId, position);
        requestAutomaticSynchronization('evidence pinned');
        setBoardPins((currentPins) => {
          const hasPin = currentPins.some((pin) => pin.id === pinnedDossier.id);

          return hasPin
            ? sortPins(
                currentPins.map((pin) =>
                  pin.id === pinnedDossier.id ? pinnedDossier : pin,
                ),
              )
            : sortPins([...currentPins, pinnedDossier]);
        });
        setErrorMessage(null);
        return pinnedDossier;
      } catch (error) {
        const message = friendlyError(error, 'The Dossier could not be pinned.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [activeCase],
  );

  const removePin = useCallback(async (pinId: string) => {
    try {
      await removeBoardPin(pinId);
      requestAutomaticSynchronization('evidence unpinned');
      setBoardPins((currentPins) => currentPins.filter((pin) => pin.id !== pinId));
      setErrorMessage(null);
    } catch (error) {
      const message = friendlyError(error, 'The Dossier could not be removed from the Board.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const movePin = useCallback(async (pinId: string, position: BoardPinPosition) => {
    try {
      const updatedPin = await updateBoardPinPosition(pinId, position);
      requestAutomaticSynchronization('evidence moved');
      setBoardPins((currentPins) =>
        sortPins(currentPins.map((pin) => (pin.id === updatedPin.id ? updatedPin : pin))),
      );
      setErrorMessage(null);
      return updatedPin;
    } catch (error) {
      const message = friendlyError(error, 'The Board card could not be moved.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const removeDossierFromBoard = useCallback(
    async (dossierId: string) => {
      const pinsToRemove = boardPins.filter((pin) => pin.dossierId === dossierId);

      await Promise.all(pinsToRemove.map((pin) => removePin(pin.id)));
    },
    [boardPins, removePin],
  );

  const isDossierPinned = useCallback(
    (dossierId: string) => boardPins.some((pin) => pin.dossierId === dossierId),
    [boardPins],
  );

  const contextValue = useMemo(
    () => ({
      boardPins,
      isLoading,
      errorMessage,
      refreshBoardPins,
      pinDossier,
      removePin,
      movePin,
      removeDossierFromBoard,
      isDossierPinned,
      clearError: () => setErrorMessage(null),
    }),
    [
      boardPins,
      errorMessage,
      isDossierPinned,
      isLoading,
      movePin,
      pinDossier,
      refreshBoardPins,
      removeDossierFromBoard,
      removePin,
    ],
  );

  return <BoardContext.Provider value={contextValue}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const context = useContext(BoardContext);

  if (!context) {
    throw new Error('useBoard must be used inside BoardProvider.');
  }

  return context;
}
