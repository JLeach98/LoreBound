import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { useCases } from '../context/CaseContext';
import type { CaseFormValues, LoreCase } from '../types/caseTypes';
import { CaseFormDialog } from './CaseFormDialog';

type CaseSettingsViewProps = {
  activeCase: LoreCase;
  onReturnToBoard: () => void;
  onOpenCaseArchive: () => void;
};

export function CaseSettingsView({
  activeCase,
  onReturnToBoard,
  onOpenCaseArchive,
}: CaseSettingsViewProps) {
  const { updateExistingCase } = useCases();
  const [isEditing, setIsEditing] = useState(false);

  async function handleSubmit(values: CaseFormValues) {
    await updateExistingCase(activeCase.id, values);
    setIsEditing(false);
  }

  return (
    <>
      <section className="investigation-section" aria-labelledby="case-settings-heading">
        <p className="investigation-section__eyebrow">Active Investigation</p>
        <h2 id="case-settings-heading">Case Settings</h2>
        <dl className="case-settings-list">
          <div>
            <dt>Case Name</dt>
            <dd>{activeCase.caseName}</dd>
          </div>
          <div>
            <dt>Universe Type</dt>
            <dd>{activeCase.universeType}</dd>
          </div>
          {activeCase.authorOrCreator ? (
            <div>
              <dt>Author or Creator</dt>
              <dd>{activeCase.authorOrCreator}</dd>
            </div>
          ) : null}
          {activeCase.description ? (
            <div>
              <dt>Description</dt>
              <dd>{activeCase.description}</dd>
            </div>
          ) : null}
        </dl>
        <div className="investigation-section__actions">
          <Button type="button" variant="brass" onClick={() => setIsEditing(true)}>
            Edit Case
          </Button>
          <Button type="button" variant="ghost" onClick={onReturnToBoard}>
            Return to Board
          </Button>
          <Button type="button" variant="plaque" onClick={onOpenCaseArchive}>
            Case Archive
          </Button>
        </div>
      </section>

      {isEditing ? (
        <CaseFormDialog
          mode="edit"
          initialCase={activeCase}
          onCancel={() => setIsEditing(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}
