import { InvestigatorOffice } from '../components/investigator-office/InvestigatorOffice';
import { CaseProvider } from '../features/cases/context/CaseContext';

export function App() {
  return (
    <CaseProvider>
      <InvestigatorOffice />
    </CaseProvider>
  );
}
