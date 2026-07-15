import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { CaseFormDialog } from '../../cases/components/CaseFormDialog';
import { useCases } from '../../cases/context/CaseContext';
import type { CaseFormValues, LoreCase } from '../../cases/types/caseTypes';
import { formatShortDate, getCaseSecondaryLine } from '../utils/fieldKitFormat';
import { FieldKitThumbnail } from './FieldKitThumbnail';

type FieldKitInvestigationsProps = {
  onClose: () => void;
  onOpened: () => void;
};

export function FieldKitInvestigations({ onClose, onOpened }: FieldKitInvestigationsProps) {
  const {
    cases,
    activeCase,
    createNewCase,
    updateExistingCase,
    deleteExistingCase,
    openExistingCase,
  } = useCases();
  const [editingCase, setEditingCase] = useState<LoreCase | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCase, setDeletingCase] = useState<LoreCase | null>(null);

  async function handleCreate(values: CaseFormValues) {
    const createdCase = await createNewCase(values);
    await openExistingCase(createdCase.id);
    setIsCreating(false);
    onOpened();
  }

  async function handleUpdate(values: CaseFormValues) {
    if (!editingCase) {
      return;
    }

    await updateExistingCase(editingCase.id, values);
    setEditingCase(null);
  }

  async function handleDelete() {
    if (!deletingCase) {
      return;
    }

    await deleteExistingCase(deletingCase.id);
    setDeletingCase(null);
  }

  return (
    <section className="field-kit-panel field-kit-drawer-panel" aria-labelledby="field-kit-investigations-title">
      <header className="field-kit-panel__header">
        <button type="button" onClick={onClose} aria-label="Back to Field Kit">
          Back
        </button>
        <div>
          <span>Archive Drawer</span>
          <h2 id="field-kit-investigations-title">Investigations</h2>
        </div>
        <Button type="button" variant="brass" onClick={() => setIsCreating(true)}>
          Create
        </Button>
      </header>

      <div className="field-kit-list">
        {cases.map((loreCase) => (
          <article key={loreCase.id} className="field-kit-record">
            <FieldKitThumbnail image={loreCase.coverImage} name={loreCase.caseName} />
            <div>
              <h3>{loreCase.caseName}</h3>
              <p>{getCaseSecondaryLine(loreCase) || 'Investigation'}</p>
              <small>
                {activeCase?.id === loreCase.id ? 'Open now' : `Last opened ${formatShortDate(loreCase.dateLastOpened)}`}
              </small>
            </div>
            <div className="field-kit-record__actions">
              <Button
                type="button"
                variant="brass"
                onClick={async () => {
                  await openExistingCase(loreCase.id);
                  onOpened();
                }}
              >
                Open
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingCase(loreCase)}>
                Edit
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDeletingCase(loreCase)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
        {cases.length === 0 ? (
          <div className="field-kit-empty">
            <h3>Archive Empty</h3>
            <p>Create an Investigation to begin collecting evidence.</p>
          </div>
        ) : null}
      </div>

      <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent('lorebound:open-library-access', { detail: { view: 'review' } }))}>
        Archive Synchronization Review
      </Button>

      {isCreating ? (
        <CaseFormDialog mode="create" onCancel={() => setIsCreating(false)} onSubmit={handleCreate} />
      ) : null}

      {editingCase ? (
        <CaseFormDialog
          mode="edit"
          initialCase={editingCase}
          onCancel={() => setEditingCase(null)}
          onSubmit={handleUpdate}
        />
      ) : null}

      {deletingCase ? (
        <div className="case-settings-confirm-backdrop" role="presentation">
          <section className="case-settings-confirm" role="dialog" aria-modal="true">
            <h3>Delete Investigation?</h3>
            <p>{deletingCase.caseName} will be removed from this Local Archive.</p>
            <div className="auth-dialog__actions">
              <Button type="button" variant="ghost" onClick={() => setDeletingCase(null)}>
                Cancel
              </Button>
              <Button type="button" variant="brass" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
