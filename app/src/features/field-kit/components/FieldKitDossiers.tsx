import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { BondFormDialog } from '../../cases/components/BondFormDialog';
import { DossierFormDialog } from '../../cases/components/DossierFormDialog';
import { useBonds } from '../../cases/context/BondContext';
import { useBoard } from '../../cases/context/BoardContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { Bond, BondFormValues } from '../../cases/types/bondTypes';
import type {
  Dossier,
  DossierFormValues,
  DossierSection,
  DossierType,
} from '../../cases/types/dossierTypes';
import { dossierTypeLabels } from '../../cases/types/dossierTypes';
import { ensureDossierSections } from '../../cases/utils/dossierSections';
import {
  fieldKitDossierPluralLabels,
  fieldKitDossierTypes,
  formatShortDate,
  getBondLabel,
  getDossierSecondaryLine,
} from '../utils/fieldKitFormat';
import { FieldKitThumbnail } from './FieldKitThumbnail';

type FieldKitDossiersProps = {
  initialType?: DossierType;
  initialDossierId?: string;
};

type DossierEditorState =
  | { mode: 'create'; dossierType: DossierType }
  | { mode: 'edit'; dossier: Dossier }
  | null;

export function FieldKitDossiers({ initialType = 'Character', initialDossierId }: FieldKitDossiersProps) {
  const { dossiers, createNewDossier, updateExistingDossier, deleteExistingDossier } = useDossiers();
  const { createNewBond, updateExistingBond, deleteExistingBond, bondsForDossier } = useBonds();
  const { isDossierPinned, pinDossier, removeDossierFromBoard } = useBoard();
  const [activeType, setActiveType] = useState<DossierType>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [editorState, setEditorState] = useState<DossierEditorState>(null);
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [bondEditor, setBondEditor] = useState<{ dossier: Dossier; bond?: Bond } | null>(null);
  const [deletingDossier, setDeletingDossier] = useState<Dossier | null>(null);
  const [deletingBond, setDeletingBond] = useState<Bond | null>(null);

  useEffect(() => {
    if (!initialDossierId) {
      return;
    }

    const dossier = dossiers.find((candidate) => candidate.id === initialDossierId);

    if (dossier) {
      setActiveType(dossier.dossierType);
      setSelectedDossier(dossier);
    }
  }, [dossiers, initialDossierId]);

  const filteredDossiers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    return dossiers.filter((dossier) => {
      const matchesType = dossier.dossierType === activeType;
      const matchesSearch = !query || dossier.name.toLocaleLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [activeType, dossiers, searchQuery]);

  async function handleCreate(values: DossierFormValues) {
    const createdDossier = await createNewDossier(values);
    setEditorState(null);
    setIsEditingDossier(false);
    setSelectedDossier(createdDossier);
  }

  async function handleUpdate(values: DossierFormValues) {
    if (!editorState || editorState.mode !== 'edit') {
      return;
    }

    const updatedDossier = await updateExistingDossier(editorState.dossier.id, values);
    setEditorState(null);
    setIsEditingDossier(true);
    setSelectedDossier(updatedDossier);
  }

  async function handleDeleteDossier() {
    if (!deletingDossier) {
      return;
    }

    await deleteExistingDossier(deletingDossier.id);
    setSelectedDossier((current) => (current?.id === deletingDossier.id ? null : current));
    setDeletingDossier(null);
  }

  async function handleBondSubmit(values: BondFormValues) {
    if (!bondEditor) {
      return;
    }

    if (bondEditor.bond) {
      await updateExistingBond(bondEditor.bond.id, values);
    } else {
      await createNewBond(values);
    }

    setBondEditor(null);
  }

  async function handleDeleteBond() {
    if (!deletingBond) {
      return;
    }

    await deleteExistingBond(deletingBond.id);
    setDeletingBond(null);
  }

  if (selectedDossier) {
    return (
      <FieldKitDossierView
        dossier={selectedDossier}
        dossiers={dossiers}
        bonds={bondsForDossier(selectedDossier.id)}
        isPinned={isDossierPinned(selectedDossier.id)}
        isEditing={isEditingDossier}
        onBack={() => {
          setIsEditingDossier(false);
          setSelectedDossier(null);
        }}
        onOpenDossier={(dossier) => {
          setIsEditingDossier(false);
          setSelectedDossier(dossier);
        }}
        onEnterEdit={() => setIsEditingDossier(true)}
        onDoneEditing={() => setIsEditingDossier(false)}
        onEditDetails={() => setEditorState({ mode: 'edit', dossier: selectedDossier })}
        onDelete={() => setDeletingDossier(selectedDossier)}
        onPin={async () => {
          await pinDossier(selectedDossier.id);
        }}
        onUnpin={async () => {
          await removeDossierFromBoard(selectedDossier.id);
        }}
        onCreateBond={() => setBondEditor({ dossier: selectedDossier })}
        onEditBond={(bond) => setBondEditor({ dossier: selectedDossier, bond })}
        onDeleteBond={setDeletingBond}
      >
        {editorState?.mode === 'edit' ? (
          <DossierFormDialog
            dossierType={editorState.dossier.dossierType}
            initialDossier={editorState.dossier}
            onCancel={() => setEditorState(null)}
            onSubmit={handleUpdate}
          />
        ) : null}
        {bondEditor ? (
          <BondFormDialog
            dossiers={dossiers}
            initialBond={bondEditor.bond}
            initialSourceDossierId={bondEditor.dossier.id}
            onCancel={() => setBondEditor(null)}
            onSubmit={handleBondSubmit}
          />
        ) : null}
        {deletingDossier ? (
          <ConfirmPanel
            title="Delete Dossier?"
            message={`${deletingDossier.name} will be removed from this Investigation.`}
            onCancel={() => setDeletingDossier(null)}
            onConfirm={handleDeleteDossier}
          />
        ) : null}
        {deletingBond ? (
          <ConfirmPanel
            title="Remove Bond?"
            message={getBondRemovalMessage(deletingBond, selectedDossier, dossiers)}
            onCancel={() => setDeletingBond(null)}
            onConfirm={handleDeleteBond}
          />
        ) : null}
      </FieldKitDossierView>
    );
  }

  return (
    <section className="field-kit-panel" aria-labelledby="field-kit-dossiers-title">
      <header className="field-kit-panel__header">
        <div>
          <span>Dossier Drawer</span>
          <h2 id="field-kit-dossiers-title">Dossiers</h2>
        </div>
        <Button
          type="button"
          variant="brass"
          onClick={() => setEditorState({ mode: 'create', dossierType: activeType })}
        >
          Create
        </Button>
      </header>

      <div className="field-kit-type-tabs" role="tablist" aria-label="Dossier type filters">
        {fieldKitDossierTypes.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={activeType === type}
            className={activeType === type ? 'field-kit-type-tabs__active' : ''}
            onClick={() => setActiveType(type)}
          >
            {fieldKitDossierPluralLabels[type]}
          </button>
        ))}
      </div>

      <label className="field-kit-search">
        <span>Search Dossiers</span>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by Name"
        />
      </label>

      <div className="field-kit-list">
        {filteredDossiers.map((dossier) => (
          <button
            key={dossier.id}
            type="button"
            className="field-kit-record field-kit-record--button"
            aria-label={`Open ${dossier.name}, ${dossierTypeLabels[dossier.dossierType]}`}
            onClick={() => setSelectedDossier(dossier)}
          >
            <FieldKitThumbnail image={dossier.coverImage} name={dossier.name} />
            <span>
              <strong>{dossier.name}</strong>
              <small>{dossier.dossierType}</small>
              <em>
                {getDossierSecondaryLine(dossier)}
                {` / ${bondsForDossier(dossier.id).length} Bonds`}
              </em>
            </span>
          </button>
        ))}
        {filteredDossiers.length === 0 ? (
          <div className="field-kit-empty">
            <h3>No Matching Records Found</h3>
            <p>{`No ${dossierTypeLabels[activeType]} records match this drawer.`}</p>
          </div>
        ) : null}
      </div>

      {editorState?.mode === 'create' ? (
        <DossierFormDialog
          dossierType={editorState.dossierType}
          onCancel={() => setEditorState(null)}
          onSubmit={handleCreate}
        />
      ) : null}
    </section>
  );
}

type FieldKitDossierViewProps = {
  dossier: Dossier;
  dossiers: Dossier[];
  bonds: Bond[];
  isPinned: boolean;
  isEditing: boolean;
  children: ReactNode;
  onBack: () => void;
  onOpenDossier: (dossier: Dossier) => void;
  onEnterEdit: () => void;
  onDoneEditing: () => void;
  onEditDetails: () => void;
  onDelete: () => void;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
  onCreateBond: () => void;
  onEditBond: (bond: Bond) => void;
  onDeleteBond: (bond: Bond) => void;
};

function FieldKitDossierView({
  dossier,
  dossiers,
  bonds,
  isPinned,
  isEditing,
  children,
  onBack,
  onOpenDossier,
  onEnterEdit,
  onDoneEditing,
  onEditDetails,
  onDelete,
  onPin,
  onUnpin,
  onCreateBond,
  onEditBond,
  onDeleteBond,
}: FieldKitDossierViewProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const dossierSections = useMemo(() => ensureDossierSections(dossier), [dossier]);
  const displayBonds = useMemo(
    () =>
      [...bonds].sort((left, right) => {
        const leftDossier = getConnectedDossier(left);
        const rightDossier = getConnectedDossier(right);

        return `${getBondLabel(left, dossier.id)} ${leftDossier?.name ?? ''}`.localeCompare(
          `${getBondLabel(right, dossier.id)} ${rightDossier?.name ?? ''}`,
        );
      }),
    [bonds, dossiers, dossier.id],
  );

  function getConnectedDossier(bond: Bond) {
    const connectedId =
      bond.sourceDossierId === dossier.id ? bond.targetDossierId : bond.sourceDossierId;

    return dossiers.find((candidate) => candidate.id === connectedId) ?? null;
  }

  return (
    <section className="field-kit-panel field-kit-dossier-view" aria-labelledby="mobile-dossier-title">
      <header className="field-kit-panel__header">
        <button type="button" onClick={onBack} aria-label="Back to Dossiers">
          Back
        </button>
        <div>
          <span>{dossier.dossierType}</span>
          <h2 id="mobile-dossier-title">{dossierTypeLabels[dossier.dossierType]}</h2>
        </div>
      </header>

      <div className="field-kit-dossier-hero">
        <FieldKitThumbnail image={dossier.coverImage} name={dossier.name} />
        <div>
          <h3>{dossier.name}</h3>
          <p>{dossier.summary || getDossierSecondaryLine(dossier)}</p>
        </div>
      </div>

      <div className="field-kit-dossier-actions">
        {isEditing ? (
          <>
            <Button type="button" variant="brass" onClick={onDoneEditing}>
              Done
            </Button>
            <Button type="button" variant="secondary" onClick={onEditDetails}>
              Edit Details
            </Button>
          </>
        ) : (
          <Button type="button" variant="brass" onClick={onEnterEdit}>
            Edit Dossier
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          aria-expanded={isActionMenuOpen}
          aria-label="More Dossier actions"
          onClick={() => setIsActionMenuOpen((current) => !current)}
        >
          More Actions
        </Button>
        {isActionMenuOpen ? (
          <div className="field-kit-action-menu">
            <button
              type="button"
              onClick={() => {
                setIsActionMenuOpen(false);
                void (isPinned ? onUnpin() : onPin());
              }}
            >
              {isPinned ? 'Remove From Board' : 'Pin to Board'}
            </button>
            <button
              type="button"
              className="field-kit-action-menu__danger"
              onClick={() => {
                setIsActionMenuOpen(false);
                onDelete();
              }}
            >
              Delete Dossier
            </button>
          </div>
        ) : null}
      </div>

      {dossierSections
        .filter((section) => section.kind !== 'relationships')
        .map((section) => (
          <section key={section.id} className="field-kit-file-section">
            <h3>{section.title}</h3>
            {renderFieldKitSection(section)}
          </section>
        ))}

        <section className="field-kit-file-section">
          <h3>Record Details</h3>
          <dl className="settings-compact-list">
            <InfoRow label="Modified" value={formatShortDate(dossier.dateModified)} />
          </dl>
        </section>

      <section className="field-kit-file-section">
        <div className="field-kit-section-heading">
          <h3>Bonds</h3>
          {isEditing ? (
            <Button type="button" variant="secondary" onClick={onCreateBond}>
              Add Bond
            </Button>
          ) : null}
        </div>
        {displayBonds.map((bond) => {
          const connectedDossier = getConnectedDossier(bond);
          const bondLabel = getBondLabel(bond, dossier.id);

          return (
            <article key={bond.id} className="field-kit-bond-card">
              {connectedDossier ? (
                <button
                  type="button"
                  className="field-kit-bond-card__link"
                  aria-label={`${bondLabel}: open ${connectedDossier.name}, ${dossierTypeLabels[connectedDossier.dossierType]}`}
                  onClick={() => onOpenDossier(connectedDossier)}
                >
                  <FieldKitThumbnail image={connectedDossier.coverImage} name={connectedDossier.name} />
                  <span>
                    <strong>{bondLabel}</strong>
                    <em>{connectedDossier.name}</em>
                    <small>
                      {dossierTypeLabels[connectedDossier.dossierType]}
                      {bond.status ? ` / ${bond.status}` : ''}
                    </small>
                    {bond.notes ? <small>{bond.notes}</small> : null}
                  </span>
                </button>
              ) : (
                <div className="field-kit-bond-card__link">
                  <FieldKitThumbnail name="Missing Dossier" />
                  <span>
                    <strong>{bondLabel}</strong>
                    <em>Missing Dossier</em>
                    <small>Unknown Type</small>
                  </span>
                </div>
              )}
              {isEditing ? (
                <div className="field-kit-inline-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onEditBond(bond)}
                    aria-label={`Edit Bond with ${connectedDossier?.name ?? 'missing Dossier'}`}
                  >
                    Edit Bond
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="field-kit-danger-action"
                    onClick={() => onDeleteBond(bond)}
                    aria-label={`Remove Bond between ${dossier.name} and ${connectedDossier?.name ?? 'missing Dossier'}`}
                  >
                    Remove Bond
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
        {displayBonds.length === 0 ? <p>No Bonds recorded.</p> : null}
      </section>
      {children}
    </section>
  );
}

function renderFieldKitSection(section: DossierSection) {
  if (section.kind === 'identity') {
    return section.fields?.length ? (
      <dl className="settings-compact-list">
        {section.fields.map((field) => (
          <InfoRow key={field.id} label={field.label} value={field.value} />
        ))}
      </dl>
    ) : (
      <p>No identity facts have been recorded.</p>
    );
  }

  if (section.kind === 'timeline') {
    return <p>Timeline Sections are reserved for a future LoreBound update.</p>;
  }

  if (section.kind === 'gallery') {
    return <p>Gallery Sections are reserved for a future LoreBound update.</p>;
  }

  if (section.kind === 'evidence') {
    return <p>Evidence Sections are reserved for a future LoreBound update.</p>;
  }

  return section.body ? <p>{section.body}</p> : <p>No entries recorded.</p>;
}

function getBondRemovalMessage(bond: Bond, currentDossier: Dossier, dossiers: Dossier[]) {
  const connectedId =
    bond.sourceDossierId === currentDossier.id ? bond.targetDossierId : bond.sourceDossierId;
  const connectedDossier = dossiers.find((candidate) => candidate.id === connectedId);

  return `The connection between "${currentDossier.name}" and "${
    connectedDossier?.name ?? 'the connected Dossier'
  }" will be removed. The connected Dossiers will not be deleted.`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ConfirmPanel({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="case-settings-confirm-backdrop" role="presentation">
      <section className="case-settings-confirm" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="auth-dialog__actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="brass" className="field-kit-confirm-danger" onClick={onConfirm}>
            Remove Bond
          </Button>
        </div>
      </section>
    </div>
  );
}
