import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { BondFormDialog } from '../../cases/components/BondFormDialog';
import { DossierFormDialog } from '../../cases/components/DossierFormDialog';
import { useBonds } from '../../cases/context/BondContext';
import { useBoard } from '../../cases/context/BoardContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { Bond, BondFormValues } from '../../cases/types/bondTypes';
import type { Dossier, DossierFormValues, DossierType } from '../../cases/types/dossierTypes';
import { dossierTypeLabels } from '../../cases/types/dossierTypes';
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
    setSelectedDossier(createdDossier);
  }

  async function handleUpdate(values: DossierFormValues) {
    if (!editorState || editorState.mode !== 'edit') {
      return;
    }

    const updatedDossier = await updateExistingDossier(editorState.dossier.id, values);
    setEditorState(null);
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
        onBack={() => setSelectedDossier(null)}
        onOpenDossier={(dossier) => setSelectedDossier(dossier)}
        onEdit={() => setEditorState({ mode: 'edit', dossier: selectedDossier })}
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
            title="Delete Bond?"
            message={`${deletingBond.bondType} will be removed from this Investigation.`}
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
  children: ReactNode;
  onBack: () => void;
  onOpenDossier: (dossier: Dossier) => void;
  onEdit: () => void;
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
  children,
  onBack,
  onOpenDossier,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onCreateBond,
  onEditBond,
  onDeleteBond,
}: FieldKitDossierViewProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

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
        <Button type="button" variant="brass" onClick={onEdit}>
          Edit Dossier
        </Button>
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

      <section className="field-kit-file-section">
        <h3>Investigation Details</h3>
        <dl className="settings-compact-list">
          {dossier.alias ? <InfoRow label="Alias" value={dossier.alias} /> : null}
          {dossier.characterStatus ? <InfoRow label="Status" value={dossier.characterStatus} /> : null}
          {dossier.affiliation ? <InfoRow label="Affiliation" value={dossier.affiliation} /> : null}
          {dossier.region ? <InfoRow label="Region" value={dossier.region} /> : null}
          {dossier.world ? <InfoRow label="World" value={dossier.world} /> : null}
          {dossier.eventDate ? <InfoRow label="Date" value={dossier.eventDate} /> : null}
          {dossier.era ? <InfoRow label="Era" value={dossier.era} /> : null}
          {dossier.leader ? <InfoRow label="Leader" value={dossier.leader} /> : null}
          {dossier.organizationType ? <InfoRow label="Type" value={dossier.organizationType} /> : null}
          {dossier.theoryConfidence ? <InfoRow label="Confidence" value={dossier.theoryConfidence} /> : null}
          {dossier.theoryStatus ? <InfoRow label="Theory Status" value={dossier.theoryStatus} /> : null}
          <InfoRow label="Modified" value={formatShortDate(dossier.dateModified)} />
        </dl>
      </section>

      {dossier.notes ? (
        <section className="field-kit-file-section">
          <h3>Investigation Notes</h3>
          <p>{dossier.notes}</p>
        </section>
      ) : null}

      <section className="field-kit-file-section">
        <div className="field-kit-section-heading">
          <h3>Bonds</h3>
          <Button type="button" variant="secondary" onClick={onCreateBond}>
            Create Bond
          </Button>
        </div>
        {bonds.map((bond) => {
          const connectedDossier = getConnectedDossier(bond);

          return (
            <article key={bond.id} className="field-kit-bond-card">
              <div>
                <strong>{getBondLabel(bond, dossier.id)}</strong>
                <span>{connectedDossier?.name ?? 'Missing Dossier'}</span>
                {bond.status ? <small>{bond.status}</small> : null}
              </div>
              <div className="field-kit-inline-actions">
                {connectedDossier ? (
                  <Button type="button" variant="secondary" onClick={() => onOpenDossier(connectedDossier)}>
                    Open
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => onEditBond(bond)}>
                  Edit
                </Button>
                <Button type="button" variant="ghost" className="field-kit-danger-action" onClick={() => onDeleteBond(bond)}>
                  Delete
                </Button>
              </div>
            </article>
          );
        })}
        {bonds.length === 0 ? <p>No Bonds have been recorded for this Dossier.</p> : null}
      </section>
      {children}
    </section>
  );
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
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}
