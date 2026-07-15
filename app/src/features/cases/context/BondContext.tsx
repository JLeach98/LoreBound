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
  createBond,
  deleteBond,
  readBondsByCaseId,
  updateBond,
} from '../storage/caseStorage';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import type { Bond, BondFormValues } from '../types/bondTypes';
import { useCases } from './CaseContext';

type BondContextValue = {
  bonds: Bond[];
  isLoading: boolean;
  errorMessage: string | null;
  refreshBonds: () => Promise<void>;
  createNewBond: (values: BondFormValues) => Promise<Bond>;
  updateExistingBond: (id: string, values: BondFormValues) => Promise<Bond>;
  deleteExistingBond: (id: string) => Promise<void>;
  bondsForDossier: (dossierId: string) => Bond[];
  clearError: () => void;
};

const BondContext = createContext<BondContextValue | null>(null);

function friendlyError(error: unknown, fallback: string) {
  console.error(error);
  return fallback;
}

function sortBonds(bonds: Bond[]) {
  return [...bonds].sort(
    (left, right) =>
      new Date(right.dateModified).getTime() - new Date(left.dateModified).getTime(),
  );
}

export function BondProvider({ children }: { children: ReactNode }) {
  const { activeCase } = useCases();
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshBonds = useCallback(async () => {
    if (!activeCase) {
      setBonds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const storedBonds = await readBondsByCaseId(activeCase.id);
      setBonds(sortBonds(storedBonds));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(friendlyError(error, 'The Bonds for this Case could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeCase]);

  useEffect(() => {
    void refreshBonds();
  }, [refreshBonds]);

  const createNewBond = useCallback(
    async (values: BondFormValues) => {
      if (!activeCase) {
        throw new Error('Open a Case before creating a Bond.');
      }

      try {
        const createdBond = await createBond(activeCase.id, values);
        requestAutomaticSynchronization('bond created');
        setBonds((currentBonds) => sortBonds([createdBond, ...currentBonds]));
        setErrorMessage(null);
        return createdBond;
      } catch (error) {
        const message = friendlyError(error, 'The Bond could not be created.');
        setErrorMessage(message);
        throw new Error(message);
      }
    },
    [activeCase],
  );

  const updateExistingBond = useCallback(async (id: string, values: BondFormValues) => {
    try {
      const updatedBond = await updateBond(id, values);
      requestAutomaticSynchronization('bond updated');
      setBonds((currentBonds) =>
        sortBonds(currentBonds.map((bond) => (bond.id === id ? updatedBond : bond))),
      );
      setErrorMessage(null);
      return updatedBond;
    } catch (error) {
      const message = friendlyError(error, 'The Bond could not be updated.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const deleteExistingBond = useCallback(async (id: string) => {
    try {
      await deleteBond(id);
      requestAutomaticSynchronization('bond deleted');
      setBonds((currentBonds) => currentBonds.filter((bond) => bond.id !== id));
      setErrorMessage(null);
    } catch (error) {
      const message = friendlyError(error, 'The Bond could not be deleted.');
      setErrorMessage(message);
      throw new Error(message);
    }
  }, []);

  const bondsForDossier = useCallback(
    (dossierId: string) =>
      bonds.filter(
        (bond) => bond.sourceDossierId === dossierId || bond.targetDossierId === dossierId,
      ),
    [bonds],
  );

  const contextValue = useMemo(
    () => ({
      bonds,
      isLoading,
      errorMessage,
      refreshBonds,
      createNewBond,
      updateExistingBond,
      deleteExistingBond,
      bondsForDossier,
      clearError: () => setErrorMessage(null),
    }),
    [
      bonds,
      bondsForDossier,
      createNewBond,
      deleteExistingBond,
      errorMessage,
      isLoading,
      refreshBonds,
      updateExistingBond,
    ],
  );

  return <BondContext.Provider value={contextValue}>{children}</BondContext.Provider>;
}

export function useBonds() {
  const context = useContext(BondContext);

  if (!context) {
    throw new Error('useBonds must be used inside BondProvider.');
  }

  return context;
}
