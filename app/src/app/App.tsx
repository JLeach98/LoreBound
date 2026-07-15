import { lazy, Suspense } from 'react';
import { BondProvider } from '../features/cases/context/BondContext';
import { BoardProvider } from '../features/cases/context/BoardContext';
import { CaseProvider } from '../features/cases/context/CaseContext';
import { DossierProvider } from '../features/cases/context/DossierContext';
import { FieldKitShell } from '../features/field-kit/components/FieldKitShell';
import { OperationsConsoleProvider } from '../services/preferences/OperationsConsoleContext';
import { useDeviceExperience } from './useDeviceExperience';

const InvestigatorOffice = lazy(() =>
  import('../components/investigator-office/InvestigatorOffice').then((module) => ({
    default: module.InvestigatorOffice,
  })),
);

function LoreBoundExperience() {
  const experience = useDeviceExperience();

  if (experience === 'field-kit') {
    return <FieldKitShell />;
  }

  return (
    <Suspense
      fallback={
        <main className="study-loading" aria-live="polite">
          <span>LoreBound</span>
          <strong>Opening the Investigator's Study...</strong>
        </main>
      }
    >
      <InvestigatorOffice />
    </Suspense>
  );
}

export function App() {
  return (
    <OperationsConsoleProvider>
      <CaseProvider>
        <DossierProvider>
          <BoardProvider>
            <BondProvider>
              <LoreBoundExperience />
            </BondProvider>
          </BoardProvider>
        </DossierProvider>
      </CaseProvider>
    </OperationsConsoleProvider>
  );
}
