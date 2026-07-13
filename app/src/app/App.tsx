import { InvestigatorOffice } from '../components/investigator-office/InvestigatorOffice';
import { BoardProvider } from '../features/cases/context/BoardContext';
import { CaseProvider } from '../features/cases/context/CaseContext';
import { DossierProvider } from '../features/cases/context/DossierContext';

export function App() {
  return (
    <CaseProvider>
      <DossierProvider>
        <BoardProvider>
          <InvestigatorOffice />
        </BoardProvider>
      </DossierProvider>
    </CaseProvider>
  );
}
