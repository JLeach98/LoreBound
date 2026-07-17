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
  clearActiveCase,
  createCase,
  deleteBondsByCaseId,
  deleteBoardPinsByCaseId,
  deleteCase,
  deleteDossiersByCaseId,
  openCase,
  readActiveCaseId,
  readAllCases,
  readCaseById,
  updateCase,
} from '../storage/caseStorage';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import { syncService } from '../../../services/sync/SyncService';
import type { CaseFormValues, LoreCase } from '../types/caseTypes';
import { sortCasesByRecentActivity } from '../utils/caseSorting';

type CaseContextValue = {
  cases: LoreCase[];
  cloudCases: LoreCase[];
  activeCase: LoreCase | null;
  isLoading: boolean;
  errorMessage: string | null;
  refreshCases: () => Promise<void>;
  createNewCase: (values: CaseFormValues) => Promise<LoreCase>;
  updateExistingCase: (id: string, values: CaseFormValues) => Promise<LoreCase>;
  deleteExistingCase: (id: string) => Promise<void>;
  openExistingCase: (id: string) => Promise<LoreCase>;
  retrieveCloudCase: (id: string) => Promise<LoreCase>;
  clearCurrentCase: () => Promise<void>;
  clearError: () => void;
};

const CaseContext = createContext<CaseContextValue | null>(null);

function friendlyError(error: unknown, fallback: string) {
  console.error(error);
  return fallback;
}

export function CaseProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<LoreCase[]>([]);
  const [cloudCases, setCloudCases] = useState<LoreCase[]>([]);
  const [activeCase, setActiveCase] = useState<LoreCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshCases = useCallback(async () => {
    try {
      const [storedCases, activeCaseId, discoveredCloudCases] = await Promise.all([
        readAllCases(),
        readActiveCaseId(),
        syncService.discoverCloudCases().catch((error) => {
          console.warn('LoreBound Online Case discovery could not be reviewed.', error);
          return [] as LoreCase[];
        }),
      ]);
      const sortedCases = sortCasesByRecentActivity(storedCases);
      const storedActiveCase = activeCaseId
        ? (sortedCases.find((loreCase) => loreCase.id === activeCaseId) ??
          (await readCaseById(activeCaseId)) ??
          null)
        : null;

      if (activeCaseId && !storedActiveCase) {
        await clearActiveCase();
        console.warn('Cleared an invalid active Case reference.');
      }

      setCases(sortedCases);
      setCloudCases(discoveredCloudCases);
      setActiveCase(storedActiveCase);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        friendlyError(error, 'The Case Archive could not be loaded from this browser.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCases();
  }, [refreshCases]);

  useEffect(() => {
    function handleLocalArchiveRestored() {
      void refreshCases();
    }

    window.addEventListener('lorebound:local-archive-restored', handleLocalArchiveRestored);

    return () => {
      window.removeEventListener('lorebound:local-archive-restored', handleLocalArchiveRestored);
    };
  }, [refreshCases]);

  const createNewCase = useCallback(async (values: CaseFormValues) => {
    try {
      const createdCase = await createCase(values);
      requestAutomaticSynchronization('case created');
      setCases((currentCases) =>
        sortCasesByRecentActivity([createdCase, ...currentCases]),
      );
      setErrorMessage(null);
      return createdCase;
    } catch (error) {
      const message = friendlyError(error, 'The Case could not be created.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const updateExistingCase = useCallback(
    async (id: string, values: CaseFormValues) => {
      try {
        const updatedCase = await updateCase(id, values);
        requestAutomaticSynchronization('case updated');
        setCases((currentCases) =>
          sortCasesByRecentActivity(
            currentCases.map((loreCase) =>
              loreCase.id === updatedCase.id ? updatedCase : loreCase,
            ),
          ),
        );
        setActiveCase((currentCase) =>
          currentCase?.id === updatedCase.id ? updatedCase : currentCase,
        );
        setErrorMessage(null);
        return updatedCase;
      } catch (error) {
        const message = friendlyError(error, 'The Case could not be updated.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [],
  );

  const openExistingCase = useCallback(async (id: string) => {
    try {
      const openedCase = await openCase(id);
      setActiveCase(openedCase);
      setCases((currentCases) =>
        sortCasesByRecentActivity(
          currentCases.map((loreCase) =>
            loreCase.id === openedCase.id ? openedCase : loreCase,
          ),
        ),
      );
      setErrorMessage(null);
      return openedCase;
    } catch (error) {
      const message = friendlyError(error, 'The Case could not be opened.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const retrieveCloudCase = useCallback(async (id: string) => {
    try {
      const result = await syncService.retrieveCase(id);

      if (!result.ok) {
        throw new Error(result.message);
      }

      const openedCase = await openCase(id);
      const storedCases = await readAllCases();
      const sortedCases = sortCasesByRecentActivity(storedCases);
      const storedCase = sortedCases.find((loreCase) => loreCase.id === id) ?? openedCase;

      setCases(sortedCases);
      setCloudCases((currentCases) => currentCases.filter((loreCase) => loreCase.id !== id));
      setActiveCase(storedCase);
      setErrorMessage(null);
      return storedCase;
    } catch (error) {
      const message = friendlyError(error, 'The Investigation could not be retrieved from LoreBound Online.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const clearCurrentCase = useCallback(async () => {
    try {
      await clearActiveCase();
      setActiveCase(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(friendlyError(error, 'The active Case could not be cleared.'));
    }
  }, []);

  const deleteExistingCase = useCallback(
    async (id: string) => {
      try {
        await deleteDossiersByCaseId(id);
        await deleteBondsByCaseId(id);
        await deleteBoardPinsByCaseId(id);
        await deleteCase(id);
        requestAutomaticSynchronization('case deleted');
        setCases((currentCases) => currentCases.filter((loreCase) => loreCase.id !== id));

        if (activeCase?.id === id) {
          await clearActiveCase();
          setActiveCase(null);
        }

        setErrorMessage(null);
      } catch (error) {
        const message = friendlyError(error, 'The Case could not be deleted.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [activeCase?.id],
  );

  const contextValue = useMemo(
    () => ({
      cases,
      cloudCases,
      activeCase,
      isLoading,
      errorMessage,
      refreshCases,
      createNewCase,
      updateExistingCase,
      deleteExistingCase,
      openExistingCase,
      retrieveCloudCase,
      clearCurrentCase,
      clearError: () => setErrorMessage(null),
    }),
    [
      activeCase,
      cases,
      cloudCases,
      clearCurrentCase,
      createNewCase,
      deleteExistingCase,
      errorMessage,
      isLoading,
      openExistingCase,
      retrieveCloudCase,
      refreshCases,
      updateExistingCase,
    ],
  );

  return <CaseContext.Provider value={contextValue}>{children}</CaseContext.Provider>;
}

export function useCases() {
  const context = useContext(CaseContext);

  if (!context) {
    throw new Error('useCases must be used inside CaseProvider.');
  }

  return context;
}
