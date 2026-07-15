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
import type {
  Dossier,
  DossierFormValues,
  DossierSection,
  DossierSectionKind,
  DossierType,
} from '../types/dossierTypes';
import { dossierTypeLabels, dossierTypes } from '../types/dossierTypes';
import {
  getBondLabelFromPerspective,
  getConnectedDossier,
} from '../utils/bondLabels';
import {
  builtInSectionTemplates,
  createSectionFromTemplate,
  dossierToFormValues,
  duplicateSection,
  ensureDossierSections,
  getSectionCapabilities,
  normalizeSectionOrder,
  readCustomSectionTemplates,
  saveCustomSectionTemplate,
  type SectionTemplate,
} from '../utils/dossierSections';
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

function getBondEvidenceCount(bond: Bond) {
  return bond.evidence
    ? Object.values(bond.evidence).filter((value) => value?.trim()).length
    : 0;
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
  const { dossiers, createNewDossier, updateExistingDossier } = useDossiers();
  const {
    bonds,
    bondsForDossier,
    createNewBond,
    updateExistingBond,
    deleteExistingBond,
  } = useBonds();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const [workingDossier, setWorkingDossier] = useState(dossier);
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
  const [availableCustomTemplates, setAvailableCustomTemplates] = useState<SectionTemplate[]>(
    readCustomSectionTemplates,
  );
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [draftSections, setDraftSections] = useState<DossierSection[]>([]);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState('');
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [customSectionKind, setCustomSectionKind] = useState<DossierSectionKind>('custom');
  const [customSectionReusable, setCustomSectionReusable] = useState(true);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [removingSection, setRemovingSection] = useState<DossierSection | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | undefined>();
  const sections = useMemo(() => ensureDossierSections(workingDossier), [workingDossier]);
  const visibleSections = isEditingSections ? draftSections : sections;
  const sectionKindOptions: Array<{ value: DossierSectionKind; label: string }> = [
    { value: 'custom', label: 'Freeform Notes' },
    { value: 'overview', label: 'Overview' },
    { value: 'notes', label: 'Investigation Notes' },
    { value: 'timeline', label: 'Timeline Foundation' },
    { value: 'gallery', label: 'Gallery Foundation' },
    { value: 'evidence', label: 'Evidence Foundation' },
  ];
  const availableSectionTemplates = useMemo(() => {
    const query = sectionSearchQuery.trim().toLocaleLowerCase();

    return [...builtInSectionTemplates, ...availableCustomTemplates].filter((template) => {
      const singletonExists =
        template.isSingleton &&
        draftSections.some((section) => section.templateId === template.id);
      const matchesSearch =
        !query ||
        template.title.toLocaleLowerCase().includes(query) ||
        template.category.toLocaleLowerCase().includes(query);

      return !singletonExists && matchesSearch;
    });
  }, [availableCustomTemplates, draftSections, sectionSearchQuery]);
  const sectionTemplatesByCategory = useMemo(() => {
    const categories = new Map<string, SectionTemplate[]>();

    availableSectionTemplates.forEach((template) => {
      const existingTemplates = categories.get(template.category) ?? [];
      categories.set(template.category, [...existingTemplates, template]);
    });

    return Array.from(categories.entries());
  }, [availableSectionTemplates]);
  const keyFacts = useMemo(
    () => keyFactsForDossier(workingDossier).filter((field) => field.value),
    [workingDossier],
  );
  const dossierBonds = useMemo(
    () =>
      [...bondsForDossier(workingDossier.id)].sort((left, right) => {
        const leftLabel = getBondLabelFromPerspective(left, workingDossier.id);
        const rightLabel = getBondLabelFromPerspective(right, workingDossier.id);
        const leftDossier = getConnectedDossier(left, workingDossier.id, dossiers);
        const rightDossier = getConnectedDossier(right, workingDossier.id, dossiers);

        return `${leftLabel} ${leftDossier?.name ?? ''}`.localeCompare(
          `${rightLabel} ${rightDossier?.name ?? ''}`,
        );
      }),
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
  }, [dossier]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (removingSection) {
          setRemovingSection(null);
          return;
        }

        if (isAddSectionOpen) {
          setIsAddSectionOpen(false);
          return;
        }

        onClose();
        return;
      }

      if (isAddSectionOpen || removingSection) {
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
  }, [isAddSectionOpen, onClose, removingSection]);

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

  async function saveSectionChanges(nextSections: DossierSection[]) {
    const updatedDossier = await updateExistingDossier(workingDossier.id, {
      ...dossierToFormValues(workingDossier),
      sections: normalizeSectionOrder(nextSections),
    });
    setWorkingDossier(updatedDossier);
  }

  function enterSectionEditMode() {
    setDraftSections(sections);
    setIsEditingSections(true);
    setSectionNotice('Editing Dossier');
  }

  async function saveSectionDraft() {
    await saveSectionChanges(draftSections);
    setIsEditingSections(false);
    setIsAddSectionOpen(false);
    setRenamingSectionId(null);
    setRemovingSection(null);
    setSectionNotice('Investigation Updated');
  }

  function cancelSectionDraft() {
    setDraftSections([]);
    setIsEditingSections(false);
    setIsAddSectionOpen(false);
    setRenamingSectionId(null);
    setRemovingSection(null);
    setSectionNotice(undefined);
  }

  function updateDraftSections(nextSections: DossierSection[]) {
    setDraftSections(normalizeSectionOrder(nextSections));
  }

  function updateSectionBody(sectionId: string, body: string) {
    updateDraftSections(
      draftSections.map((section) =>
        section.id === sectionId ? { ...section, body } : section,
      ),
    );
  }

  async function toggleSection(sectionId: string) {
    const sourceSections = isEditingSections ? draftSections : sections;
    const nextSections = sourceSections.map((section) =>
        section.id === sectionId ? { ...section, isCollapsed: !section.isCollapsed } : section,
    );

    if (isEditingSections) {
      updateDraftSections(nextSections);
      return;
    }

    await saveSectionChanges(nextSections);
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const currentIndex = draftSections.findIndex((section) => section.id === sectionId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= draftSections.length) {
      return;
    }

    const nextSections = [...draftSections];
    const [section] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, section);
    updateDraftSections(nextSections);
  }

  function addSection(template: SectionTemplate) {
    const singletonExists =
      template.isSingleton && draftSections.some((section) => section.templateId === template.id);

    if (singletonExists) {
      setSectionNotice(`${template.title} already exists in this Dossier.`);
      return;
    }

    updateDraftSections([...draftSections, createSectionFromTemplate(template, draftSections.length)]);
    setIsAddSectionOpen(false);
    setSectionNotice(`${template.title} added`);
  }

  function addCustomSection() {
    const title = customSectionTitle.trim();

    if (!title || title.length > 80) {
      setSectionNotice('Name the custom Section before adding it.');
      return;
    }

    const template = customSectionReusable
      ? saveCustomSectionTemplate(title, customSectionKind)
      : {
          id: `custom-${crypto.randomUUID()}`,
          title,
          kind: customSectionKind,
          isSingleton: false,
          category: 'Custom',
          isRenameable: true,
          isDuplicable: true,
        };

    if (customSectionReusable) {
      setAvailableCustomTemplates(readCustomSectionTemplates());
    }

    setCustomSectionTitle('');
    setCustomSectionKind('custom');
    addSection(template);
  }

  function startRenameSection(section: DossierSection) {
    setRenamingSectionId(section.id);
    setRenameValue(section.title);
  }

  function applySectionRename(section: DossierSection) {
    const title = renameValue.trim();

    if (!title || title.length > 80) {
      setSectionNotice('Section names must be between 1 and 80 characters.');
      return;
    }

    updateDraftSections(
      draftSections.map((candidate) =>
        candidate.id === section.id ? { ...candidate, title } : candidate,
      ),
    );
    setRenamingSectionId(null);
    setRenameValue('');
    setSectionNotice(`${title} renamed`);
  }

  function duplicateDraftSection(section: DossierSection) {
    const capabilities = getSectionCapabilities(section);

    if (!capabilities.canDuplicate) {
      setSectionNotice(`${section.title} cannot be duplicated.`);
      return;
    }

    const index = draftSections.findIndex((candidate) => candidate.id === section.id);
    const nextSections = [...draftSections];
    nextSections.splice(index + 1, 0, duplicateSection(section));
    updateDraftSections(nextSections);
    setSectionNotice(`${section.title} duplicated`);
  }

  function confirmRemoveSection() {
    if (!removingSection) {
      return;
    }

    updateDraftSections(draftSections.filter((section) => section.id !== removingSection.id));
    setSectionNotice(`${removingSection.title} removed from draft`);
    setRemovingSection(null);
  }

  function renderSectionBody(section: DossierSection) {
    if (section.kind === 'identity') {
      return section.fields?.length ? (
        <dl className="dossier-reveal__facts" aria-label={`${section.title} facts`}>
          {section.fields.map((field) => (
            <div key={field.id}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="dossier-reveal__empty">No identity facts have been recorded.</p>
      );
    }

    if (section.kind === 'relationships') {
      return (
        <p className="dossier-reveal__empty">
          {dossierBonds.length
            ? `${dossierBonds.length} Bonds are connected to this Dossier.`
            : 'No Bonds have been recorded.'}
        </p>
      );
    }

    if (section.kind === 'timeline') {
      return <p className="dossier-reveal__empty">Timeline Sections are reserved for a future LoreBound update.</p>;
    }

    if (section.kind === 'gallery') {
      return <p className="dossier-reveal__empty">Gallery Sections are reserved for a future LoreBound update.</p>;
    }

    if (section.kind === 'evidence') {
      return <p className="dossier-reveal__empty">Evidence Sections are reserved for a future LoreBound update.</p>;
    }

    if (isEditingSections && ['custom', 'overview', 'notes'].includes(section.kind)) {
      return (
        <label className="dossier-dynamic-section__body-editor">
          Section Notes
          <textarea
            rows={4}
            value={section.body ?? ''}
            onChange={(event) => updateSectionBody(section.id, event.target.value)}
          />
        </label>
      );
    }

    return section.body ? <p>{section.body}</p> : <p className="dossier-reveal__empty">No entries recorded.</p>;
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
            <h2 id="dossier-sheet-title">{workingDossier.name}</h2>
          </header>

          <div
            className={
              hasImage
                ? `dossier-reveal__lead dossier-reveal__lead--${workingDossier.dossierType.toLowerCase()}`
                : 'dossier-reveal__lead dossier-reveal__lead--no-image'
            }
          >
            {workingDossier.coverImage ? (
              <figure className="dossier-reveal__photo">
                <img src={workingDossier.coverImage} alt={`${workingDossier.name} cover`} />
              </figure>
            ) : (
              <div className="dossier-reveal__photo dossier-reveal__photo--empty">
                <span>{workingDossier.dossierType.slice(0, 2)}</span>
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

          <div className="dossier-section-toolbar">
            <div>
              <span>{visibleSections.length} Sections</span>
              {sectionNotice ? <p role="status">{sectionNotice}</p> : null}
            </div>
            {isEditingSections ? (
              <Button type="button" variant="plaque" onClick={() => setIsAddSectionOpen(true)}>
                Add Section
              </Button>
            ) : null}
          </div>

          {visibleSections.map((section, index) => {
            const capabilities = getSectionCapabilities(section);
            const isRenaming = renamingSectionId === section.id;

            return (
            <section key={section.id} className="dossier-reveal__section dossier-dynamic-section">
              <div className="dossier-dynamic-section__header">
                <button
                  type="button"
                  className="dossier-dynamic-section__toggle"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!section.isCollapsed}
                >
                  <h3>{section.title}</h3>
                </button>
                {isEditingSections ? (
                  <details className="dossier-section-actions">
                    <summary aria-label={`More actions for ${section.title}`}>
                      More Actions
                    </summary>
                    <div>
                      {capabilities.canRename ? (
                        <button type="button" onClick={() => startRenameSection(section)}>
                          Rename Section
                        </button>
                      ) : null}
                      {capabilities.canDuplicate ? (
                        <button type="button" onClick={() => duplicateDraftSection(section)}>
                          Duplicate Section
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => moveSection(section.id, -1)}
                        disabled={index === 0}
                      >
                        Move Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(section.id, 1)}
                        disabled={index === visibleSections.length - 1}
                      >
                        Move Down
                      </button>
                      {capabilities.canRemove ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => setRemovingSection(section)}
                        >
                          Remove Section
                        </button>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
              {isRenaming ? (
                <div className="dossier-section-rename">
                  <label>
                    Section Name
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={() => applySectionRename(section)}>
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingSectionId(null);
                      setRenameValue('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {!section.isCollapsed ? renderSectionBody(section) : null}
            </section>
            );
          })}

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
                      {isEditingSections ? (
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
                <Button type="button" variant="plaque" onClick={() => onEdit(workingDossier)}>
                  Edit Details
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

      {isAddSectionOpen && isEditingSections ? (
        <div className="case-dialog-backdrop" role="presentation">
          <section
            className="case-dialog case-dialog--section-library"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-section-title"
          >
            <header className="case-dialog__header">
              <div>
                <p>Dossier Edit Mode</p>
                <h2 id="add-section-title">Add Section</h2>
              </div>
              <Button type="button" variant="ghost" onClick={() => setIsAddSectionOpen(false)}>
                Close
              </Button>
            </header>

            <label className="case-form__field">
              Search Section Library
              <input
                value={sectionSearchQuery}
                onChange={(event) => setSectionSearchQuery(event.target.value)}
                placeholder="Identity, Timeline, Quotes"
              />
            </label>

            <div className="dossier-section-library">
              {sectionTemplatesByCategory.length > 0 ? (
                sectionTemplatesByCategory.map(([category, templates]) => (
                  <section key={category} className="dossier-section-library__category">
                    <div className="dossier-section-library__header">
                      <h3>{category}</h3>
                      <span>{templates.length} available</span>
                    </div>
                    <div className="dossier-section-library__actions">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => addSection(template)}
                        >
                          Add {template.title}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="dossier-reveal__empty">No matching Sections found.</p>
              )}
            </div>

            <section className="dossier-section-library__custom" aria-labelledby="custom-section-title">
              <h3 id="custom-section-title">Custom Section</h3>
              <label>
                Section Name
                <input
                  value={customSectionTitle}
                  onChange={(event) => setCustomSectionTitle(event.target.value)}
                  placeholder="Field Notes"
                />
              </label>
              <label>
                Section Type
                <select
                  value={customSectionKind}
                  onChange={(event) => setCustomSectionKind(event.target.value as DossierSectionKind)}
                >
                  {sectionKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dossier-section-library__check">
                <input
                  type="checkbox"
                  checked={customSectionReusable}
                  onChange={(event) => setCustomSectionReusable(event.target.checked)}
                />
                Save as reusable Section
              </label>
              <Button type="button" variant="brass" onClick={addCustomSection}>
                Add Custom Section
              </Button>
            </section>
          </section>
        </div>
      ) : null}

      {removingSection ? (
        <div className="case-dialog-backdrop" role="presentation">
          <section
            className="case-dialog case-dialog--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-section-title"
          >
            <header className="case-dialog__header">
              <div>
                <p>Remove Section</p>
                <h2 id="remove-section-title">{removingSection.title}</h2>
              </div>
            </header>
            <p className="case-dialog__copy">
              This removes the Section from the draft Dossier. Save Changes is still required to make it permanent.
            </p>
            <div className="case-dialog__actions">
              <Button type="button" variant="ghost" onClick={() => setRemovingSection(null)}>
                Cancel
              </Button>
              <button type="button" className="danger-button" onClick={confirmRemoveSection}>
                Remove Section
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
