import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { useBoard } from '../context/BoardContext';
import { useDossiers } from '../context/DossierContext';
import type { Dossier, DossierFormValues, DossierType } from '../types/dossierTypes';
import { dossierTypeLabels } from '../types/dossierTypes';
import { DeleteDossierDialog } from './DeleteDossierDialog';
import { DossierFormDialog } from './DossierFormDialog';
import { DossierSheet } from './DossierSheet';

type DossierSectionViewProps = {
  dossierType: DossierType;
  title: string;
  emptyMessage: string;
  hasActiveCase: boolean;
  onReturnToBoard: () => void;
  managerTabs?: ReactNode;
};

export function DossierSectionView({
  dossierType,
  title,
  emptyMessage,
  hasActiveCase,
  onReturnToBoard,
  managerTabs,
}: DossierSectionViewProps) {
  const {
    pinDossier,
    removeDossierFromBoard,
    isDossierPinned,
  } = useBoard();
  const {
    dossiers,
    isLoading,
    errorMessage,
    createNewDossier,
    updateExistingDossier,
    deleteExistingDossier,
    clearError,
  } = useDossiers();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null);
  const [deletingDossier, setDeletingDossier] = useState<Dossier | null>(null);
  const [pinningDossierId, setPinningDossierId] = useState<string | null>(null);
  const lastOpenedControlRef = useRef<HTMLButtonElement | null>(null);

  const sectionDossiers = useMemo(
    () => dossiers.filter((dossier) => dossier.dossierType === dossierType),
    [dossierType, dossiers],
  );
  const filteredDossiers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return sectionDossiers;
    }

    return sectionDossiers.filter((dossier) =>
      dossier.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [searchQuery, sectionDossiers]);

  async function handleCreateDossier(values: DossierFormValues) {
    await createNewDossier(values);
    setIsCreateDialogOpen(false);
  }

  async function handleUpdateDossier(values: DossierFormValues) {
    if (!editingDossier) {
      return;
    }

    const updatedDossier = await updateExistingDossier(editingDossier.id, values);
    setEditingDossier(null);
    setSelectedDossier(updatedDossier);
  }

  async function handleDeleteDossier() {
    if (!deletingDossier) {
      return;
    }

    await deleteExistingDossier(deletingDossier.id);
    await removeDossierFromBoard(deletingDossier.id);
    setDeletingDossier(null);
    setSelectedDossier(null);
  }

  async function handlePinDossier(dossier: Dossier) {
    setPinningDossierId(dossier.id);

    try {
      await pinDossier(dossier.id);
    } finally {
      setPinningDossierId(null);
    }
  }

  async function handleRemoveFromBoard(dossier: Dossier) {
    await removeDossierFromBoard(dossier.id);
  }

  function getDossierSecondaryText(dossier: Dossier) {
    if (dossier.dossierType === 'Character') {
      return [dossier.alias, dossier.characterStatus, dossier.affiliation]
        .filter(Boolean)
        .join(' / ');
    }

    if (dossier.dossierType === 'Location') {
      return [dossier.region, dossier.world].filter(Boolean).join(' / ');
    }

    if (dossier.dossierType === 'Event') {
      return [dossier.eventDate, dossier.era].filter(Boolean).join(' / ');
    }

    if (dossier.dossierType === 'Organization') {
      return [dossier.leader, dossier.organizationType].filter(Boolean).join(' / ');
    }

    return [dossier.theoryConfidence, dossier.theoryStatus].filter(Boolean).join(' / ');
  }

  function formatModifiedDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  function openDossier(dossier: Dossier, opener: HTMLButtonElement) {
    lastOpenedControlRef.current = opener;
    setSelectedDossier(dossier);
  }

  function closeDossier() {
    setSelectedDossier(null);
    window.setTimeout(() => lastOpenedControlRef.current?.focus(), 0);
  }

  return (
    <>
      <section className="dossier-section" aria-labelledby="dossier-section-heading">
        <div className="dossier-section__header">
          <div>
            <p className="dossier-section__eyebrow">
              {managerTabs ? 'Dossier Manager' : 'Active Investigation'}
            </p>
            <h2 id="dossier-section-heading">{title}</h2>
          </div>
          <Button
            type="button"
            variant="brass"
            disabled={!hasActiveCase}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create {dossierType}
          </Button>
        </div>

        {managerTabs}

        {!hasActiveCase ? (
          <p className="dossier-section__empty">
            Open a Case before creating Dossiers.
          </p>
        ) : (
          <>
            <label className="dossier-section__search" htmlFor={`${dossierType}-search`}>
              Search {title}
              <input
                id={`${dossierType}-search`}
                type="search"
                value={searchQuery}
                placeholder="Filter by Name"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            {errorMessage ? (
              <div className="archive-alert" role="alert">
                <p>{errorMessage}</p>
                <button type="button" onClick={clearError}>
                  Dismiss
                </button>
              </div>
            ) : null}

            {isLoading ? <p className="dossier-section__empty">Opening files...</p> : null}

            {!isLoading && sectionDossiers.length === 0 ? (
              <div className="dossier-section__empty">
                <p>{emptyMessage}</p>
                <Button
                  type="button"
                  variant="brass"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  Create {dossierType} Dossier
                </Button>
              </div>
            ) : null}

            {!isLoading && sectionDossiers.length > 0 && filteredDossiers.length === 0 ? (
              <p className="dossier-section__empty">
                No {dossierTypeLabels[dossierType]} records match "{searchQuery}".
              </p>
            ) : null}

            {filteredDossiers.length > 0 ? (
              <div className="dossier-section__grid">
                {filteredDossiers.map((dossier) => (
                  <article key={dossier.id} className="dossier-card">
                    <span className="dossier-card__tab" aria-hidden="true">
                      {dossierTypeLabels[dossier.dossierType]}
                    </span>
                    {dossier.coverImage ? (
                      <img src={dossier.coverImage} alt={`${dossier.name} cover`} />
                    ) : (
                      <div className="dossier-card__fallback" aria-hidden="true">
                        {dossier.dossierType.slice(0, 2)}
                      </div>
                    )}
                    <div className="dossier-card__body">
                      <h3>{dossier.name}</h3>
                      {getDossierSecondaryText(dossier) ? (
                        <p>{getDossierSecondaryText(dossier)}</p>
                      ) : null}
                      {dossier.summary ? <span>{dossier.summary}</span> : null}
                      <small>Modified {formatModifiedDate(dossier.dateModified)}</small>
                    </div>
                    <div className="dossier-card__actions">
                      <button
                        type="button"
                        onClick={(event) => openDossier(dossier, event.currentTarget)}
                      >
                        Open File
                      </button>
                      {isDossierPinned(dossier.id) ? (
                        <>
                          <span className="dossier-card__status">Pinned</span>
                          <button
                            type="button"
                            className="dossier-card__quiet-action"
                            onClick={() => handleRemoveFromBoard(dossier)}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="dossier-card__quiet-action"
                          onClick={() => handlePinDossier(dossier)}
                          disabled={pinningDossierId === dossier.id}
                        >
                          Add
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingDossier(dossier)}>
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        )}

        <div className="dossier-section__footer">
          <Button type="button" variant="plaque" onClick={onReturnToBoard}>
            Return to Board
          </Button>
        </div>
      </section>

      {isCreateDialogOpen ? (
        <DossierFormDialog
          dossierType={dossierType}
          onCancel={() => setIsCreateDialogOpen(false)}
          onSubmit={handleCreateDossier}
        />
      ) : null}

      {selectedDossier ? (
        <DossierSheet
          dossier={selectedDossier}
          onClose={closeDossier}
          onEdit={setEditingDossier}
          onDelete={setDeletingDossier}
          isPinned={isDossierPinned(selectedDossier.id)}
          onRemoveFromBoard={handleRemoveFromBoard}
        />
      ) : null}

      {editingDossier ? (
        <DossierFormDialog
          dossierType={editingDossier.dossierType}
          initialDossier={editingDossier}
          onCancel={() => setEditingDossier(null)}
          onSubmit={handleUpdateDossier}
        />
      ) : null}

      {deletingDossier ? (
        <DeleteDossierDialog
          dossier={deletingDossier}
          onCancel={() => setDeletingDossier(null)}
          onConfirm={handleDeleteDossier}
        />
      ) : null}
    </>
  );
}
