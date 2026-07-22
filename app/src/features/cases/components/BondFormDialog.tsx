import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { useDossiers } from '../context/DossierContext';
import {
  bondBehaviors,
  bondStatuses,
  builtInBondTypes,
  customBondTypeName,
  type Bond,
  type BondBehavior,
  type BondFormValues,
  type BondStatus,
} from '../types/bondTypes';
import type { Dossier, DossierFormValues, DossierType } from '../types/dossierTypes';
import { dossierTypeLabels, dossierTypes } from '../types/dossierTypes';
import { DossierFormDialog } from './DossierFormDialog';
import type { EvidenceRecord } from '../../threadmarks/evidenceRecordTypes';

type BondFormDialogProps = {
  dossiers: Dossier[];
  initialBond?: Bond;
  initialSourceDossierId?: string;
  initialTargetDossierId?: string;
  initialEvidenceRecordIds?: string[];
  evidenceRecords?: EvidenceRecord[];
  requireEvidenceRecords?: boolean;
  defaultLabelsEmpty?: boolean;
  onCancel: () => void;
  onSubmit: (values: BondFormValues) => Promise<void>;
};

function findBondDefinition(name: string) {
  return builtInBondTypes.find((definition) => definition.name === name);
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function BondFormDialog({
  dossiers,
  initialBond,
  initialSourceDossierId,
  initialTargetDossierId,
  initialEvidenceRecordIds = [],
  evidenceRecords = [],
  requireEvidenceRecords = false,
  defaultLabelsEmpty = false,
  onCancel,
  onSubmit,
}: BondFormDialogProps) {
  const { createNewDossier } = useDossiers();
  const [sourceDossierId, setSourceDossierId] = useState(
    initialBond?.sourceDossierId ?? initialSourceDossierId ?? '',
  );
  const [targetDossierId, setTargetDossierId] = useState(
    initialBond?.targetDossierId ?? initialTargetDossierId ?? '',
  );
  const [bondType, setBondType] = useState(initialBond?.bondType ?? builtInBondTypes[0].name);
  const initialDefinition = findBondDefinition(initialBond?.bondType ?? builtInBondTypes[0].name);
  const [bondBehavior, setBondBehavior] = useState<BondBehavior>(
    initialBond?.bondBehavior ?? initialDefinition?.behavior ?? 'Symmetric',
  );
  const [sourceLabel, setSourceLabel] = useState(
    initialBond?.sourceLabel ?? (defaultLabelsEmpty ? '' : initialDefinition?.sourceLabel ?? builtInBondTypes[0].sourceLabel),
  );
  const [targetLabel, setTargetLabel] = useState(
    initialBond?.targetLabel ?? (defaultLabelsEmpty ? '' : initialDefinition?.targetLabel ?? ''),
  );
  const [status, setStatus] = useState<BondStatus | ''>(initialBond?.status ?? '');
  const [notes, setNotes] = useState(initialBond?.notes ?? '');
  const [sourceTitle, setSourceTitle] = useState(initialBond?.evidence?.sourceTitle ?? '');
  const [sourceType, setSourceType] = useState(initialBond?.evidence?.sourceType ?? '');
  const [reference, setReference] = useState(initialBond?.evidence?.reference ?? '');
  const [evidenceNotes, setEvidenceNotes] = useState(
    initialBond?.evidence?.evidenceNotes ?? '',
  );
  const [selectedEvidenceRecordIds, setSelectedEvidenceRecordIds] = useState<string[]>(
    initialBond?.evidence?.evidenceRecordIds ?? initialEvidenceRecordIds,
  );
  const [targetSearch, setTargetSearch] = useState('');
  const [newDossierType, setNewDossierType] = useState<DossierType>('Character');
  const [isCreateDossierOpen, setIsCreateDossierOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const filteredTargets = useMemo(() => {
    const query = normalizeSearch(targetSearch);
    const sourceDossier = dossiers.find((dossier) => dossier.id === sourceDossierId);
    const candidates = dossiers
      .filter((dossier) => dossier.id !== sourceDossierId)
      .filter((dossier) => !sourceDossier || dossier.caseId === sourceDossier.caseId);

    if (!query) {
      return candidates;
    }

    return candidates.filter((dossier) =>
      dossier.name.toLocaleLowerCase().includes(query),
    );
  }, [dossiers, sourceDossierId, targetSearch]);

  const canOfferCreate =
    !requireEvidenceRecords &&
    normalizeSearch(targetSearch).length > 0 &&
    !dossiers.some(
      (dossier) => dossier.name.toLocaleLowerCase() === normalizeSearch(targetSearch),
    );
  const sourceDossier =
    dossiers.find((dossier) => dossier.id === sourceDossierId) ?? null;
  const targetDossier =
    dossiers.find((dossier) => dossier.id === targetDossierId) ?? null;
  const availableEvidenceRecords = useMemo(
    () =>
      sourceDossier && targetDossier && sourceDossier.caseId === targetDossier.caseId
        ? evidenceRecords
            .filter((record) => record.status === 'active')
            .filter((record) => record.caseId === sourceDossier.caseId)
            .filter(
              (record) =>
                (record.originDossierId === sourceDossier.id && record.targetDossierId === targetDossier.id) ||
                (record.originDossierId === targetDossier.id && record.targetDossierId === sourceDossier.id),
            )
        : [],
    [evidenceRecords, sourceDossier, targetDossier],
  );
  const selectedEvidenceRecords = availableEvidenceRecords.filter((record) =>
    selectedEvidenceRecordIds.includes(record.id),
  );
  const endpointsShareCase = !sourceDossier || !targetDossier || sourceDossier.caseId === targetDossier.caseId;
  const canSubmit =
    Boolean(sourceDossierId) &&
    Boolean(targetDossierId) &&
    sourceDossierId !== targetDossierId &&
    endpointsShareCase &&
    Boolean(bondType.trim()) &&
    (!requireEvidenceRecords || selectedEvidenceRecords.length > 0) &&
    !isSaving;
  const reciprocalTargetLabel =
    bondBehavior === 'Directional'
      ? `Connected through ${sourceLabel.trim() || bondType.trim()}`
      : targetLabel.trim() || sourceLabel.trim() || bondType.trim();

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving && !isCreateDossierOpen) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateDossierOpen, isSaving, onCancel]);

  function handleBondTypeChange(nextBondType: string) {
    setBondType(nextBondType);
    const definition = findBondDefinition(nextBondType);

    if (!definition) {
      return;
    }

    setBondBehavior(definition.behavior);
    setSourceLabel(definition.sourceLabel);
    setTargetLabel(definition.targetLabel ?? '');
  }

  async function handleCreateMissingDossier(values: DossierFormValues) {
    const createdDossier = await createNewDossier(values);
    setTargetDossierId(createdDossier.id);
    setTargetSearch(createdDossier.name);
    setIsCreateDossierOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setSubmitError(
        requireEvidenceRecords
          ? 'Choose two different Dossiers from the same Investigation and attach supporting Evidence.'
          : 'Choose two different Dossiers from the same Investigation.',
      );
      return;
    }

    setIsSaving(true);
    setSubmitError(undefined);

    try {
      await onSubmit({
        sourceDossierId,
        targetDossierId,
        bondType: bondType.trim(),
        bondBehavior,
        sourceLabel: sourceLabel.trim(),
        targetLabel: targetLabel.trim(),
        status: status || undefined,
        notes,
        evidence: {
          sourceTitle,
          sourceType,
          reference,
          evidenceNotes,
          evidenceRecordIds: selectedEvidenceRecords.map((record) => record.id),
        },
      });
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : 'The Bond could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="case-dialog-backdrop" role="presentation">
        <section
          className="case-dialog case-dialog--bond"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bond-dialog-title"
        >
          <form className="case-form" onSubmit={handleSubmit}>
            <div className="case-dialog__header">
              <p>{initialBond ? 'Edit Bond' : 'New Bond'}</p>
              <h2 id="bond-dialog-title">
                {initialBond ? 'Edit Connection' : 'Create Connection'}
              </h2>
            </div>

            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="bond-source">Source Dossier</label>
                <select
                  ref={firstFieldRef}
                  id="bond-source"
                  value={sourceDossierId}
                  onChange={(event) => {
                    setSourceDossierId(event.target.value);

                    if (event.target.value === targetDossierId) {
                      setTargetDossierId('');
                    }
                  }}
                  required
                >
                  <option value="">Choose source</option>
                  {dossiers.map((dossier) => (
                    <option key={dossier.id} value={dossier.id}>
                      {dossier.name} ({dossierTypeLabels[dossier.dossierType]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="case-form__field">
                <label htmlFor="bond-target-search">Target Search</label>
                <input
                  id="bond-target-search"
                  value={targetSearch}
                  placeholder="Search by Name"
                  onChange={(event) => setTargetSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="case-form__field">
              <label htmlFor="bond-target">Target Dossier</label>
              <select
                id="bond-target"
                value={targetDossierId}
                onChange={(event) => setTargetDossierId(event.target.value)}
                required
              >
                <option value="">Choose target</option>
                {filteredTargets.map((dossier) => (
                  <option key={dossier.id} value={dossier.id}>
                    {dossier.name} ({dossierTypeLabels[dossier.dossierType]})
                  </option>
                ))}
              </select>
              {canOfferCreate ? (
                <div className="bond-form__create-missing">
                  <select
                    aria-label="New Dossier type"
                    value={newDossierType}
                    onChange={(event) => setNewDossierType(event.target.value as DossierType)}
                  >
                    {dossierTypes.map((type) => (
                      <option key={type} value={type}>
                        {dossierTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setIsCreateDossierOpen(true)}>
                    Create "{targetSearch.trim()}"
                  </button>
                </div>
              ) : null}
            </div>

            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="bond-type">Bond Type</label>
                <select
                  id="bond-type"
                  value={findBondDefinition(bondType) ? bondType : customBondTypeName}
                  onChange={(event) => {
                    if (event.target.value === customBondTypeName) {
                      setBondType(customBondTypeName);
                      setBondBehavior('Directional');
                      setSourceLabel('');
                      setTargetLabel('');
                      return;
                    }

                    if (defaultLabelsEmpty) {
                      setBondType(event.target.value);
                      setBondBehavior(findBondDefinition(event.target.value)?.behavior ?? 'Symmetric');
                      return;
                    }

                    handleBondTypeChange(event.target.value);
                  }}
                >
                  {builtInBondTypes.map((definition) => (
                    <option key={definition.name} value={definition.name}>
                      {definition.name}
                    </option>
                  ))}
                  <option value={customBondTypeName}>{customBondTypeName}</option>
                </select>
              </div>

              {!findBondDefinition(bondType) ? (
                <div className="case-form__field">
                  <label htmlFor="custom-bond-type">Custom Bond Name</label>
                  <input
                    id="custom-bond-type"
                    value={bondType === customBondTypeName ? '' : bondType}
                    onChange={(event) => setBondType(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              <div className="case-form__field">
                <label htmlFor="bond-behavior">Behavior</label>
                <select
                  id="bond-behavior"
                  value={bondBehavior}
                  onChange={(event) => setBondBehavior(event.target.value as BondBehavior)}
                >
                  {bondBehaviors.map((behavior) => (
                    <option key={behavior} value={behavior}>
                      {behavior}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="source-label">Source Label</label>
                <input
                  id="source-label"
                  value={sourceLabel}
                  onChange={(event) => setSourceLabel(event.target.value)}
                />
              </div>
              <div className="case-form__field">
                <label htmlFor="target-label">Target Label</label>
                <input
                  id="target-label"
                  value={targetLabel}
                  onChange={(event) => setTargetLabel(event.target.value)}
                />
              </div>
              <div className="case-form__field">
                <label htmlFor="bond-status">Status</label>
                <select
                  id="bond-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as BondStatus | '')}
                >
                  <option value="">No status</option>
                  {bondStatuses.map((bondStatus) => (
                    <option key={bondStatus} value={bondStatus}>
                      {bondStatus}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="case-form__field">
              <label htmlFor="bond-notes">Notes</label>
              <textarea
                id="bond-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {sourceDossier && targetDossier && sourceLabel.trim() ? (
              <div className="bond-form__preview" aria-live="polite">
                <strong>Reciprocal preview</strong>
                <span>
                  {sourceDossier.name}: {sourceLabel.trim()} - {targetDossier.name}
                </span>
                <span>
                  {targetDossier.name}: {reciprocalTargetLabel} - {sourceDossier.name}
                </span>
              </div>
            ) : null}

            <details className="bond-form__evidence">
              <summary>Evidence Citation</summary>
              <div className="case-form__grid">
                <div className="case-form__field">
                  <label htmlFor="bond-source-title">Source Title</label>
                  <input
                    id="bond-source-title"
                    value={sourceTitle}
                    onChange={(event) => setSourceTitle(event.target.value)}
                  />
                </div>
                <div className="case-form__field">
                  <label htmlFor="bond-source-type">Source Type</label>
                  <input
                    id="bond-source-type"
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value)}
                  />
                </div>
                <div className="case-form__field">
                  <label htmlFor="bond-reference">Reference</label>
                  <input
                    id="bond-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>
              </div>
              <div className="case-form__field">
                <label htmlFor="bond-evidence-notes">Evidence Notes</label>
                <textarea
                  id="bond-evidence-notes"
                  rows={2}
                  value={evidenceNotes}
                  onChange={(event) => setEvidenceNotes(event.target.value)}
                />
              </div>
            </details>

            {requireEvidenceRecords ? (
              <section className="bond-form__evidence" aria-labelledby="bond-evidence-records-title">
                <h3 id="bond-evidence-records-title">Supporting Evidence</h3>
                {availableEvidenceRecords.length > 0 ? (
                  <div className="settings-compact-list">
                    {availableEvidenceRecords.map((record) => {
                      const isRequiredEvidence = initialEvidenceRecordIds.includes(record.id);
                      const selectedText =
                        record.selectedText.length > 120
                          ? `${record.selectedText.slice(0, 119)}...`
                          : record.selectedText;

                      return (
                        <label key={record.id} className="case-form__field">
                          <input
                            type="checkbox"
                            checked={selectedEvidenceRecordIds.includes(record.id)}
                            disabled={isRequiredEvidence}
                            onChange={(event) => {
                              setSelectedEvidenceRecordIds((currentIds) =>
                                event.target.checked
                                  ? [...new Set([...currentIds, record.id])]
                                  : currentIds.filter((id) => id !== record.id),
                              );
                            }}
                          />
                          "{selectedText}"
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="case-form__error">No supporting Evidence Records are available for this endpoint pair.</p>
                )}
              </section>
            ) : null}

            {submitError ? <p className="case-form__error">{submitError}</p> : null}

            <div className="case-dialog__actions">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="brass" disabled={!canSubmit}>
                {isSaving ? 'Saving...' : 'Save Bond'}
              </Button>
            </div>
          </form>
        </section>
      </div>

      {isCreateDossierOpen ? (
        <DossierFormDialog
          dossierType={newDossierType}
          initialName={targetSearch.trim()}
          onCancel={() => setIsCreateDossierOpen(false)}
          onSubmit={handleCreateMissingDossier}
        />
      ) : null}
    </>
  );
}
