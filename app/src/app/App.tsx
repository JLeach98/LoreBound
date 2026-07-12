import { InvestigatorOffice } from '../components/investigator-office/InvestigatorOffice';
import { CaseProvider } from '../features/cases/context/CaseContext';
import { DossierProvider } from '../features/cases/context/DossierContext';

export function App() {
  return (
    <CaseProvider>
      <DossierProvider>
        <InvestigatorOffice />
      </DossierProvider>
    </CaseProvider>
  );
}
