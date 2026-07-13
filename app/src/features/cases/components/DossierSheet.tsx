import { Button } from '../../../components/ui/Button';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useBonds } from '../context/BondContext';
import { useDossiers } from '../context/DossierContext';
import {
  bondStatuses,
  builtInBondTypes,
  type Bond,
  type BondEvidence,
  type BondFormValues,
  type BondStatus,
} from '../types/bondTypes';
import type { Dossier, DossierFormValues, DossierType } from '../types/dossierTypes';
import { dossierTypeLabels, dossierTypes } from '../types/dossierTypes';
import {
  getBondLabelFromPerspective,
  getConnectedDossier,
} from '../utils/bondLabels';
import { BondFormDialog } from './BondFormDialog';
import { DeleteBondDialog } from './DeleteBondDialog';
import { DossierFormDialog } from './DossierFormDialog';

type DossierSheetProps = {
  dossier: Dossier;
  onClose: () => void;
  onEdit: (dossier: Dossier) => void;
  onDelete: (dossier: Dossier) => void;
  isPinned?: boolean;
  onRemoveFromBoard?: (dossier: Dossier) => void;
  onOpenDossier?: (dossier: Dossier) => void;
};

type DisplayField = {
  label: string;
  value?: string;
};

function keyFactsForDossier(dossier: Dossier): DisplayField[] {
  if (dossier.dossierType === 'Character') {
    return [
      { label: 'Alias', value: dossier.alias },
      { label: 'Status', value: dossier.characterStatus },
      { label: 'Affiliation', value: dossier.affiliation },
    ];
  }

  if (dossier.dossierType === 'Location') {
    return [
      { label: 'Region', value: dossier.region },
      { label: 'World', value: dossier.world },
    ];
  }

  if (dossier.dossierType === 'Event') {
    return [
      { label: 'Date', value: dossier.eventDate },
      { label: 'Era', value: dossier.era },
    ];
  }

  if (dossier.dossierType === 'Organization') {
    return [
      { label: 'Leader', value: dossier.leader },
      { label: 'Type', value: dossier.organizationType },
    ];
  }

  return [
    { label: 'Confidence', value: dossier.theoryConfidence },
    { label: 'Status', value: dossier.theoryStatus },
  ];
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function normalizeDossierName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findRelationshipDefinition(name: string) {
  return builtInBondTypes.find((definition) => definition.name === name);
}

function buildEvidence(evidence: BondEvidence) {
  return Object.values(evidence).some((value) => value?.trim()) ? evidence : undefined;
}

export function DossierSheet({
  dossier,
  onClose,
  onEdit,
  onDelete,
  isPinned = false,
  onRemoveFromBoard,
  onOpenDossier,
}: DossierSheetProps) {
  const { dossiers, createNewDossier } = useDossiers();
  const {
    bonds,
    bondsForDossier,
    createNewBond,
    updateExistingBond,
    deleteExistingBond,
  } = useBonds();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const [isCreatingBond, setIsCreatingBond] = useState(false);
  const [editingBond, setEditingBond] = useState<Bond | null>(null);
  const [deletingBond, setDeletingBond] = useState<Bond | null>(null);
  const [quickRelationshipName, setQuickRelationshipName] = useState(
    builtInBondTypes[0].name,
  );
  const [quickConnectedName, setQuickConnectedName] = useState('');
  const [quickTargetDossierId, setQuickTargetDossierId] = useState('');
  const [quickMissingType, setQuickMissingType] = useState<DossierType>('Character');
  const [quickStatus, setQuickStatus] = useState<BondStatus | ''>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickEvidence, setQuickEvidence] = useState<BondEvidence>({});
  const [isQuickAdvancedOpen, setIsQuickAdvancedOpen] = useState(false);
  const [isQuickCreateDossierOpen, setIsQuickCreateDossierOpen] = useState(false);
  const [quickError, setQuickError] = useState<string | undefined>();
  const keyFacts = useMemo(
    () => keyFactsForDossier(dossier).filter((field) => field.value),
    [dossier],
  );
  const dossierBonds = useMemo(
    () => bondsForDossier(dossier.id),
    [bondsForDossier, dossier.id, bonds],
  );
  const hasImage = Boolean(dossier.coverImage);
  const quickDefinition = findRelationshipDefinition(quickRelationshipName);
  const quickSearchResults = useMemo(() => {
    const query = normalizeDossierName(quickConnectedName);

    if (!query) {
      return [];
    }

    return dossiers
      .filter((candidate) => candidate.id !== dossier.id)
      .filter((candidate) => candidate.name.toLocaleLowerCase().includes(query))
      .slice(0, 5);
  }, [dossier.id, dossiers, quickConnectedName]);
  const exactQuickMatch = useMemo(
    () =>
      dossiers.find(
        (candidate) =>
          candidate.id !== dossier.id &&
          candidate.name.toLocaleLowerCase() === normalizeDossierName(quickConnectedName),
      ),
    [dossier.id, dossiers, quickConnectedName],
  );
  const quickTargetDossier =
    dossiers.find((candidate) => candidate.id === quickTargetDossierId) ??
    exactQuickMatch ??
    null;
  const canCreateMissingQuickDossier =
    normalizeDossierName(quickConnectedName).length > 0 && !exactQuickMatch;
  const canQuickSubmit =
    Boolean(quickDefinition) &&
    Boolean(quickTargetDossier) &&
    quickTargetDossier?.id !== dossier.id;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !documentRef.current) {
        return;
      }

      const focusableElements = Array.from(
        documentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleCreateBond(values: BondFormValues) {
    await createNewBond(values);
    setIsCreatingBond(false);
  }

  async function handleUpdateBond(values: BondFormValues) {
    if (!editingBond) {
      return;
    }

    await updateExistingBond(editingBond.id, values);
    setEditingBond(null);
  }

  async function handleDeleteBond() {
    if (!deletingBond) {
      return;
    }

    await deleteExistingBond(deletingBond.id);
    setDeletingBond(null);
  }

  async function handleQuickCreateMissingDossier(values: DossierFormValues) {
    const createdDossier = await createNewDossier(values);
    setQuickTargetDossierId(createdDossier.id);
    setQuickConnectedName(createdDossier.name);
    setIsQuickCreateDossierOpen(false);
  }

  async function handleQuickCreateBond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickDefinition || !quickTargetDossier) {
      setQuickError('Choose a relationship and a connected Dossier before adding a Bond.');
      return;
    }

    try {
      await createNewBond({
        sourceDossierId: dossier.id,
        targetDossierId: quickTargetDossier.id,
        bondType: quickDefinition.name,
        bondBehavior: quickDefinition.behavior,
        sourceLabel: quickDefinition.sourceLabel,
        targetLabel: quickDefinition.targetLabel,
        status: quickStatus || undefined,
        notes: quickNotes,
        evidence: buildEvidence(quickEvidence),
      });
      setQuickConnectedName('');
      setQuickTargetDossierId('');
      setQuickStatus('');
      setQuickNotes('');
      setQuickEvidence({});
      setQuickError(undefined);
    } catch (error) {
      console.error(error);
      setQuickError(error instanceof Error ? error.message : 'The Bond could not be added.');
    }
  }

  return (
    <div className="dossier-reveal-backdrop" role="presentation">
      <section
        ref={documentRef}
        className="dossier-reveal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-sheet-title"
      >
        <div className="dossier-reveal__folder" aria-hidden="true">
          {dossierTypeLabels[dossier.dossierType]}
        </div>

        <div className="dossier-reveal__paper">
          <header className="dossier-reveal__header">
            <p>{dossierTypeLabels[dossier.dossierType]}</p>
            <h2 id="dossier-sheet-title">{dossier.name}</h2>
          </header>

          <div
            className={
              hasImage
                ? `dossier-reveal__lead dossier-reveal__lead--${dossier.dossierType.toLowerCase()}`
                : 'dossier-reveal__lead dossier-reveal__lead--no-image'
            }
          >
            {dossier.coverImage ? (
              <figure className="dossier-reveal__photo">
                <img src={dossier.coverImage} alt={`${dossier.name} cover`} />
              </figure>
            ) : (
              <div className="dossier-reveal__photo dossier-reveal__photo--empty">
                <span>{dossier.dossierType.slice(0, 2)}</span>
              </div>
            )}

            {keyFacts.length > 0 ? (
              <dl className="dossier-reveal__facts" aria-label="Key facts">
                {keyFacts.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="dossier-reveal__empty">No identity facts have been recorded.</p>
            )}
          </div>

          {dossier.summary ? (
            <section className="dossier-reveal__section">
              <h3>Overview</h3>
              <p>{dossier.summary}</p>
            </section>
          ) : null}

          {dossier.notes ? (
            <section className="dossier-reveal__section">
              <h3>Notes</h3>
              <p>{dossier.notes}</p>
            </section>
          ) : null}

          <section className="dossier-reveal__section dossier-bonds">
            <div className="dossier-bonds__header">
              <h3>Bonds</h3>
              <Button type="button" variant="plaque" onClick={() => setIsCreatingBond(true)}>
                Advanced Details
              </Button>
            </div>
            <form className="quick-bond" onSubmit={handleQuickCreateBond}>
              <div className="quick-bond__row">
                <label>
                  Relationship
                  <select
                    value={quickRelationshipName}
                    onChange={(event) => setQuickRelationshipName(event.target.value)}
                  >
                    {builtInBondTypes.map((definition) => (
                      <option key={definition.name} value={definition.name}>
                        {definition.sourceLabel}
                        {definition.targetLabel ? ` / ${definition.targetLabel}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Connected Dossier
                  <input
                    value={quickConnectedName}
                    placeholder="Lilith Sorrengail"
                    aria-describedby="quick-bond-results quick-bond-preview"
                    onChange={(event) => {
                      setQuickConnectedName(event.target.value);
                      setQuickTargetDossierId('');
                    }}
                  />
                </label>
                <Button type="submit" variant="brass" disabled={!canQuickSubmit}>
                  Add Bond
                </Button>
              </div>

              <div id="quick-bond-results" className="quick-bond__results" aria-live="polite">
                {quickSearchResults.length > 0 ? (
                  <>
                    <span>Likely matches</span>
                    <div>
                      {quickSearchResults.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          aria-pressed={quickTargetDossier?.id === candidate.id}
                          onClick={() => {
                            setQuickTargetDossierId(candidate.id);
                            setQuickConnectedName(candidate.name);
                          }}
                        >
                          {candidate.name} · {dossierTypeLabels[candidate.dossierType]}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {canCreateMissingQuickDossier ? (
                  <div className="quick-bond__missing">
                    <select
                      aria-label="Missing Dossier Knowledge Type"
                      value={quickMissingType}
                      onChange={(event) => setQuickMissingType(event.target.value as DossierType)}
                    >
                      {dossierTypes.map((type) => (
                        <option key={type} value={type}>
                          {dossierTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setIsQuickCreateDossierOpen(true)}>
                      Create "{quickConnectedName.trim()}" as {quickMissingType}
                    </button>
                  </div>
                ) : null}
              </div>

              {quickDefinition && quickTargetDossier ? (
                <div id="quick-bond-preview" className="quick-bond__preview" aria-live="polite">
                  <strong>Reciprocal preview</strong>
                  <span>
                    {dossier.name}: {quickDefinition.sourceLabel} - {quickTargetDossier.name}
                  </span>
                  <span>
                    {quickTargetDossier.name}:{' '}
                    {quickDefinition.behavior === 'Directional'
                      ? `Connected through ${quickDefinition.sourceLabel}`
                      : (quickDefinition.targetLabel ?? quickDefinition.sourceLabel)}{' '}
                    - {dossier.name}
                  </span>
                </div>
              ) : null}

              <details
                className="quick-bond__advanced"
                open={isQuickAdvancedOpen}
                onToggle={(event) => setIsQuickAdvancedOpen(event.currentTarget.open)}
              >
                <summary>Advanced Details</summary>
                <div className="case-form__grid">
                  <label className="case-form__field">
                    Status
                    <select
                      value={quickStatus}
                      onChange={(event) => setQuickStatus(event.target.value as BondStatus | '')}
                    >
                      <option value="">No status</option>
                      {bondStatuses.map((bondStatus) => (
                        <option key={bondStatus} value={bondStatus}>
                          {bondStatus}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="case-form__field">
                    Source Title
                    <input
                      value={quickEvidence.sourceTitle ?? ''}
                      onChange={(event) =>
                        setQuickEvidence((currentEvidence) => ({
                          ...currentEvidence,
                          sourceTitle: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="case-form__field">
                    Reference
                    <input
                      value={quickEvidence.reference ?? ''}
                      onChange={(event) =>
                        setQuickEvidence((currentEvidence) => ({
                          ...currentEvidence,
                          reference: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="case-form__field">
                  Notes
                  <textarea
                    rows={2}
                    value={quickNotes}
                    onChange={(event) => setQuickNotes(event.target.value)}
                  />
                </label>
              </details>

              {quickError ? (
                <p className="case-form__error" role="alert">
                  {quickError}
                </p>
              ) : null}
            </form>

            {dossierBonds.length > 0 ? (
              <ul className="dossier-bonds__list" aria-label={`${dossier.name} Bonds`}>
                {dossierBonds.map((bond) => {
                  const connectedDossier = getConnectedDossier(bond, dossier.id, dossiers);
                  const label = getBondLabelFromPerspective(bond, dossier.id);

                  return (
                    <li key={bond.id} className="dossier-bonds__item">
                      <div>
                        <strong>{label}</strong>
                        <span>{connectedDossier?.name ?? 'Missing Dossier'}</span>
                        <small>
                          {connectedDossier
                            ? dossierTypeLabels[connectedDossier.dossierType]
                            : 'Unknown Type'}
                          {bond.status ? ` / ${bond.status}` : ''}
                        </small>
                        {bond.evidence ? <small>Evidence attached</small> : null}
                      </div>
                      <div className="dossier-bonds__actions">
                        {connectedDossier && onOpenDossier ? (
                          <button
                            type="button"
                            onClick={() => onOpenDossier(connectedDossier)}
                          >
                            Open
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setEditingBond(bond)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeletingBond(bond)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="dossier-reveal__empty">No Bonds have been recorded.</p>
            )}
          </section>

          <section className="dossier-reveal__section dossier-reveal__section--meta">
            <h3>Record Details</h3>
            <dl className="dossier-reveal__metadata">
              <div>
                <dt>Created</dt>
                <dd>{formatRecordDate(dossier.dateCreated)}</dd>
              </div>
              <div>
                <dt>Modified</dt>
                <dd>{formatRecordDate(dossier.dateModified)}</dd>
              </div>
            </dl>
          </section>

          <div className="dossier-reveal__actions">
            <Button ref={closeButtonRef} type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            {isPinned && onRemoveFromBoard ? (
              <Button
                type="button"
                variant="plaque"
                onClick={() => onRemoveFromBoard(dossier)}
              >
                Remove from Investigation
              </Button>
            ) : null}
            <Button type="button" variant="brass" onClick={() => onEdit(dossier)}>
              Edit
            </Button>
            <button type="button" className="danger-button" onClick={() => onDelete(dossier)}>
              Delete
            </button>
          </div>
        </div>
      </section>

      {isCreatingBond ? (
        <BondFormDialog
          dossiers={dossiers}
          initialSourceDossierId={dossier.id}
          onCancel={() => setIsCreatingBond(false)}
          onSubmit={handleCreateBond}
        />
      ) : null}

      {isQuickCreateDossierOpen ? (
        <DossierFormDialog
          dossierType={quickMissingType}
          initialName={quickConnectedName.trim()}
          onCancel={() => setIsQuickCreateDossierOpen(false)}
          onSubmit={handleQuickCreateMissingDossier}
        />
      ) : null}

      {editingBond ? (
        <BondFormDialog
          dossiers={dossiers}
          initialBond={editingBond}
          onCancel={() => setEditingBond(null)}
          onSubmit={handleUpdateBond}
        />
      ) : null}

      {deletingBond ? (
        <DeleteBondDialog
          bond={deletingBond}
          sourceDossier={dossiers.find((candidate) => candidate.id === deletingBond.sourceDossierId)}
          targetDossier={dossiers.find((candidate) => candidate.id === deletingBond.targetDossierId)}
          onCancel={() => setDeletingBond(null)}
          onConfirm={handleDeleteBond}
        />
      ) : null}
    </div>
  );
}
