import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const operationsConsolePreferenceKey = 'operationsConsoleUnlocked';

type OperationsConsoleContextValue = {
  operationsConsoleUnlocked: boolean;
  setOperationsConsoleUnlocked: (unlocked: boolean) => void;
};

const OperationsConsoleContext = createContext<OperationsConsoleContextValue | null>(null);

function readOperationsConsolePreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(operationsConsolePreferenceKey) === 'true';
}

function writeOperationsConsolePreference(unlocked: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(operationsConsolePreferenceKey, unlocked ? 'true' : 'false');
}

export function OperationsConsoleProvider({ children }: { children: ReactNode }) {
  const [operationsConsoleUnlocked, setOperationsConsoleUnlockedState] = useState(
    readOperationsConsolePreference,
  );

  useEffect(() => {
    writeOperationsConsolePreference(operationsConsoleUnlocked);
  }, [operationsConsoleUnlocked]);

  const contextValue = useMemo(
    () => ({
      operationsConsoleUnlocked,
      setOperationsConsoleUnlocked: setOperationsConsoleUnlockedState,
    }),
    [operationsConsoleUnlocked],
  );

  return (
    <OperationsConsoleContext.Provider value={contextValue}>
      {children}
    </OperationsConsoleContext.Provider>
  );
}

export function useOperationsConsole() {
  const context = useContext(OperationsConsoleContext);

  if (!context) {
    throw new Error('useOperationsConsole must be used inside OperationsConsoleProvider.');
  }

  return context;
}
