import { useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { useCases } from '../context/CaseContext';
import type { CaseFormValues, LoreCase } from '../types/caseTypes';
import { filterCasesByName } from '../utils/caseSorting';
import { CaseFile } from './CaseFile';
import { CaseFormDialog } from './CaseFormDialog';
import { DeleteCaseDialog } from './DeleteCaseDialog';

type CaseArchiveViewProps = {
  onClose: () => void;
  onCaseOpened?: () => void;
  closeLabel?: string;
  openCreatedCase?: boolean;
};

export function CaseArchiveView({
  onClose,
  onCaseOpened,
  closeLabel = 'Return to Study',
  openCreatedCase = false,
}: CaseArchiveViewProps) {
  const {
    cases,
    cloudCases,
    isLoading,
    errorMessage,
    createNewCase,
    updateExistingCase,
    deleteExistingCase,
    openExistingCase,
    retrieveCloudCase,
    clearError,
  } = useCases();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [caseBeingEdited, setCaseBeingEdited] = useState<LoreCase | null>(null);
  const [caseBeingDeleted, setCaseBeingDeleted] = useState<LoreCase | null>(null);
  const [archiveActionError, setArchiveActionError] = useState<string | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const filteredCases = useMemo(
    () => filterCasesByName(cases, searchQuery),
    [cases, searchQuery],
  );
  const filteredCloudCases = useMemo(
    () => filterCasesByName(cloudCases, searchQuery),
    [cloudCases, searchQuery],
  );

  function openCreateDialog() {
    setArchiveActionError(null);
    setIsCreateDialogOpen(true);
  }

  async function handleCreateCase(values: CaseFormValues) {
    const createdCase = await createNewCase(values);
    setIsCreateDialogOpen(false);

    if (openCreatedCase) {
      await handleOpenCase(createdCase.id);
      return;
    }

    createButtonRef.current?.focus();
  }

  async function handleUpdateCase(values: CaseFormValues) {
    if (!caseBeingEdited) {
      return;
    }

    await updateExistingCase(caseBeingEdited.id, values);
    setCaseBeingEdited(null);
  }

  async function handleOpenCase(id: string) {
    try {
      await openExistingCase(id);
      onCaseOpened?.();
      onClose();
    } catch (error) {
      console.error(error);
      setArchiveActionError('The Case could not be opened. Try again.');
    }
  }

  async function handleRetrieveCase(id: string) {
    try {
      await retrieveCloudCase(id);
      onCaseOpened?.();
      onClose();
    } catch (error) {
      console.error(error);
      setArchiveActionError('The Investigation could not be retrieved. Try again.');
    }
  }

  async function handleDeleteCase() {
    if (!caseBeingDeleted) {
      return;
    }

    await deleteExistingCase(caseBeingDeleted.id);
    setCaseBeingDeleted(null);
  }

  return (
    <section className="case-archive" aria-labelledby="case-archive-heading">
      <div className="case-archive__panel">
        <header className="case-archive__header">
          <div>
            <p className="case-archive__brand">LoreBound</p>
            <h1 id="case-archive-heading">Case Archive</h1>
            <p>Your investigations, preserved in one place.</p>
          </div>
          <div className="case-archive__header-actions">
            <Button
              ref={createButtonRef}
              type="button"
              variant="brass"
              onClick={openCreateDialog}
            >
              Create New Case
            </Button>
            <Button type="button" variant="plaque" onClick={onClose}>
              {closeLabel}
            </Button>
          </div>
        </header>

        <div className="case-archive__toolbar">
          <label htmlFor="case-search">Search Case Archive</label>
          <input
            id="case-search"
            type="search"
            value={searchQuery}
            placeholder="Filter by Case Name"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {errorMessage ? (
          <div className="archive-alert" role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        {archiveActionError ? (
          <div className="archive-alert" role="alert">
            <p>{archiveActionError}</p>
            <button type="button" onClick={() => setArchiveActionError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="case-archive__content">
          {isLoading ? <p className="case-archive__empty">Opening the archive...</p> : null}

          {!isLoading && cases.length === 0 && cloudCases.length === 0 ? (
            <div className="case-archive__empty">
              <h2>No Cases Yet</h2>
              <p>Create a Case to begin preserving an investigation.</p>
              <Button type="button" variant="brass" onClick={openCreateDialog}>
                Create New Case
              </Button>
            </div>
          ) : null}

          {!isLoading && cases.length + cloudCases.length > 0 && filteredCases.length + filteredCloudCases.length === 0 ? (
            <div className="case-archive__empty">
              <h2>No Matching Cases</h2>
              <p>No Case Names match "{searchQuery}".</p>
            </div>
          ) : null}

          {filteredCases.length + filteredCloudCases.length > 0 ? (
            <div className="case-archive__grid">
              {filteredCases.map((loreCase) => (
                <CaseFile
                  key={loreCase.id}
                  loreCase={loreCase}
                  onOpen={handleOpenCase}
                  onEdit={setCaseBeingEdited}
                  onDelete={setCaseBeingDeleted}
                />
              ))}
              {filteredCloudCases.map((loreCase) => (
                <CaseFile
                  key={`cloud-${loreCase.id}`}
                  loreCase={loreCase}
                  actionLabel="Retrieve"
                  isCloudOnly
                  onOpen={handleRetrieveCase}
                  onEdit={() => undefined}
                  onDelete={() => undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isCreateDialogOpen ? (
        <CaseFormDialog
          mode="create"
          onCancel={() => {
            setIsCreateDialogOpen(false);
            createButtonRef.current?.focus();
          }}
          onSubmit={handleCreateCase}
        />
      ) : null}

      {caseBeingEdited ? (
        <CaseFormDialog
          mode="edit"
          initialCase={caseBeingEdited}
          onCancel={() => setCaseBeingEdited(null)}
          onSubmit={handleUpdateCase}
        />
      ) : null}

      {caseBeingDeleted ? (
        <DeleteCaseDialog
          loreCase={caseBeingDeleted}
          onCancel={() => setCaseBeingDeleted(null)}
          onConfirm={handleDeleteCase}
        />
      ) : null}
    </section>
  );
}
