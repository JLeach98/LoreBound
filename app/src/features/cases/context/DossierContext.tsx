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
  createDossier,
  deleteDossier,
  readDossiersByCaseId,
  updateDossier,
} from '../storage/caseStorage';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import type { Dossier, DossierFormValues, DossierType } from '../types/dossierTypes';
import { dossierTypes } from '../types/dossierTypes';
import { useCases } from './CaseContext';

type DossierCounts = Record<DossierType, number>;

type DossierContextValue = {
  dossiers: Dossier[];
  dossierCounts: DossierCounts;
  isLoading: boolean;
  errorMessage: string | null;
  refreshDossiers: () => Promise<void>;
  createNewDossier: (values: DossierFormValues) => Promise<Dossier>;
  updateExistingDossier: (id: string, values: DossierFormValues) => Promise<Dossier>;
  deleteExistingDossier: (id: string) => Promise<void>;
  clearError: () => void;
};

const DossierContext = createContext<DossierContextValue | null>(null);

const emptyCounts = dossierTypes.reduce(
  (counts, type) => ({ ...counts, [type]: 0 }),
  {} as DossierCounts,
);

function sortDossiers(dossiers: Dossier[]) {
  return [...dossiers].sort(
    (left, right) =>
      new Date(right.dateModified).getTime() - new Date(left.dateModified).getTime(),
  );
}

function countDossiers(dossiers: Dossier[]) {
  return dossiers.reduce(
    (counts, dossier) => ({
      ...counts,
      [dossier.dossierType]: counts[dossier.dossierType] + 1,
    }),
    { ...emptyCounts },
  );
}

function friendlyError(error: unknown, fallback: string) {
  console.error(error);
  return fallback;
}

export function DossierProvider({ children }: { children: ReactNode }) {
  const { activeCase } = useCases();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshDossiers = useCallback(async () => {
    if (!activeCase) {
      setDossiers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const storedDossiers = await readDossiersByCaseId(activeCase.id);
      setDossiers(sortDossiers(storedDossiers));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        friendlyError(error, 'The Dossiers for this Case could not be loaded.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeCase]);

  useEffect(() => {
    void refreshDossiers();
  }, [refreshDossiers]);

  useEffect(() => {
    function handleLocalArchiveRestored() {
      void refreshDossiers();
    }

    window.addEventListener('lorebound:local-archive-restored', handleLocalArchiveRestored);

    return () => {
      window.removeEventListener('lorebound:local-archive-restored', handleLocalArchiveRestored);
    };
  }, [refreshDossiers]);

  const createNewDossier = useCallback(
    async (values: DossierFormValues) => {
      if (!activeCase) {
        throw new Error('Open a Case before creating a Dossier.');
      }

      try {
        const createdDossier = await createDossier(activeCase.id, values);
        requestAutomaticSynchronization('dossier created');
        setDossiers((currentDossiers) =>
          sortDossiers([createdDossier, ...currentDossiers]),
        );
        setErrorMessage(null);
        return createdDossier;
      } catch (error) {
        const message = friendlyError(error, 'The Dossier could not be created.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [activeCase],
  );

  const updateExistingDossier = useCallback(
    async (id: string, values: DossierFormValues) => {
      try {
        const updatedDossier = await updateDossier(id, values);
        requestAutomaticSynchronization('dossier updated');
        setDossiers((currentDossiers) =>
          sortDossiers(
            currentDossiers.map((dossier) =>
              dossier.id === updatedDossier.id ? updatedDossier : dossier,
            ),
          ),
        );
        setErrorMessage(null);
        return updatedDossier;
      } catch (error) {
        const message = friendlyError(error, 'The Dossier could not be updated.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [],
  );

  const deleteExistingDossier = useCallback(async (id: string) => {
    try {
      await deleteDossier(id);
      requestAutomaticSynchronization('dossier deleted');
      setDossiers((currentDossiers) =>
        currentDossiers.filter((dossier) => dossier.id !== id),
      );
      setErrorMessage(null);
    } catch (error) {
      const message = friendlyError(error, 'The Dossier could not be deleted.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      dossiers,
      dossierCounts: countDossiers(dossiers),
      isLoading,
      errorMessage,
      refreshDossiers,
      createNewDossier,
      updateExistingDossier,
      deleteExistingDossier,
      clearError: () => setErrorMessage(null),
    }),
    [
      createNewDossier,
      deleteExistingDossier,
      dossiers,
      errorMessage,
      isLoading,
      refreshDossiers,
      updateExistingDossier,
    ],
  );

  return (
    <DossierContext.Provider value={contextValue}>{children}</DossierContext.Provider>
  );
}

export function useDossiers() {
  const context = useContext(DossierContext);

  if (!context) {
    throw new Error('useDossiers must be used inside DossierProvider.');
  }

  return context;
}
