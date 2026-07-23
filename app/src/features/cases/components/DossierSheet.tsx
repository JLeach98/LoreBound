import { Button } from '../../../components/ui/Button';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createStableId } from '../../../lib/stableId';
import { isThreadmarkGeneratedBond } from '../../threadmarks';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import { evidenceRecordRepository } from '../../../repositories/EvidenceRecordRepository';
import { useBonds } from '../context/BondContext';
import { useDossiers } from '../context/DossierContext';
import {
  type Bond,
  type BondFormValues,
} from '../types/bondTypes';
import type {
  Dossier,
  DossierFormValues,
  DossierSection,
} from '../types/dossierTypes';
import { dossierTypeLabels } from '../types/dossierTypes';
import {
  blocksToDocumentDraft,
  documentDraftToBlocks,
  getCaseFileBlockType,
  getVisibleCaseFileSections,
  hasRenderableCaseFileContent,
  isStructuredCaseFileBlock,
  syncDossierValuesFromNotebookSections,
  type CaseFileDocumentDraft,
} from '../utils/dossierBlocks';
import {
  getBondLabelFromPerspective,
  getConnectedDossier,
} from '../utils/bondLabels';
import {
  dossierToFormValues,
  ensureDossierSections,
  mergeDossierSectionsWithFormValues,
  normalizeSectionOrder,
} from '../utils/dossierSections';
import {
  createEvidenceAnchorContext,
  createMissingEvidenceRecordsFromThreadmarks,
  type EvidenceLogEntry,
  formatEvidenceLogSelectedText,
  getEvidenceLogEntries,
  hasDuplicateEvidenceRecord,
  reconcileEvidenceRecordsForSection,
} from '../../threadmarks/evidenceRecordSelectors';
import type { EvidenceRecord } from '../../threadmarks/evidenceRecordTypes';
import { threadmarkKeyToBondType } from '../../threadmarks/bondThreadmarkCompatibility';
import { BondFormDialog } from './BondFormDialog';
import { CaseFileDocumentEditor } from './CaseFileDocumentEditor';
import { CoverImageInput } from './CoverImageInput';

type DossierSheetProps = {
  dossier: Dossier;
  onClose: () => void;
  onDelete: (dossier: Dossier) => void;
  onCreated?: (dossier: Dossier) => void;
  initialEditMode?: boolean;
  isNewDraft?: boolean;
  isPinned?: boolean;
  onRemoveFromBoard?: (dossier: Dossier) => void;
  focusedEvidenceRecordId?: string | null;
  onOpenDossier?: (dossier: Dossier, options?: { evidenceRecordId?: string }) => void;
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

  if (dossier.dossierType === 'Theory') {
    return [
      { label: 'Confidence', value: dossier.theoryConfidence },
      { label: 'Status', value: dossier.theoryStatus },
    ];
  }

  return [];
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

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'LB';
}

function createDetailDraft(dossier: Dossier) {
  return dossierToFormValues({
    ...dossier,
    sections: ensureDossierSections(dossier),
  });
}

function getBondEvidenceCount(bond: Bond) {
  if (!bond.evidence) {
    return 0;
  }

  const evidenceNoteCount = Object.entries(bond.evidence)
    .filter(([key]) => key !== 'evidenceRecordIds')
    .filter(([, value]) => typeof value === 'string' && value.trim()).length;

  return evidenceNoteCount + (bond.evidence.evidenceRecordIds?.length ?? 0);
}

function canRecordBondFromEvidence(record: EvidenceRecord) {
  return typeof record.metadata.relationshipKey === 'string' &&
    Boolean(threadmarkKeyToBondType(record.metadata.relationshipKey));
}

function threadmarkButtonStyle(isDark = false) {
  return {
    background: 'transparent',
    border: 0,
    borderBottom: '2px solid rgba(176, 132, 56, 0.92)',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
    padding: '0 1px 1px',
    textDecoration: 'none',
    outlineOffset: '3px',
    textShadow: isDark ? '0 1px 1px rgba(0, 0, 0, 0.35)' : undefined,
  } satisfies CSSProperties;
}

export function DossierSheet({
  dossier,
  onClose,
  onDelete,
  onCreated,
  initialEditMode = false,
  isNewDraft = false,
  isPinned = false,
  onRemoveFromBoard,
  focusedEvidenceRecordId,
  onOpenDossier,
}: DossierSheetProps) {
  const { dossiers, createNewDossier, updateExistingDossier } = useDossiers();
  const {
    bonds,
    bondsForDossier,
    refreshBonds,
    createNewBond,
  } = useBonds();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const evidenceLogRef = useRef<HTMLDetailsElement>(null);
  const evidenceEntryRefs = useRef(new Map<string, HTMLLIElement>());
  const [workingDossier, setWorkingDossier] = useState(dossier);
  const [isDraftNewDossier, setIsDraftNewDossier] = useState(isNewDraft);
  const [creatingBondFromEvidence, setCreatingBondFromEvidence] = useState<EvidenceLogEntry | null>(null);
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [caseFileDraft, setCaseFileDraft] = useState<CaseFileDocumentDraft>(() =>
    blocksToDocumentDraft(ensureDossierSections(dossier)),
  );
  const [sectionNotice, setSectionNotice] = useState<string | undefined>();
  const [detailDraft, setDetailDraft] = useState<DossierFormValues>(() => createDetailDraft(dossier));
  const [detailImageError, setDetailImageError] = useState<string | undefined>();
  const [detailSaveError, setDetailSaveError] = useState<string | undefined>();
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [activeThreadmarkId, setActiveThreadmarkId] = useState<string | null>(null);
  const [highlightedEvidenceRecordId, setHighlightedEvidenceRecordId] = useState<string | null>(
    focusedEvidenceRecordId ?? null,
  );
  const sections = useMemo(() => ensureDossierSections(workingDossier), [workingDossier]);
  const caseFileSections = useMemo(
    () => getVisibleCaseFileSections(sections),
    [sections],
  );
  const keyFacts = useMemo(
    () => keyFactsForDossier(workingDossier).filter((field) => field.value),
    [workingDossier],
  );
  const dossierBonds = useMemo(
    () => {
      const relatedBonds = bondsForDossier(workingDossier.id);
      return relatedBonds
        .filter((bond) => {
          if (!isThreadmarkGeneratedBond(bond) || bond.sourceDossierId === workingDossier.id) {
            return true;
          }

          return !relatedBonds.some(
            (candidate) =>
              isThreadmarkGeneratedBond(candidate) &&
              candidate.threadmark?.ownerId === bond.threadmark?.ownerId &&
              candidate.threadmark?.pairId === bond.threadmark?.pairId &&
              candidate.sourceDossierId === workingDossier.id,
          );
        })
        .sort((left, right) => {
        const leftLabel = getBondLabelFromPerspective(left, workingDossier.id);
        const rightLabel = getBondLabelFromPerspective(right, workingDossier.id);
        const leftDossier = getConnectedDossier(left, workingDossier.id, dossiers);
        const rightDossier = getConnectedDossier(right, workingDossier.id, dossiers);

        return `${leftLabel} ${leftDossier?.name ?? ''}`.localeCompare(
          `${rightLabel} ${rightDossier?.name ?? ''}`,
        );
      });
    },
    [bondsForDossier, workingDossier.id, bonds, dossiers],
  );
  const hasImage = Boolean(workingDossier.coverImage);
  const activeThreadmark = activeThreadmarkId
    ? evidenceRecords.find((record) => record.id === activeThreadmarkId)
    : null;
  const activeThreadmarkTarget = activeThreadmark
    ? dossiers.find((candidate) => candidate.id === activeThreadmark.targetDossierId)
    : null;
  const evidenceLogEntries = useMemo(
    () =>
      getEvidenceLogEntries({
        records: evidenceRecords,
        dossiers,
        caseId: workingDossier.caseId,
        targetDossierId: workingDossier.id,
      }),
    [dossiers, evidenceRecords, workingDossier.caseId, workingDossier.id],
  );
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    setWorkingDossier(dossier);
    setIsDraftNewDossier(isNewDraft);
    setDetailDraft(createDetailDraft(dossier));
    setDetailImageError(undefined);
    setDetailSaveError(undefined);
  }, [dossier, isNewDraft]);

  async function refreshEvidenceRecords(caseId = workingDossier.caseId) {
    setEvidenceRecords(await evidenceRecordRepository.listByCase(caseId));
  }

  useEffect(() => {
    void refreshEvidenceRecords(dossier.caseId);
    setActiveThreadmarkId(null);
  }, [dossier.caseId, dossier.id]);

  useEffect(() => {
    setHighlightedEvidenceRecordId(focusedEvidenceRecordId ?? null);
  }, [focusedEvidenceRecordId, dossier.id]);

  useEffect(() => {
    if (!highlightedEvidenceRecordId) {
      return undefined;
    }

    evidenceLogRef.current?.setAttribute('open', '');
    window.requestAnimationFrame(() => {
      evidenceEntryRefs.current.get(highlightedEvidenceRecordId)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
    const timeoutId = window.setTimeout(() => setHighlightedEvidenceRecordId(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedEvidenceRecordId, evidenceLogEntries.length]);

  useEffect(() => {
    if (initialEditMode) {
      enterSectionEditMode();
    }
    // The initial edit request should only apply when a new sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCreatingBondFromEvidence(null);
    await refreshBonds();
  }

  async function saveSectionChanges(nextSections: DossierSection[], nextDetails = detailDraft) {
    const previousSections = ensureDossierSections(workingDossier);
    const normalizedSections = normalizeSectionOrder(nextSections);
    const values: DossierFormValues = {
      ...syncDossierValuesFromNotebookSections(
        {
          ...nextDetails,
          dossierType: workingDossier.dossierType,
          name: nextDetails.name.trim(),
        },
        normalizedSections,
      ),
      sections: normalizedSections,
    };

    const updatedDossier = isDraftNewDossier
      ? await createNewDossier(values)
      : await updateExistingDossier(workingDossier.id, values);

    const now = new Date().toISOString();
    const recordsForDossier = await evidenceRecordRepository.listByOriginDossier(workingDossier.id);
    const reconciledRecords = previousSections.flatMap((previousSection) => {
      const nextSection = normalizedSections.find((candidate) => candidate.id === previousSection.id);

      if (!nextSection || (previousSection.body ?? '') === (nextSection.body ?? '')) {
        return [];
      }

      return reconcileEvidenceRecordsForSection({
        records: recordsForDossier,
        originSectionId: previousSection.id,
        previousText: previousSection.body ?? '',
        updatedText: nextSection.body ?? '',
        updatedAt: now,
      });
    });

    await Promise.all(reconciledRecords.map((record) => evidenceRecordRepository.update(record)));
    const latestCaseRecords = await evidenceRecordRepository.listByCase(updatedDossier.caseId);
    const createdThreadmarkRecords = createMissingEvidenceRecordsFromThreadmarks({
      records: latestCaseRecords,
      sourceDossier: updatedDossier,
      sections: normalizedSections,
      dossiers,
      updatedAt: now,
      createId: () => createStableId('evidence'),
    });

    await Promise.all(createdThreadmarkRecords.map((record) => evidenceRecordRepository.create(record)));

    setWorkingDossier(updatedDossier);
    await refreshEvidenceRecords(updatedDossier.caseId);
    setIsDraftNewDossier(false);
    setDetailDraft(createDetailDraft(updatedDossier));
    onCreated?.(updatedDossier);
    await refreshBonds();

    if (createdThreadmarkRecords.length > 0) {
      requestAutomaticSynchronization('threadmark evidence record created');
    }
  }

  async function createEvidenceRecordFromSelection({
    targetDossier,
    originSectionId,
    selectedText,
    anchorStart,
    anchorEnd,
    originText,
  }: {
    targetDossier: Dossier;
    originSectionId: string;
    selectedText: string;
    anchorStart: number;
    anchorEnd: number;
    originText: string;
  }) {
    if (targetDossier.caseId !== workingDossier.caseId) {
      throw new Error('Threadmarks can only reference Dossiers from the active Investigation.');
    }

    const currentRecords = await evidenceRecordRepository.listByCase(workingDossier.caseId);
    const incoming = {
      caseId: workingDossier.caseId,
      originDossierId: workingDossier.id,
      originSectionId,
      targetDossierId: targetDossier.id,
      anchorStart,
      anchorEnd,
    };

    if (hasDuplicateEvidenceRecord(currentRecords, incoming)) {
      throw new Error('This Threadmark already exists.');
    }

    const now = new Date().toISOString();
    const record: EvidenceRecord = {
      id: createStableId('evidence'),
      ...incoming,
      selectedText,
      anchorContext: createEvidenceAnchorContext(originText, anchorStart, anchorEnd),
      metadata: {},
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await evidenceRecordRepository.create(record);
    await refreshEvidenceRecords(workingDossier.caseId);
    requestAutomaticSynchronization('threadmark evidence record created');
    setSectionNotice('Investigation Updated');
  }

  async function removeThreadmark(record: EvidenceRecord) {
    await evidenceRecordRepository.delete(record.id);
    setActiveThreadmarkId(null);
    await refreshEvidenceRecords(record.caseId);
    requestAutomaticSynchronization('threadmark evidence record removed');
    setSectionNotice('Investigation Updated');
  }

  function renderThreadmarkedText(text: string, section: DossierSection, isDark = false, baseOffset = 0): ReactNode {
    const records = evidenceRecords
      .filter((record) => record.status === 'active')
      .filter((record) => record.caseId === workingDossier.caseId)
      .filter((record) => record.originDossierId === workingDossier.id)
      .filter((record) => record.originSectionId === section.id)
      .filter((record) => {
        const localStart = record.anchorStart - baseOffset;
        const localEnd = record.anchorEnd - baseOffset;
        return localStart >= 0 && localEnd <= text.length && text.slice(localStart, localEnd) === record.selectedText;
      })
      .sort((left, right) => left.anchorStart - right.anchorStart);
    const nodes: ReactNode[] = [];
    let cursor = 0;

    records.forEach((record) => {
      const localStart = record.anchorStart - baseOffset;
      const localEnd = record.anchorEnd - baseOffset;

      if (localStart < cursor) {
        return;
      }

      nodes.push(text.slice(cursor, localStart));
      const targetDossier = dossiers.find((candidate) => candidate.id === record.targetDossierId);
      nodes.push(
        <button
          key={record.id}
          type="button"
          style={threadmarkButtonStyle(isDark)}
          onClick={() => {
            if (targetDossier && onOpenDossier) {
              onOpenDossier(targetDossier, { evidenceRecordId: record.id });
              return;
            }

            setActiveThreadmarkId(record.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (targetDossier && onOpenDossier) {
                onOpenDossier(targetDossier, { evidenceRecordId: record.id });
                return;
              }

              setActiveThreadmarkId(record.id);
            }
          }}
        >
          {text.slice(localStart, localEnd)}
        </button>,
      );
      cursor = localEnd;
    });

    nodes.push(text.slice(cursor));
    return nodes;
  }

  function renderEvidenceLog() {
    return (
      <details ref={evidenceLogRef} className="dossier-reveal__section" open>
        <summary>
          <h3>Evidence Log</h3>
        </summary>
        {evidenceLogEntries.length > 0 ? (
          <ol className="dossier-bonds__list" aria-label={`${workingDossier.name} Evidence Log`}>
            {evidenceLogEntries.map((entry) => (
              <li
                key={entry.record.id}
                ref={(element) => {
                  if (element) {
                    evidenceEntryRefs.current.set(entry.record.id, element);
                  } else {
                    evidenceEntryRefs.current.delete(entry.record.id);
                  }
                }}
                className="dossier-bonds__item"
                data-highlighted={highlightedEvidenceRecordId === entry.record.id ? 'true' : undefined}
              >
                <article className="dossier-bonds__link">
                  <span>
                    {onOpenDossier ? (
                      <button
                        type="button"
                        className="dossier-evidence-origin-link"
                        onClick={() => onOpenDossier(entry.originDossier)}
                      >
                        {entry.originDossier.name}
                      </button>
                    ) : (
                      <strong>{entry.originDossier.name}</strong>
                    )}
                    <small>{entry.originDossier.dossierType}</small>
                    <blockquote style={{ margin: '0.65rem 0', whiteSpace: 'pre-wrap' }}>
                      "{formatEvidenceLogSelectedText(entry.record.selectedText)}"
                    </blockquote>
                    <small>{formatRecordDate(entry.record.createdAt)}</small>
                  </span>
                  {canRecordBondFromEvidence(entry.record) ? (
                    <Button type="button" variant="brass" onClick={() => setCreatingBondFromEvidence(entry)}>
                      Record Bond
                    </Button>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dossier-reveal__empty">No evidence has been linked to this Dossier.</p>
        )}
      </details>
    );
  }

  function enterSectionEditMode() {
    setCaseFileDraft(blocksToDocumentDraft(ensureDossierSections(workingDossier)));
    setDetailDraft(createDetailDraft(workingDossier));
    setDetailImageError(undefined);
    setDetailSaveError(undefined);
    setIsEditingSections(true);
    setSectionNotice('Editing Dossier');
  }

  async function saveSectionDraft() {
    const trimmedName = detailDraft.name.trim();

    if (!trimmedName) {
      setDetailSaveError('Add a Name before saving this Dossier.');
      return;
    }

    if (detailImageError) {
      setDetailSaveError('LoreBound could not prepare the selected image.');
      return;
    }

    try {
      setDetailSaveError(undefined);
      const parsedDraftSections = documentDraftToBlocks(
        caseFileDraft,
        ensureDossierSections(workingDossier),
      );
      const mergedSections = mergeDossierSectionsWithFormValues(
        { ...workingDossier, sections: parsedDraftSections },
        syncDossierValuesFromNotebookSections(
          {
            ...detailDraft,
            name: trimmedName,
            sections: parsedDraftSections,
          },
          parsedDraftSections,
        ),
      );

      await saveSectionChanges(mergedSections, {
        ...detailDraft,
        name: trimmedName,
      });
      setIsEditingSections(false);
      setSectionNotice('Investigation Updated');
    } catch (error) {
      if (isDraftNewDossier) {
        setDetailSaveError(
          error instanceof Error && error.message.trim()
            ? error.message
            : 'LoreBound could not save this Dossier to the Local Archive.',
        );
        return;
      }

      setIsEditingSections(false);
      setSectionNotice(
        'Relationship Update Incomplete. LoreBound saved the Dossier, but one or more Threadmark relationships could not be completed.',
      );
    }
  }

  function cancelSectionDraft() {
    if (isDraftNewDossier) {
      onClose();
      return;
    }

    setCaseFileDraft(blocksToDocumentDraft(ensureDossierSections(workingDossier)));
    setDetailDraft(createDetailDraft(workingDossier));
    setDetailImageError(undefined);
    setDetailSaveError(undefined);
    setIsEditingSections(false);
    setSectionNotice(undefined);
  }

  function updateDetailDraft(values: Partial<DossierFormValues>) {
    setDetailDraft((currentDraft) => ({ ...currentDraft, ...values }));
  }

  function renderIdentityMetadataEditor() {
    return (
      <div className="case-file-identity-fields" aria-label="Dossier identity metadata">
        {workingDossier.dossierType === 'Character' ? (
          <div className="case-form__grid">
            <label className="case-form__field">
              Alias
              <input
                value={detailDraft.alias ?? ''}
                onChange={(event) => updateDetailDraft({ alias: event.target.value })}
              />
            </label>
            <label className="case-form__field">
              Status
              <select
                value={detailDraft.characterStatus ?? 'Unknown'}
                onChange={(event) =>
                  updateDetailDraft({ characterStatus: event.target.value as DossierFormValues['characterStatus'] })
                }
              >
                <option value="Alive">Alive</option>
                <option value="Deceased">Deceased</option>
                <option value="Unknown">Unknown</option>
              </select>
            </label>
            <label className="case-form__field">
              Affiliation
              <input
                value={detailDraft.affiliation ?? ''}
                onChange={(event) => updateDetailDraft({ affiliation: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {workingDossier.dossierType === 'Location' ? (
          <div className="case-form__grid">
            <label className="case-form__field">
              Region
              <input
                value={detailDraft.region ?? ''}
                onChange={(event) => updateDetailDraft({ region: event.target.value })}
              />
            </label>
            <label className="case-form__field">
              World
              <input
                value={detailDraft.world ?? ''}
                onChange={(event) => updateDetailDraft({ world: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {workingDossier.dossierType === 'Event' ? (
          <div className="case-form__grid">
            <label className="case-form__field">
              Date
              <input
                value={detailDraft.eventDate ?? ''}
                onChange={(event) => updateDetailDraft({ eventDate: event.target.value })}
              />
            </label>
            <label className="case-form__field">
              Era
              <input
                value={detailDraft.era ?? ''}
                onChange={(event) => updateDetailDraft({ era: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {workingDossier.dossierType === 'Organization' ? (
          <div className="case-form__grid">
            <label className="case-form__field">
              Leader
              <input
                value={detailDraft.leader ?? ''}
                onChange={(event) => updateDetailDraft({ leader: event.target.value })}
              />
            </label>
            <label className="case-form__field">
              Type
              <input
                value={detailDraft.organizationType ?? ''}
                onChange={(event) => updateDetailDraft({ organizationType: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {workingDossier.dossierType === 'Theory' ? (
          <div className="case-form__grid">
            <label className="case-form__field">
              Confidence
              <select
                value={detailDraft.theoryConfidence ?? 'Medium'}
                onChange={(event) =>
                  updateDetailDraft({ theoryConfidence: event.target.value as DossierFormValues['theoryConfidence'] })
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <label className="case-form__field">
              Status
              <select
                value={detailDraft.theoryStatus ?? 'Open'}
                onChange={(event) =>
                  updateDetailDraft({ theoryStatus: event.target.value as DossierFormValues['theoryStatus'] })
                }
              >
                <option value="Open">Open</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Disproven">Disproven</option>
              </select>
            </label>
          </div>
        ) : null}

        {detailSaveError ? (
          <p className="case-form__error" role="alert">
            {detailSaveError}
          </p>
        ) : null}
      </div>
    );
  }

  function renderCaseFileBlockView(section: DossierSection) {
    const blockType = getCaseFileBlockType(section);
    const body = section.body?.trim() ?? '';
    const shouldShowLegacyHeading =
      !isStructuredCaseFileBlock(section) &&
      Boolean(section.title.trim()) &&
      section.title !== 'Overview' &&
      section.title !== 'Investigation Notes';
    const listItems = body
      .split(/\n+/)
      .map((item) => item.replace(/^[-\d.\s]+/, '').trim())
      .filter(Boolean);
    let listSearchOffset = 0;
    const listItemsWithOffsets = listItems.map((item) => {
      const offset = Math.max(0, body.indexOf(item, listSearchOffset));
      listSearchOffset = offset + item.length;
      return { item, offset };
    });

    if (!blockType || !hasRenderableCaseFileContent(section)) {
      return null;
    }

    if (blockType === 'section-heading') {
      return (
        <section key={section.id} className="case-file-block case-file-block--heading">
          <h3>{body || section.title}</h3>
        </section>
      );
    }

    if (blockType === 'bulleted-list') {
      return (
        <ul key={section.id} className="case-file-block case-file-block--list">
          {listItemsWithOffsets.map(({ item, offset }) => (
            <li key={`${item}-${offset}`}>
              {renderThreadmarkedText(item, section, false, offset)}
            </li>
          ))}
        </ul>
      );
    }

    if (blockType === 'numbered-list') {
      return (
        <ol key={section.id} className="case-file-block case-file-block--list">
          {listItemsWithOffsets.map(({ item, offset }) => (
            <li key={`${item}-${offset}`}>
              {renderThreadmarkedText(item, section, false, offset)}
            </li>
          ))}
        </ol>
      );
    }

    if (blockType === 'quote') {
      return (
        <blockquote key={section.id} className="case-file-block case-file-block--quote">
          {renderThreadmarkedText(body, section, true)}
        </blockquote>
      );
    }

    if (blockType === 'divider') {
      return <hr key={section.id} className="case-file-block case-file-block--divider" />;
    }

    return (
      <section key={section.id} className="case-file-block case-file-block--legacy">
        {shouldShowLegacyHeading ? <h3>{section.title}</h3> : null}
        <p>{renderThreadmarkedText(body, section)}</p>
      </section>
    );
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
          {dossierTypeLabels[workingDossier.dossierType]}
        </div>

        <div className="dossier-reveal__paper">
          <header className="dossier-reveal__header">
            <p>{dossierTypeLabels[workingDossier.dossierType]}</p>
            {isEditingSections ? (
              <label className="case-file-identity-name">
                <span>Dossier Name</span>
                <input
                  id="dossier-sheet-title"
                  value={detailDraft.name}
                  onChange={(event) => updateDetailDraft({ name: event.target.value })}
                  required
                />
              </label>
            ) : (
              <h2 id="dossier-sheet-title">{workingDossier.name}</h2>
            )}
          </header>

          <div
            className={
              hasImage
                ? `dossier-reveal__lead dossier-reveal__lead--${workingDossier.dossierType.toLowerCase()}`
                : 'dossier-reveal__lead dossier-reveal__lead--no-image'
            }
          >
            {isEditingSections ? (
              <div className="dossier-reveal__photo dossier-reveal__photo--editor">
                <CoverImageInput
                  value={detailDraft.coverImage}
                  errorMessage={detailImageError}
                  onChange={(coverImage) => updateDetailDraft({ coverImage })}
                  onError={setDetailImageError}
                />
              </div>
            ) : workingDossier.coverImage ? (
              <figure className="dossier-reveal__photo">
                <img src={workingDossier.coverImage} alt={`${workingDossier.name} cover`} />
              </figure>
            ) : (
              <div className="dossier-reveal__photo dossier-reveal__photo--empty">
                <span>{workingDossier.dossierType.slice(0, 2)}</span>
              </div>
            )}

            {isEditingSections ? (
              renderIdentityMetadataEditor()
            ) : keyFacts.length > 0 ? (
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

          <div className="dossier-section-toolbar">
            <div>
              <span>Case File Canvas</span>
              {sectionNotice ? <p role="status">{sectionNotice}</p> : null}
            </div>
          </div>

          <section className="case-file-canvas" aria-labelledby="case-file-canvas-title">
            <div className="case-file-canvas__header">
              <h3 id="case-file-canvas-title">Case File</h3>
            </div>

            {isEditingSections ? (
              <CaseFileDocumentEditor
                draft={caseFileDraft}
                dossier={workingDossier}
                sections={sections}
                dossiers={dossiers}
                evidenceRecords={evidenceRecords}
                onChange={setCaseFileDraft}
                onCreateEvidenceRecord={createEvidenceRecordFromSelection}
                onNotice={setSectionNotice}
              />
            ) : caseFileSections.length > 0 ? (
              <div className="case-file-reader">
                {caseFileSections.map((section) => renderCaseFileBlockView(section))}
              </div>
            ) : (
              <p className="dossier-reveal__empty">No Evidence Collected</p>
            )}
          </section>

          {renderEvidenceLog()}

          {activeThreadmark ? (
            <section
              className="dossier-reveal__section"
              role="dialog"
              aria-label="Threadmark preview"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setActiveThreadmarkId(null);
                }
              }}
            >
              {activeThreadmarkTarget ? (
                <>
                  <h3>{activeThreadmarkTarget.name}</h3>
                  <p>{activeThreadmarkTarget.dossierType}</p>
                  <div className="dossier-bonds__actions">
                    <Button
                      type="button"
                      variant="brass"
                      onClick={() => {
                        setActiveThreadmarkId(null);
                        onOpenDossier?.(activeThreadmarkTarget);
                      }}
                    >
                      Open Dossier
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void removeThreadmark(activeThreadmark)}>
                      Remove Threadmark
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3>Threadmark Unavailable</h3>
                  <p>The linked Dossier is no longer available.</p>
                  <Button type="button" variant="secondary" onClick={() => void removeThreadmark(activeThreadmark)}>
                    Remove Threadmark
                  </Button>
                </>
              )}
            </section>
          ) : null}

          <section className="dossier-reveal__section dossier-bonds">
            <div className="dossier-bonds__header">
              <h3>Bonds</h3>
            </div>

            {dossierBonds.length > 0 ? (
              <ul className="dossier-bonds__list" aria-label={`${workingDossier.name} Bonds`}>
                {dossierBonds.map((bond) => {
                  const connectedDossier = getConnectedDossier(bond, workingDossier.id, dossiers);
                  const label = getBondLabelFromPerspective(bond, workingDossier.id);
                  const evidenceCount = getBondEvidenceCount(bond);

                  return (
                    <li key={bond.id} className="dossier-bonds__item">
                      {connectedDossier && onOpenDossier ? (
                        <button
                          type="button"
                          className="dossier-bonds__link"
                          aria-label={`${label}: open ${connectedDossier.name}, ${dossierTypeLabels[connectedDossier.dossierType]}`}
                          onClick={() => onOpenDossier(connectedDossier)}
                        >
                          {connectedDossier.coverImage ? (
                            <img src={connectedDossier.coverImage} alt="" />
                          ) : (
                            <span aria-hidden="true">{getInitials(connectedDossier.name)}</span>
                          )}
                          <span>
                            <strong>{label}</strong>
                            <em>{connectedDossier.name}</em>
                            <small>
                              {dossierTypeLabels[connectedDossier.dossierType]}
                              {bond.status ? ` / ${bond.status}` : ''}
                            </small>
                            {bond.notes ? <small>{bond.notes}</small> : null}
                            {evidenceCount > 0 ? <small>{evidenceCount} evidence notes</small> : null}
                          </span>
                        </button>
                      ) : (
                        <div className="dossier-bonds__link dossier-bonds__link--missing">
                          <span aria-hidden="true">??</span>
                          <span>
                            <strong>{label}</strong>
                            <em>Missing Dossier</em>
                            <small>Unknown Type</small>
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="dossier-reveal__section dossier-reveal__section--meta">
            <h3>Record Details</h3>
            <dl className="dossier-reveal__metadata">
              <div>
                <dt>Created</dt>
                <dd>{formatRecordDate(workingDossier.dateCreated)}</dd>
              </div>
              <div>
                <dt>Modified</dt>
                <dd>{formatRecordDate(workingDossier.dateModified)}</dd>
              </div>
            </dl>
          </section>

          <div className="dossier-reveal__actions">
            <Button ref={closeButtonRef} type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            {isEditingSections ? (
              <>
                <Button type="button" variant="ghost" onClick={cancelSectionDraft}>
                  Cancel
                </Button>
                <Button type="button" variant="brass" onClick={saveSectionDraft}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                {isPinned && onRemoveFromBoard ? (
                  <Button
                    type="button"
                    variant="plaque"
                    onClick={() => onRemoveFromBoard(workingDossier)}
                  >
                    Remove from Investigation
                  </Button>
                ) : null}
                <Button type="button" variant="brass" onClick={enterSectionEditMode}>
                  Edit Dossier
                </Button>
                <button type="button" className="danger-button" onClick={() => onDelete(workingDossier)}>
                  Delete
                </button>
              </>
            )}
            {isPinned && onRemoveFromBoard && isEditingSections ? (
              <Button
                type="button"
                variant="plaque"
                onClick={() => onRemoveFromBoard(workingDossier)}
              >
                Remove from Investigation
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {creatingBondFromEvidence ? (
        <BondFormDialog
          dossiers={dossiers.filter((candidate) => candidate.caseId === workingDossier.caseId)}
          initialSourceDossierId={creatingBondFromEvidence.originDossier.id}
          initialTargetDossierId={workingDossier.id}
          initialEvidenceRecordIds={[creatingBondFromEvidence.record.id]}
          evidenceRecords={evidenceRecords}
          requireEvidenceRecords
          defaultLabelsEmpty
          onCancel={() => setCreatingBondFromEvidence(null)}
          onSubmit={handleCreateBond}
        />
      ) : null}
    </div>
  );
}
