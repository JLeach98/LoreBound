import { Button } from '../../../components/ui/Button';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createStableId } from '../../../lib/stableId';
import {
  executeThreadmarkBondReconciliation,
  isThreadmarkGeneratedBond,
  ThreadmarkAuthoringTextarea,
} from '../../threadmarks';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import { useBonds } from '../context/BondContext';
import { useDossiers } from '../context/DossierContext';
import {
  createBond as createStoredBond,
  deleteBond as deleteStoredBond,
  updateBond as updateStoredBond,
} from '../storage/caseStorage';
import {
  bondStatuses,
  builtInBondTypes,
  type Bond,
  type BondEvidence,
  type BondFormValues,
  type BondStatus,
} from '../types/bondTypes';
import type {
  Dossier,
  DossierFormValues,
  DossierSection,
  DossierType,
} from '../types/dossierTypes';
import { dossierTypeLabels, dossierTypes } from '../types/dossierTypes';
import {
  caseFileBlockOptions,
  changeCaseFileBlockType,
  createCaseFileBlockSection,
  ensureEditableNotebookSections,
  getCaseFileBlockLabel,
  getCaseFileBlockType,
  getCaseFileSections,
  getVisibleCaseFileSections,
  hasRenderableCaseFileContent,
  isStructuredCaseFileBlock,
  prepareNotebookSections,
  syncDossierValuesFromNotebookSections,
  type CaseFileBlockType,
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
import { BondFormDialog } from './BondFormDialog';
import { CoverImageInput } from './CoverImageInput';
import { DeleteBondDialog } from './DeleteBondDialog';
import { DossierFormDialog } from './DossierFormDialog';

type DossierSheetProps = {
  dossier: Dossier;
  onClose: () => void;
  onDelete: (dossier: Dossier) => void;
  onCreated?: (dossier: Dossier) => void;
  initialEditMode?: boolean;
  isNewDraft?: boolean;
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

function normalizeDossierName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findRelationshipDefinition(name: string) {
  return builtInBondTypes.find((definition) => definition.name === name);
}

function buildEvidence(evidence: BondEvidence) {
  return Object.values(evidence).some((value) => value?.trim()) ? evidence : undefined;
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
  return bond.evidence
    ? Object.values(bond.evidence).filter((value) => value?.trim()).length
    : 0;
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
  onOpenDossier,
}: DossierSheetProps) {
  const { dossiers, createNewDossier, updateExistingDossier } = useDossiers();
  const {
    bonds,
    bondsForDossier,
    refreshBonds,
    createNewBond,
    updateExistingBond,
    deleteExistingBond,
  } = useBonds();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const pendingBlockFocusIdRef = useRef<string | null>(null);
  const didFocusInitialBlockRef = useRef(false);
  const [workingDossier, setWorkingDossier] = useState(dossier);
  const [isDraftNewDossier, setIsDraftNewDossier] = useState(isNewDraft);
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
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [draftSections, setDraftSections] = useState<DossierSection[]>([]);
  const [sectionNotice, setSectionNotice] = useState<string | undefined>();
  const [detailDraft, setDetailDraft] = useState<DossierFormValues>(() => createDetailDraft(dossier));
  const [detailImageError, setDetailImageError] = useState<string | undefined>();
  const [detailSaveError, setDetailSaveError] = useState<string | undefined>();
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const sections = useMemo(() => ensureDossierSections(workingDossier), [workingDossier]);
  const caseFileSections = useMemo(
    () => (isEditingSections ? getCaseFileSections(draftSections) : getVisibleCaseFileSections(sections)),
    [draftSections, isEditingSections, sections],
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
  const quickDefinition = findRelationshipDefinition(quickRelationshipName);
  const quickSearchResults = useMemo(() => {
    const query = normalizeDossierName(quickConnectedName);

    if (!query) {
      return [];
    }

    return dossiers
      .filter((candidate) => candidate.id !== workingDossier.id)
      .filter((candidate) => candidate.name.toLocaleLowerCase().includes(query))
      .slice(0, 5);
  }, [workingDossier.id, dossiers, quickConnectedName]);
  const exactQuickMatch = useMemo(
    () =>
      dossiers.find(
        (candidate) =>
          candidate.id !== workingDossier.id &&
          candidate.name.toLocaleLowerCase() === normalizeDossierName(quickConnectedName),
      ),
    [workingDossier.id, dossiers, quickConnectedName],
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
    quickTargetDossier?.id !== workingDossier.id;

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

  useEffect(() => {
    if (initialEditMode) {
      enterSectionEditMode();
    }
    // The initial edit request should only apply when a new sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditingSections) {
      didFocusInitialBlockRef.current = false;
      return;
    }

    const pendingFocusId = pendingBlockFocusIdRef.current;
    const initialFocusId =
      pendingFocusId ??
      (!didFocusInitialBlockRef.current
        ? caseFileSections.find((section) => getCaseFileBlockType(section) === 'paragraph' && !section.body?.trim())?.id
        : null);
    const blockIdToFocus = initialFocusId ?? null;

    if (!blockIdToFocus) {
      return;
    }

    window.setTimeout(() => {
      const field = documentRef.current?.querySelector<HTMLElement>(
        `[data-case-file-block-id="${blockIdToFocus}"]`,
      );

      field?.focus();
      pendingBlockFocusIdRef.current = null;
      didFocusInitialBlockRef.current = true;
    }, 0);
  }, [caseFileSections, isEditingSections]);

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
        sourceDossierId: workingDossier.id,
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

  async function saveSectionChanges(nextSections: DossierSection[], nextDetails = detailDraft) {
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

    setWorkingDossier(updatedDossier);
    setIsDraftNewDossier(false);
    setDetailDraft(createDetailDraft(updatedDossier));
    onCreated?.(updatedDossier);
    const reconciliationResult = await executeThreadmarkBondReconciliation(
      {
        sourceDossier: updatedDossier,
        sections: normalizedSections,
        dossiers,
        bonds,
      },
      {
        createBond: (values) => createStoredBond(updatedDossier.caseId, values),
        updateBond: updateStoredBond,
        deleteBond: deleteStoredBond,
      },
    );
    await refreshBonds();

    if (
      reconciliationResult.created.length > 0 ||
      reconciliationResult.updated.length > 0 ||
      reconciliationResult.removed.length > 0
    ) {
      requestAutomaticSynchronization('threadmark relationships updated');
    }
  }

  function enterSectionEditMode() {
    setDraftSections(ensureEditableNotebookSections(workingDossier));
    setDetailDraft(createDetailDraft(workingDossier));
    setDetailImageError(undefined);
    setDetailSaveError(undefined);
    pendingBlockFocusIdRef.current = null;
    didFocusInitialBlockRef.current = false;
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
      const mergedSections = isDraftNewDossier
        ? prepareNotebookSections(draftSections)
        : prepareNotebookSections(
            mergeDossierSectionsWithFormValues(
              workingDossier,
              syncDossierValuesFromNotebookSections(
                {
                  ...detailDraft,
                  name: trimmedName,
                  sections: draftSections,
                },
                draftSections,
              ),
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

    pendingBlockFocusIdRef.current = null;
    didFocusInitialBlockRef.current = false;
    setDraftSections([]);
    setDetailDraft(createDetailDraft(workingDossier));
    setDetailImageError(undefined);
    setDetailSaveError(undefined);
    setIsEditingSections(false);
    setSectionNotice(undefined);
  }

  function updateDraftSections(nextSections: DossierSection[]) {
    setDraftSections(prepareNotebookSections(nextSections));
  }

  function focusNotebookBlock(sectionId: string) {
    window.setTimeout(() => {
      documentRef.current
        ?.querySelector<HTMLElement>(`[data-case-file-block-id="${sectionId}"]`)
        ?.focus();
    }, 0);
  }

  function updateSectionBody(sectionId: string, body: string) {
    updateDraftSections(
      draftSections.map((section) =>
        section.id === sectionId ? { ...section, body } : section,
      ),
    );
  }

  function updateNotebookBlock(sectionId: string, values: Partial<DossierSection>) {
    updateDraftSections(
      draftSections.map((section) =>
        section.id === sectionId ? { ...section, ...values } : section,
      ),
    );
  }

  function addNotebookBlock(type: CaseFileBlockType = 'paragraph', afterSectionId?: string) {
    const insertionIndex = afterSectionId
      ? draftSections.findIndex((section) => section.id === afterSectionId) + 1
      : draftSections.length;
    const safeIndex = insertionIndex > 0 ? insertionIndex : draftSections.length;
    const nextSections = [...draftSections];
    const newSection = createCaseFileBlockSection(type, safeIndex);

    nextSections.splice(safeIndex, 0, newSection);
    pendingBlockFocusIdRef.current = newSection.id;
    updateDraftSections(nextSections);
    setActiveBlockId(newSection.id);
    setIsInsertMenuOpen(false);
    focusNotebookBlock(newSection.id);
    setSectionNotice(`${getCaseFileBlockLabel(type)} added`);
  }

  function changeNotebookBlock(section: DossierSection, type: CaseFileBlockType) {
    updateDraftSections(
      draftSections.map((candidate) =>
        candidate.id === section.id ? changeCaseFileBlockType(candidate, type) : candidate,
      ),
    );
    setSectionNotice(`Changed to ${getCaseFileBlockLabel(type)}`);
  }

  function duplicateNotebookBlock(section: DossierSection) {
    const index = draftSections.findIndex((candidate) => candidate.id === section.id);
    const nextSections = [...draftSections];
    const duplicate = {
      ...section,
      id: createStableId(section.templateId),
      title: section.title,
      isCollapsed: false,
    };

    nextSections.splice(index + 1, 0, duplicate);
    updateDraftSections(nextSections);
    setSectionNotice(`${getCaseFileBlockLabel(getCaseFileBlockType(section) ?? 'paragraph')} duplicated`);
  }

  function deleteNotebookBlock(section: DossierSection) {
    const contentSections = getCaseFileSections(draftSections);
    const currentIndex = contentSections.findIndex((candidate) => candidate.id === section.id);
    const fallbackSection = contentSections[currentIndex - 1] ?? contentSections[currentIndex + 1] ?? null;
    const nextSections = draftSections.filter((candidate) => candidate.id !== section.id);

    if (fallbackSection) {
      pendingBlockFocusIdRef.current = fallbackSection.id;
      setActiveBlockId(fallbackSection.id);
      focusNotebookBlock(fallbackSection.id);
    }

    updateDraftSections(nextSections);
    setSectionNotice('Block removed from draft');
  }

  function moveNotebookBlock(sectionId: string, direction: -1 | 1) {
    const currentIndex = draftSections.findIndex((section) => section.id === sectionId);
    let nextIndex = currentIndex + direction;

    while (
      nextIndex >= 0 &&
      nextIndex < draftSections.length &&
      !getCaseFileBlockType(draftSections[nextIndex])
    ) {
      nextIndex += direction;
    }

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= draftSections.length) {
      return;
    }

    const nextSections = [...draftSections];
    const [section] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, section);
    updateDraftSections(nextSections);
    setSectionNotice('Block order updated');
  }

  function reorderNotebookBlock(sourceSectionId: string, targetSectionId: string) {
    if (sourceSectionId === targetSectionId) {
      return;
    }

    const sourceIndex = draftSections.findIndex((section) => section.id === sourceSectionId);
    const targetIndex = draftSections.findIndex((section) => section.id === targetSectionId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextSections = [...draftSections];
    const [section] = nextSections.splice(sourceIndex, 1);
    nextSections.splice(targetIndex, 0, section);
    updateDraftSections(nextSections);
    setDraggedSectionId(null);
    setSectionNotice('Block order updated');
  }

  function handleNotebookInput(section: DossierSection, value: string) {
    if (!section.body?.trim()) {
      if (value.startsWith('## ')) {
        updateNotebookBlock(section.id, changeCaseFileBlockType({ ...section, body: value.slice(3) }, 'section-heading'));
        return;
      }

      if (value.startsWith('- ')) {
        updateNotebookBlock(section.id, changeCaseFileBlockType({ ...section, body: value.slice(2) }, 'bulleted-list'));
        return;
      }

      if (value.startsWith('1. ')) {
        updateNotebookBlock(section.id, changeCaseFileBlockType({ ...section, body: value.slice(3) }, 'numbered-list'));
        return;
      }

      if (value.startsWith('> ')) {
        updateNotebookBlock(section.id, changeCaseFileBlockType({ ...section, body: value.slice(2) }, 'quote'));
        return;
      }

      if (value.trim() === '---') {
        updateNotebookBlock(section.id, changeCaseFileBlockType({ ...section, body: '' }, 'divider'));
        return;
      }
    }

    updateSectionBody(section.id, value);
  }

  function handleNotebookKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    section: DossierSection,
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addNotebookBlock('paragraph', section.id);
      return;
    }

    if (event.key === 'Backspace' && !section.body?.trim() && caseFileSections.length > 1) {
      event.preventDefault();
      deleteNotebookBlock(section);
    }
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
          {listItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    if (blockType === 'numbered-list') {
      return (
        <ol key={section.id} className="case-file-block case-file-block--list">
          {listItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    }

    if (blockType === 'quote') {
      return (
        <blockquote key={section.id} className="case-file-block case-file-block--quote">
          {body}
        </blockquote>
      );
    }

    if (blockType === 'divider') {
      return <hr key={section.id} className="case-file-block case-file-block--divider" />;
    }

    return (
      <section key={section.id} className="case-file-block case-file-block--legacy">
        {shouldShowLegacyHeading ? <h3>{section.title}</h3> : null}
        <p>{body}</p>
      </section>
    );
  }

  function renderCaseFileBlockEditor(section: DossierSection, index: number) {
    const blockType = getCaseFileBlockType(section) ?? 'paragraph';
    const blockLabel = getCaseFileBlockLabel(blockType);
    const isDragged = draggedSectionId === section.id;
    const contentLabel = `${blockLabel} content`;
    const isStructuredBlock = isStructuredCaseFileBlock(section);
    const isActive = activeBlockId === section.id;

    return (
      <article
        key={section.id}
        className={[
          'case-file-editor-block',
          `case-file-editor-block--${blockType}`,
          isDragged ? 'case-file-editor-block--dragging' : '',
          isActive ? 'case-file-editor-block--active' : '',
        ].filter(Boolean).join(' ')}
        draggable
        onDragStart={() => setDraggedSectionId(section.id)}
        onDragEnd={() => setDraggedSectionId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();

          if (draggedSectionId) {
            reorderNotebookBlock(draggedSectionId, section.id);
          }
        }}
        onFocusCapture={() => setActiveBlockId(section.id)}
        onMouseDown={() => setActiveBlockId(section.id)}
      >
        <div className="case-file-editor-block__rail">
          <button
            type="button"
            className="case-file-editor-block__drag"
            aria-label={`Drag ${blockLabel}`}
            title="Drag to reorder"
          >
            Move
          </button>
        </div>

        <div className="case-file-editor-block__content">
          {!isStructuredBlock ? (
            <label className="case-file-editor-block__field case-file-editor-block__field--title">
              <span>Section Heading</span>
              <input
                data-case-file-block-id={`${section.id}-title`}
                value={section.title}
                onChange={(event) => updateNotebookBlock(section.id, { title: event.target.value })}
              />
            </label>
          ) : null}

          {blockType === 'divider' ? (
            <hr className="case-file-block case-file-block--divider" />
          ) : blockType === 'section-heading' ? (
            <label className="case-file-editor-block__field">
              <span>{contentLabel}</span>
              <input
                data-case-file-block-id={section.id}
                value={section.body ?? ''}
                placeholder="Section heading"
                onChange={(event) => updateSectionBody(section.id, event.target.value)}
                onKeyDown={(event) => handleNotebookKeyDown(event, section)}
              />
            </label>
          ) : (
            <label className="case-file-editor-block__field">
              <span>{contentLabel}</span>
              <ThreadmarkAuthoringTextarea
                rows={blockType === 'quote' ? 3 : 4}
                value={section.body ?? ''}
                dossier={workingDossier}
                sectionId={section.id}
                dossiers={dossiers}
                placeholder="Begin documenting..."
                blockId={section.id}
                className="case-file-editor-block__textarea"
                onKeyDown={(event) => handleNotebookKeyDown(event, section)}
                onChange={(value) => handleNotebookInput(section, value)}
              />
            </label>
          )}
        </div>

        <details className="dossier-section-actions case-file-editor-block__actions">
          <summary aria-label={`More actions for ${blockLabel}`}>
            More Actions
          </summary>
          <div>
            <span>Change Block Type</span>
            {caseFileBlockOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => changeNotebookBlock(section, option.type)}
                disabled={option.type === blockType}
              >
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => addNotebookBlock('paragraph', section.id)}>
              Add Paragraph Below
            </button>
            <button type="button" onClick={() => duplicateNotebookBlock(section)}>
              Duplicate
            </button>
            <button type="button" onClick={() => moveNotebookBlock(section.id, -1)} disabled={index === 0}>
              Move Up
            </button>
            <button
              type="button"
              onClick={() => moveNotebookBlock(section.id, 1)}
              disabled={index === caseFileSections.length - 1}
            >
              Move Down
            </button>
            <button type="button" className="danger-button" onClick={() => deleteNotebookBlock(section)}>
              Delete
            </button>
          </div>
        </details>
      </article>
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
            {isEditingSections ? (
              <details
                className="case-file-insert-menu"
                open={isInsertMenuOpen}
                onToggle={(event) => setIsInsertMenuOpen(event.currentTarget.open)}
              >
                <summary aria-label="Add Case File block">Add Block</summary>
                <div>
                  {caseFileBlockOptions.map((option) => (
                    <button key={option.type} type="button" onClick={() => addNotebookBlock(option.type)}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <section className="case-file-canvas" aria-labelledby="case-file-canvas-title">
            <div className="case-file-canvas__header">
              <h3 id="case-file-canvas-title">Case File</h3>
            </div>

            {isEditingSections ? (
              <div
                className="case-file-editor"
                aria-label="Case File authoring canvas"
                onClick={(event) => {
                  if (event.currentTarget !== event.target) {
                    return;
                  }

                  const firstBlock = caseFileSections[0];

                  if (firstBlock) {
                    pendingBlockFocusIdRef.current = firstBlock.id;
                    setActiveBlockId(firstBlock.id);
                    focusNotebookBlock(firstBlock.id);
                    return;
                  }

                  addNotebookBlock('paragraph');
                }}
              >
                {caseFileSections.map((section, index) => renderCaseFileBlockEditor(section, index))}
              </div>
            ) : caseFileSections.length > 0 ? (
              <div className="case-file-reader">
                {caseFileSections.map((section) => renderCaseFileBlockView(section))}
              </div>
            ) : (
              <p className="dossier-reveal__empty">No Evidence Collected</p>
            )}
          </section>

          <section className="dossier-reveal__section dossier-bonds">
            <div className="dossier-bonds__header">
              <h3>Bonds</h3>
              {isEditingSections ? (
                <Button type="button" variant="plaque" onClick={() => setIsCreatingBond(true)}>
                  Add Bond
                </Button>
              ) : null}
            </div>
            {isEditingSections ? (
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
                      {workingDossier.name}: {quickDefinition.sourceLabel} - {quickTargetDossier.name}
                    </span>
                    <span>
                      {quickTargetDossier.name}:{' '}
                      {quickDefinition.behavior === 'Directional'
                        ? `Connected through ${quickDefinition.sourceLabel}`
                        : (quickDefinition.targetLabel ?? quickDefinition.sourceLabel)}{' '}
                      - {workingDossier.name}
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
            ) : null}

            {dossierBonds.length > 0 ? (
              <ul className="dossier-bonds__list" aria-label={`${workingDossier.name} Bonds`}>
                {dossierBonds.map((bond) => {
                  const connectedDossier = getConnectedDossier(bond, workingDossier.id, dossiers);
                  const label = getBondLabelFromPerspective(bond, workingDossier.id);
                  const evidenceCount = getBondEvidenceCount(bond);
                  const isGeneratedBond = isThreadmarkGeneratedBond(bond);

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
                      {isEditingSections && !isGeneratedBond ? (
                        <div className="dossier-bonds__actions">
                          <button
                            type="button"
                            onClick={() => setEditingBond(bond)}
                            aria-label={`Edit Bond with ${connectedDossier?.name ?? 'missing Dossier'}`}
                          >
                            Edit Bond
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => setDeletingBond(bond)}
                            aria-label={`Remove Bond between ${workingDossier.name} and ${connectedDossier?.name ?? 'missing Dossier'}`}
                          >
                            Remove Bond
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="dossier-reveal__empty">No Bonds recorded.</p>
            )}
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

      {isCreatingBond ? (
        <BondFormDialog
          dossiers={dossiers}
          initialSourceDossierId={workingDossier.id}
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
