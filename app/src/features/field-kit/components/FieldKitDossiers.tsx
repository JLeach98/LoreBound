import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { createStableId } from '../../../lib/stableId';
import {
  isThreadmarkGeneratedBond,
  ThreadmarkAuthoringTextarea,
} from '../../threadmarks';
import { BondFormDialog } from '../../cases/components/BondFormDialog';
import { DossierSheet } from '../../cases/components/DossierSheet';
import { useBonds } from '../../cases/context/BondContext';
import { useBoard } from '../../cases/context/BoardContext';
import { useCases } from '../../cases/context/CaseContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { Bond, BondFormValues } from '../../cases/types/bondTypes';
import type {
  Dossier,
  DossierSection,
  DossierSectionKind,
  DossierType,
} from '../../cases/types/dossierTypes';
import { syncService } from '../../../services/sync/SyncService';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import type { SyncPlan } from '../../../services/sync/SyncTypes';
import { evidenceRecordRepository } from '../../../repositories/EvidenceRecordRepository';
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
import {
  builtInSectionTemplates,
  createDefaultDossierSections,
  createSectionFromTemplate,
  dossierToFormValues,
  duplicateSection,
  ensureDossierSections,
  getSectionCapabilities,
  normalizeSectionOrder,
  readCustomSectionTemplates,
  saveCustomSectionTemplate,
  type SectionTemplate,
} from '../../cases/utils/dossierSections';
import {
  fieldKitDossierPluralLabels,
  fieldKitDossierTypes,
  formatShortDate,
  getBondLabel,
  getDossierTypeFromKnowledgeType,
  getDossierSecondaryLine,
  getKnowledgeTypeConfig,
  hasKnowledgeTypeConfig,
  normalizeKnowledgeType,
} from '../utils/fieldKitFormat';
import { FieldKitThumbnail } from './FieldKitThumbnail';

type FieldKitDossiersProps = {
  initialType?: DossierType;
  initialDossierId?: string;
  initialCreateType?: DossierType | null;
  onInitialCreateConsumed?: () => void;
  onReturnToFieldKit?: () => void;
};

type DossierEditorState =
  | { mode: 'create'; dossierType: DossierType }
  | { mode: 'edit'; dossier: Dossier }
  | null;

type FieldKitDossierErrorBoundaryProps = {
  children: ReactNode;
  onReturn: () => void;
};

type FieldKitDossierErrorBoundaryState = {
  error: Error | null;
  failureCategory: string;
};

class FieldKitDossierErrorBoundary extends Component<
  FieldKitDossierErrorBoundaryProps,
  FieldKitDossierErrorBoundaryState
> {
  state: FieldKitDossierErrorBoundaryState = {
    error: null,
    failureCategory: 'None',
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
      failureCategory: error.name || 'Renderer failure',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const operationsConsoleUnlocked =
      window.localStorage.getItem('operationsConsoleUnlocked') === 'true';

    recordFieldKitRuntimeFailure(error, 'FieldKitDossierErrorBoundary');

    if (operationsConsoleUnlocked) {
      window.localStorage.setItem(
        fieldKitDossierDiagnosticsKey,
        JSON.stringify({
          ...readFieldKitDiagnostics(),
          safeComponentTrace: info.componentStack?.split('\n').slice(0, 4).join(' / '),
        }),
      );
    }
  }

  retry = () => {
    this.setState({ error: null, failureCategory: 'None' });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const operationsConsoleUnlocked =
      window.localStorage.getItem('operationsConsoleUnlocked') === 'true';

    return (
      <section className="field-kit-panel field-kit-dossier-error" aria-labelledby="field-kit-dossier-error-title">
        <h2 id="field-kit-dossier-error-title">Unable to Open Dossier</h2>
        <p>LoreBound could not display this Dossier.</p>
        <p>Your Local Archive remains unchanged.</p>
        {operationsConsoleUnlocked ? (
          <dl className="settings-compact-list">
            <div>
              <dt>Failure category</dt>
              <dd>{this.state.failureCategory}</dd>
            </div>
          </dl>
        ) : null}
        <div className="field-kit-dossier-actions">
          <Button type="button" variant="brass" onClick={this.props.onReturn}>
            Return to Dossiers
          </Button>
          <Button type="button" variant="secondary" onClick={this.retry}>
            Retry
          </Button>
        </div>
      </section>
    );
  }
}

type FieldKitDossierDiagnostics = {
  renderer: 'Field Kit';
  sharedSectionCount: number;
  sectionTypesReceived: string[];
  unsupportedSectionRendererCount: number;
  legacyCompatibilityMappingUsed: boolean;
  currentDossierEditMode: boolean;
  draftSectionCount: number;
  persistedSectionCount: number;
  lastFieldKitDossierSaveStatus: string;
  synchronizationDetectedMobileChange: boolean;
  selectedDossierIdPresent?: boolean;
  selectedDossierFound?: boolean;
  sectionCollectionValid?: boolean;
  activeFilter?: string;
  canonicalFilterKey?: string;
  filterDossierCount?: number;
  malformedTypeCount?: number;
  selectedDossierType?: string;
  typeConfigurationFound?: boolean;
  specializedRendererFound?: boolean;
  genericFallbackUsed?: boolean;
  characterOnlyAccessorDetected?: boolean;
};

const fieldKitDossierDiagnosticsKey = 'lorebound:field-kit-dossier-diagnostics';

function writeFieldKitDossierDiagnostics(diagnostics: FieldKitDossierDiagnostics) {
  window.localStorage.setItem(fieldKitDossierDiagnosticsKey, JSON.stringify(diagnostics));
}

function readFieldKitDiagnostics() {
  try {
    return JSON.parse(window.localStorage.getItem(fieldKitDossierDiagnosticsKey) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sanitizeRuntimeMessage(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? 'Unknown runtime error');

  return message
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
    .slice(0, 240);
}

export function recordFieldKitRuntimeFailure(error: unknown, componentName: string) {
  window.localStorage.setItem(
    fieldKitDossierDiagnosticsKey,
    JSON.stringify({
      ...readFieldKitDiagnostics(),
      renderer: 'Field Kit',
      fieldKitDossierRenderFailureCategory:
        error instanceof Error ? error.name || 'Runtime error' : 'Runtime error',
      sanitizedRuntimeErrorMessage: sanitizeRuntimeMessage(error),
      sanitizedComponentName: componentName,
      errorBoundaryTriggered: componentName === 'FieldKitDossierErrorBoundary',
    }),
  );
}

function isUsableDossier(value: unknown): value is Dossier {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Dossier>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.caseId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.dossierType === 'string'
  );
}

type DossierRowBoundaryProps = {
  children: ReactNode;
  dossierName: string;
};

type DossierRowBoundaryState = {
  error: Error | null;
};

class DossierRowBoundary extends Component<DossierRowBoundaryProps, DossierRowBoundaryState> {
  state: DossierRowBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    recordFieldKitRuntimeFailure(error, 'FieldKitDossierRow');
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="field-kit-record field-kit-record--warning">
        <FieldKitThumbnail name="Dossier Unable to Load" />
        <span>
          <strong>Dossier Unable to Load</strong>
          <small>{this.props.dossierName}</small>
          <em>This record could not be displayed safely.</em>
        </span>
      </div>
    );
  }
}

type FieldKitDossierRowProps = {
  dossier: Dossier;
  onOpen: (dossier: Dossier) => void;
  getBondCount: (dossierId: string) => number;
};

function FieldKitDossierRow({ dossier, onOpen, getBondCount }: FieldKitDossierRowProps) {
  const typeConfig = getKnowledgeTypeConfig(dossier.dossierType);
  const secondaryLine = getDossierSecondaryLine(dossier);
  const bondCount = getBondCount(dossier.id);

  return (
    <button
      type="button"
      className="field-kit-record field-kit-record--button"
      aria-label={`Open ${dossier.name}, ${typeConfig.singularLabel}`}
      onClick={() => onOpen(dossier)}
    >
      <FieldKitThumbnail image={dossier.coverImage} name={dossier.name} />
      <span>
        <strong>{dossier.name}</strong>
        <small>{typeConfig.singularLabel}</small>
        <em>
          {secondaryLine}
          {` / ${bondCount} Bonds`}
        </em>
      </span>
    </button>
  );
}

function canRecordBondFromEvidence(record: EvidenceRecord) {
  return typeof record.metadata.relationshipKey === 'string' &&
    Boolean(threadmarkKeyToBondType(record.metadata.relationshipKey));
}

export function FieldKitDossiers({
  initialType = 'Character',
  initialDossierId,
  initialCreateType,
  onInitialCreateConsumed,
  onReturnToFieldKit,
}: FieldKitDossiersProps) {
  const { activeCase } = useCases();
  const { dossiers, updateExistingDossier, deleteExistingDossier, refreshDossiers } = useDossiers();
  const {
    createNewBond,
    refreshBonds,
    bondsForDossier,
  } = useBonds();
  const { isDossierPinned, pinDossier, removeDossierFromBoard } = useBoard();
  const [activeType, setActiveType] = useState<DossierType>(
    getDossierTypeFromKnowledgeType(initialType) ?? 'Character',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [highlightedEvidenceRecordId, setHighlightedEvidenceRecordId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<DossierEditorState>(null);
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [deletingDossier, setDeletingDossier] = useState<Dossier | null>(null);
  const [creatingBondFromEvidence, setCreatingBondFromEvidence] = useState<{
    dossier: Dossier;
    entry: EvidenceLogEntry;
  } | null>(null);
  const [repairPlan, setRepairPlan] = useState<SyncPlan | null>(null);
  const [repairState, setRepairState] = useState<'idle' | 'working' | 'failed'>('idle');
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const safeDossiers = useMemo(() => (Array.isArray(dossiers) ? dossiers.filter(isUsableDossier) : []), [dossiers]);
  const malformedDossierCount = Array.isArray(dossiers) ? dossiers.length - safeDossiers.length : 0;

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      recordFieldKitRuntimeFailure(event.error ?? event.message, 'FieldKitDossiers');
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      recordFieldKitRuntimeFailure(event.reason, 'FieldKitDossiers');
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function reviewRepairState() {
      try {
        const planResult = await syncService.createPlan();

        if (isMounted) {
          setRepairPlan(planResult.plan);
        }
      } catch {
        if (isMounted) {
          setRepairPlan(null);
        }
      }
    }

    if (activeCase && safeDossiers.length === 0) {
      void reviewRepairState();
    }

    return () => {
      isMounted = false;
    };
  }, [activeCase, safeDossiers.length]);

  async function refreshEvidenceRecords(caseId = activeCase?.id) {
    if (!caseId) {
      setEvidenceRecords([]);
      return;
    }

    setEvidenceRecords(await evidenceRecordRepository.listByCase(caseId));
  }

  useEffect(() => {
    void refreshEvidenceRecords(activeCase?.id);
  }, [activeCase?.id]);

  useEffect(() => {
    if (!initialDossierId) {
      return;
    }

    const dossier = safeDossiers.find((candidate) => candidate.id === initialDossierId);

    if (dossier) {
      setActiveType(getDossierTypeFromKnowledgeType(dossier.dossierType) ?? initialType);
      setSelectedDossier(dossier);
    }
  }, [safeDossiers, initialDossierId]);

  useEffect(() => {
    if (!initialCreateType) {
      return;
    }

    setActiveType(initialCreateType);
    setSelectedDossier(null);
    setIsEditingDossier(false);
    setEditorState({ mode: 'create', dossierType: initialCreateType });
    onInitialCreateConsumed?.();
  }, [initialCreateType, onInitialCreateConsumed]);

  useEffect(() => {
    if (!selectedDossier) {
      return;
    }

    const refreshedDossier = safeDossiers.find((candidate) => candidate.id === selectedDossier.id);

    if (refreshedDossier && refreshedDossier !== selectedDossier) {
      setSelectedDossier(refreshedDossier);
    }
  }, [safeDossiers, selectedDossier]);

  const filteredDossiers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const activeCanonicalType = normalizeKnowledgeType(activeType);

    return safeDossiers.filter((dossier) => {
      const matchesType = normalizeKnowledgeType(dossier.dossierType) === activeCanonicalType;
      const matchesSearch = !query || dossier.name.toLocaleLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [activeType, safeDossiers, searchQuery]);
  const selectedDossierFound = selectedDossier
    ? safeDossiers.some((candidate) => candidate.id === selectedDossier.id)
    : false;
  const isPartialArchive =
    repairPlan?.diagnostics.archiveState.classification === 'Partial Local Archive' && safeDossiers.length === 0;
  const activeTypeConfig = getKnowledgeTypeConfig(activeType);

  useEffect(() => {
    writeFieldKitDossierDiagnostics({
      renderer: 'Field Kit',
      sharedSectionCount: 0,
      sectionTypesReceived: [],
      unsupportedSectionRendererCount: 0,
      legacyCompatibilityMappingUsed: false,
      currentDossierEditMode: false,
      draftSectionCount: 0,
      persistedSectionCount: 0,
      lastFieldKitDossierSaveStatus: 'List rendered',
      synchronizationDetectedMobileChange: false,
      selectedDossierIdPresent: Boolean(selectedDossier?.id),
      selectedDossierFound: selectedDossier ? selectedDossierFound : false,
      sectionCollectionValid: true,
      activeFilter: activeType,
      canonicalFilterKey: normalizeKnowledgeType(activeType),
      filterDossierCount: filteredDossiers.length,
      malformedTypeCount: safeDossiers.filter((dossier) => !hasKnowledgeTypeConfig(dossier.dossierType)).length,
      selectedDossierType: selectedDossier?.dossierType,
      typeConfigurationFound: selectedDossier ? hasKnowledgeTypeConfig(selectedDossier.dossierType) : true,
      specializedRendererFound: selectedDossier ? hasKnowledgeTypeConfig(selectedDossier.dossierType) : true,
      genericFallbackUsed: selectedDossier ? !hasKnowledgeTypeConfig(selectedDossier.dossierType) : false,
      characterOnlyAccessorDetected: false,
    });
  }, [activeType, filteredDossiers.length, selectedDossier, selectedDossierFound]);

  async function handleRepairLocalArchive() {
    setRepairState('working');
    setRepairMessage(null);

    const result = await syncService.retrieve();

    if (!result.ok) {
      setRepairState('failed');
      setRepairMessage(result.failedStage ? `${result.failedStage}: ${result.message}` : result.message);
      return;
    }

    setRepairState('idle');
    setRepairMessage(result.message);
    await refreshDossiers();
  }

  function createDraftDossier(type: DossierType): Dossier {
    const now = new Date().toISOString();
    const draftValues = {
      dossierType: type,
      name: '',
    };

    return {
      id: `field-kit-draft-${type.toLocaleLowerCase()}`,
      caseId: '',
      dossierType: type,
      name: '',
      dateCreated: now,
      dateModified: now,
      sections: createDefaultDossierSections(draftValues),
    };
  }

  function handleCanonicalDossierSaved(dossier: Dossier) {
    setSelectedDossier(dossier);
    setIsEditingDossier(false);
  }

  async function handleDeleteDossier() {
    if (!deletingDossier) {
      return;
    }

    await deleteExistingDossier(deletingDossier.id);
    setSelectedDossier((current) => (current?.id === deletingDossier.id ? null : current));
    setDeletingDossier(null);
  }

  async function handleCreateBondFromEvidence(values: BondFormValues) {
    await createNewBond(values);
    setCreatingBondFromEvidence(null);
    await refreshBonds();
  }

  async function handleSaveSections(dossier: Dossier, sections: DossierSection[]) {
    const previousSections = ensureDossierSections(dossier);
    const normalizedSections = normalizeSectionOrder(sections);
    const updatedDossier = await updateExistingDossier(dossier.id, {
      ...dossierToFormValues(dossier),
      sections: normalizedSections,
    });
    const now = new Date().toISOString();
    const recordsForDossier = await evidenceRecordRepository.listByOriginDossier(dossier.id);
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
      dossiers: safeDossiers,
      updatedAt: now,
      createId: () => createStableId('evidence'),
    });

    await Promise.all(createdThreadmarkRecords.map((record) => evidenceRecordRepository.create(record)));
    setSelectedDossier(updatedDossier);
    await refreshEvidenceRecords(updatedDossier.caseId);
    await refreshBonds();

    if (createdThreadmarkRecords.length > 0) {
      requestAutomaticSynchronization('threadmark evidence record created');
    }
    return updatedDossier;
  }

  async function handleCreateEvidenceRecord({
    dossier,
    section,
    targetDossier,
    selectionRange,
  }: {
    dossier: Dossier;
    section: DossierSection;
    targetDossier: Dossier;
    selectionRange: { start: number; end: number };
  }) {
    if (targetDossier.caseId !== dossier.caseId) {
      throw new Error('Threadmarks can only reference Dossiers from the active Investigation.');
    }

    const originText = section.body ?? '';
    const selectedText = originText.slice(selectionRange.start, selectionRange.end);

    if (!selectedText.trim()) {
      throw new Error('Select Dossier text before creating a Threadmark.');
    }

    const currentRecords = await evidenceRecordRepository.listByCase(dossier.caseId);
    const incoming = {
      caseId: dossier.caseId,
      originDossierId: dossier.id,
      originSectionId: section.id,
      targetDossierId: targetDossier.id,
      anchorStart: selectionRange.start,
      anchorEnd: selectionRange.end,
    };

    if (hasDuplicateEvidenceRecord(currentRecords, incoming)) {
      throw new Error('This Threadmark already exists.');
    }

    const now = new Date().toISOString();
    await evidenceRecordRepository.create({
      id: createStableId('evidence'),
      ...incoming,
      selectedText,
      anchorContext: createEvidenceAnchorContext(originText, selectionRange.start, selectionRange.end),
      metadata: {},
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await refreshEvidenceRecords(dossier.caseId);
    requestAutomaticSynchronization('threadmark evidence record created');
  }

  async function handleRemoveEvidenceRecord(record: EvidenceRecord) {
    await evidenceRecordRepository.delete(record.id);
    await refreshEvidenceRecords(record.caseId);
    requestAutomaticSynchronization('threadmark evidence record removed');
  }

  if (selectedDossier && !selectedDossierFound) {
    writeFieldKitDossierDiagnostics({
      renderer: 'Field Kit',
      sharedSectionCount: 0,
      sectionTypesReceived: [],
      unsupportedSectionRendererCount: 0,
      legacyCompatibilityMappingUsed: false,
      currentDossierEditMode: false,
      draftSectionCount: 0,
      persistedSectionCount: 0,
      lastFieldKitDossierSaveStatus: 'Dossier Not Available',
      synchronizationDetectedMobileChange: false,
      selectedDossierIdPresent: true,
      selectedDossierFound: false,
      sectionCollectionValid: false,
    });

    return (
      <section className="field-kit-panel field-kit-dossier-error" aria-labelledby="field-kit-dossier-missing-title">
        <h2 id="field-kit-dossier-missing-title">Dossier Not Available</h2>
        <p>This Dossier is not currently stored in this Local Archive.</p>
        <div className="field-kit-dossier-actions">
          <Button
            type="button"
            variant="brass"
            onClick={() => {
              setIsEditingDossier(false);
              setSelectedDossier(null);
            }}
          >
            Return to Dossiers
          </Button>
        </div>
      </section>
    );
  }

  if (selectedDossier) {
    return (
      <FieldKitDossierErrorBoundary
        onReturn={() => {
          setIsEditingDossier(false);
          setSelectedDossier(null);
        }}
      >
        <FieldKitDossierView
          dossier={selectedDossier}
          dossiers={safeDossiers}
          bonds={bondsForDossier(selectedDossier.id)}
          evidenceRecords={evidenceRecords}
          highlightedEvidenceRecordId={highlightedEvidenceRecordId}
          isPinned={isDossierPinned(selectedDossier.id)}
          isEditing={isEditingDossier}
          onBack={() => {
            setIsEditingDossier(false);
            setHighlightedEvidenceRecordId(null);
            setSelectedDossier(null);
          }}
          onOpenDossier={(dossier, options) => {
            setIsEditingDossier(false);
            setSelectedDossier(dossier);
            setHighlightedEvidenceRecordId(options?.evidenceRecordId ?? null);
          }}
          onEnterEdit={() => setIsEditingDossier(true)}
          onDoneEditing={() => setIsEditingDossier(false)}
          onSaveSections={handleSaveSections}
          onEditDetails={() => setEditorState({ mode: 'edit', dossier: selectedDossier })}
          onDelete={() => setDeletingDossier(selectedDossier)}
          onPin={async () => {
            await pinDossier(selectedDossier.id);
          }}
          onUnpin={async () => {
            await removeDossierFromBoard(selectedDossier.id);
          }}
          onCreateBondFromEvidence={(entry) => setCreatingBondFromEvidence({ dossier: selectedDossier, entry })}
          onCreateEvidenceRecord={handleCreateEvidenceRecord}
          onRemoveEvidenceRecord={handleRemoveEvidenceRecord}
        >
          {editorState?.mode === 'edit' ? (
            <DossierSheet
              dossier={editorState.dossier}
              onClose={() => setEditorState(null)}
              onDelete={setDeletingDossier}
              initialEditMode
              isPinned={isDossierPinned(editorState.dossier.id)}
              onRemoveFromBoard={async (dossier) => {
                await removeDossierFromBoard(dossier.id);
              }}
              onOpenDossier={(dossier, options) => {
                setSelectedDossier(dossier);
                setHighlightedEvidenceRecordId(options?.evidenceRecordId ?? null);
              }}
            />
          ) : null}
          {creatingBondFromEvidence ? (
            <BondFormDialog
              dossiers={safeDossiers.filter(
                (candidate) => candidate.caseId === creatingBondFromEvidence.dossier.caseId,
              )}
              initialSourceDossierId={creatingBondFromEvidence.entry.originDossier.id}
              initialTargetDossierId={creatingBondFromEvidence.dossier.id}
              initialEvidenceRecordIds={[creatingBondFromEvidence.entry.record.id]}
              evidenceRecords={evidenceRecords}
              requireEvidenceRecords
              defaultLabelsEmpty
              onCancel={() => setCreatingBondFromEvidence(null)}
              onSubmit={handleCreateBondFromEvidence}
            />
          ) : null}
          {deletingDossier ? (
            <ConfirmPanel
              title="Delete Dossier?"
              message={`${deletingDossier.name} will be removed from this Investigation.`}
              onCancel={() => setDeletingDossier(null)}
              onConfirm={handleDeleteDossier}
              confirmLabel="Delete"
            />
          ) : null}
        </FieldKitDossierView>
      </FieldKitDossierErrorBoundary>
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
            aria-selected={normalizeKnowledgeType(activeType) === normalizeKnowledgeType(type)}
            className={normalizeKnowledgeType(activeType) === normalizeKnowledgeType(type) ? 'field-kit-type-tabs__active' : ''}
            onClick={() => {
              setSelectedDossier(null);
              setIsEditingDossier(false);
              setActiveType(type);
            }}
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
        {malformedDossierCount > 0 ? (
          <div className="field-kit-record field-kit-record--warning">
            <FieldKitThumbnail name="Dossier Unable to Load" />
            <span>
              <strong>Dossier Unable to Load</strong>
              <small>Local Archive record needs review</small>
              <em>{malformedDossierCount} record could not be displayed safely.</em>
            </span>
          </div>
        ) : null}
        {filteredDossiers.map((dossier) => (
          <DossierRowBoundary key={dossier.id} dossierName={dossier.name}>
            <FieldKitDossierRow
              dossier={dossier}
              onOpen={setSelectedDossier}
              getBondCount={(dossierId) => bondsForDossier(dossierId).length}
            />
          </DossierRowBoundary>
        ))}
        {filteredDossiers.length === 0 ? (
          <div className="field-kit-empty">
            {isPartialArchive ? (
              <>
                <h3>No Dossiers Stored Locally</h3>
                <p>LoreBound Online contains Dossiers that have not yet been retrieved to this browser.</p>
                {repairMessage ? <p>{repairMessage}</p> : null}
                <div className="field-kit-inline-actions">
                  <Button
                    type="button"
                    variant="brass"
                    onClick={handleRepairLocalArchive}
                    disabled={repairState === 'working' || !repairPlan?.canRetrieve}
                  >
                    {repairState === 'working' ? 'Repairing Local Archive...' : 'Repair Local Archive'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onReturnToFieldKit ?? (() => setSearchQuery(''))}>
                    Return to Field Kit
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3>No Matching Records Found</h3>
                <p>{`No ${activeTypeConfig.singularLabel} records match this drawer.`}</p>
              </>
            )}
          </div>
        ) : null}
      </div>

      {editorState?.mode === 'create' ? (
        <DossierSheet
          dossier={createDraftDossier(editorState.dossierType)}
          onClose={() => setEditorState(null)}
          onDelete={setDeletingDossier}
          onCreated={handleCanonicalDossierSaved}
          initialEditMode
          isNewDraft
          isPinned={false}
          onOpenDossier={setSelectedDossier}
        />
      ) : null}
    </section>
  );
}

type FieldKitDossierViewProps = {
  dossier: Dossier;
  dossiers: Dossier[];
  bonds: Bond[];
  evidenceRecords: EvidenceRecord[];
  highlightedEvidenceRecordId?: string | null;
  isPinned: boolean;
  isEditing: boolean;
  children: ReactNode;
  onBack: () => void;
  onOpenDossier: (dossier: Dossier, options?: { evidenceRecordId?: string }) => void;
  onEnterEdit: () => void;
  onDoneEditing: () => void;
  onSaveSections: (dossier: Dossier, sections: DossierSection[]) => Promise<Dossier>;
  onEditDetails: () => void;
  onDelete: () => void;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
  onCreateBondFromEvidence: (entry: EvidenceLogEntry) => void;
  onCreateEvidenceRecord: (details: {
    dossier: Dossier;
    section: DossierSection;
    targetDossier: Dossier;
    selectionRange: { start: number; end: number };
  }) => Promise<void>;
  onRemoveEvidenceRecord: (record: EvidenceRecord) => Promise<void>;
};

function FieldKitDossierView({
  dossier,
  dossiers,
  bonds,
  evidenceRecords,
  highlightedEvidenceRecordId,
  isPinned,
  isEditing,
  children,
  onBack,
  onOpenDossier,
  onEnterEdit,
  onDoneEditing,
  onSaveSections,
  onEditDetails,
  onDelete,
  onPin,
  onUnpin,
  onCreateBondFromEvidence,
  onCreateEvidenceRecord,
  onRemoveEvidenceRecord,
}: FieldKitDossierViewProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [draftSections, setDraftSections] = useState<DossierSection[]>([]);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState('');
  const [availableCustomTemplates, setAvailableCustomTemplates] = useState<SectionTemplate[]>(
    readCustomSectionTemplates,
  );
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [customSectionKind, setCustomSectionKind] = useState<DossierSectionKind>('custom');
  const [customSectionReusable, setCustomSectionReusable] = useState(true);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [removingSection, setRemovingSection] = useState<DossierSection | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | undefined>();
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState('Not saved this session');
  const [mobileChangeDetected, setMobileChangeDetected] = useState(false);
  const [activeThreadmarkId, setActiveThreadmarkId] = useState<string | null>(null);
  const [activeEvidenceHighlightId, setActiveEvidenceHighlightId] = useState<string | null>(
    highlightedEvidenceRecordId ?? null,
  );
  const evidenceEntryRefs = useRef(new Map<string, HTMLLIElement>());
  const typeConfig = getKnowledgeTypeConfig(dossier.dossierType);
  const typeConfigurationFound = hasKnowledgeTypeConfig(dossier.dossierType);
  const dossierSections = useMemo(() => ensureDossierSections(dossier), [dossier]);
  const visibleSections = isEditing ? draftSections : dossierSections;
  const visibleContentSections = useMemo(
    () => visibleSections.filter((section) => section.kind !== 'relationships'),
    [visibleSections],
  );
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
  const displayBonds = useMemo(
    () =>
      bonds
        .filter((bond) => {
          if (!isThreadmarkGeneratedBond(bond) || bond.sourceDossierId === dossier.id) {
            return true;
          }

          return !bonds.some(
            (candidate) =>
              isThreadmarkGeneratedBond(candidate) &&
              candidate.threadmark?.ownerId === bond.threadmark?.ownerId &&
              candidate.threadmark?.pairId === bond.threadmark?.pairId &&
              candidate.sourceDossierId === dossier.id,
          );
        })
        .sort((left, right) => {
        const leftDossier = getConnectedDossier(left);
        const rightDossier = getConnectedDossier(right);

        return `${getBondLabel(left, dossier.id)} ${leftDossier?.name ?? ''}`.localeCompare(
          `${getBondLabel(right, dossier.id)} ${rightDossier?.name ?? ''}`,
        );
      }),
    [bonds, dossiers, dossier.id],
  );
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
        caseId: dossier.caseId,
        targetDossierId: dossier.id,
      }),
    [dossier.caseId, dossier.id, dossiers, evidenceRecords],
  );

  useEffect(() => {
    setActiveEvidenceHighlightId(highlightedEvidenceRecordId ?? null);
  }, [highlightedEvidenceRecordId, dossier.id]);

  useEffect(() => {
    if (!activeEvidenceHighlightId) {
      return undefined;
    }

    window.requestAnimationFrame(() => {
      evidenceEntryRefs.current.get(activeEvidenceHighlightId)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
    const timeoutId = window.setTimeout(() => setActiveEvidenceHighlightId(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [activeEvidenceHighlightId, evidenceLogEntries.length]);

  useEffect(() => {
    if (isEditing) {
      setDraftSections(dossierSections);
      setSectionNotice('Editing Dossier');
      return;
    }

    setDraftSections([]);
    setIsAddSectionOpen(false);
    setRenamingSectionId(null);
    setRenameValue('');
    setRemovingSection(null);
    setSectionNotice(undefined);
  }, [dossierSections, isEditing]);

  useEffect(() => {
    writeFieldKitDossierDiagnostics({
      renderer: 'Field Kit',
      sharedSectionCount: visibleSections.length,
      sectionTypesReceived: Array.from(new Set(visibleSections.map((section) => section.kind))).sort(),
      unsupportedSectionRendererCount: 0,
      legacyCompatibilityMappingUsed: !dossier.sections?.length,
      currentDossierEditMode: isEditing,
      draftSectionCount: draftSections.length,
      persistedSectionCount: dossierSections.length,
      lastFieldKitDossierSaveStatus: lastSaveStatus,
      synchronizationDetectedMobileChange: mobileChangeDetected,
      selectedDossierIdPresent: Boolean(dossier.id),
      selectedDossierFound: true,
      sectionCollectionValid: Array.isArray(dossier.sections) || !dossier.sections,
      activeFilter: String(dossier.dossierType ?? 'Unknown'),
      filterDossierCount: 1,
      selectedDossierType: String(dossier.dossierType ?? 'Unknown'),
      typeConfigurationFound,
      specializedRendererFound: typeConfigurationFound,
      genericFallbackUsed: !typeConfigurationFound,
      characterOnlyAccessorDetected: false,
    });
  }, [
    dossier.sections?.length,
    dossierSections.length,
    draftSections.length,
    isEditing,
    lastSaveStatus,
    mobileChangeDetected,
    typeConfigurationFound,
    visibleSections,
  ]);

  function getConnectedDossier(bond: Bond) {
    const connectedId =
      bond.sourceDossierId === dossier.id ? bond.targetDossierId : bond.sourceDossierId;

    return dossiers.find((candidate) => candidate.id === connectedId) ?? null;
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
    const sourceSections = isEditing ? draftSections : dossierSections;
    const nextSections = sourceSections.map((section) =>
      section.id === sectionId ? { ...section, isCollapsed: !section.isCollapsed } : section,
    );

    if (isEditing) {
      updateDraftSections(nextSections);
      return;
    }

    await onSaveSections(dossier, nextSections);
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
    setSectionNotice('Section order updated');
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
          id: createStableId('custom'),
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

  async function saveSectionDraft() {
    setIsSavingSections(true);
    setSectionNotice(undefined);
    setLastSaveStatus('Saving');

    try {
      await onSaveSections(dossier, draftSections);
      setMobileChangeDetected(true);
      setLastSaveStatus('Saved');
      setSectionNotice('Investigation Updated');
      onDoneEditing();
    } catch {
      setMobileChangeDetected(true);
      setLastSaveStatus('Relationship Update Incomplete');
      setSectionNotice(
        'Relationship Update Incomplete. LoreBound saved the Dossier, but one or more Threadmark relationships could not be completed.',
      );
      onDoneEditing();
    } finally {
      setIsSavingSections(false);
    }
  }

  function cancelSectionDraft() {
    setDraftSections(dossierSections);
    onDoneEditing();
  }

  return (
    <section className="field-kit-panel field-kit-dossier-view" aria-labelledby="mobile-dossier-title">
      <header className="field-kit-panel__header">
        <button type="button" onClick={onBack} aria-label="Back to Dossiers">
          Back
        </button>
        <div>
          <span>{typeConfigurationFound ? String(dossier.dossierType) : 'Unknown Dossier Type'}</span>
          <h2 id="mobile-dossier-title">{typeConfig.singularLabel}</h2>
        </div>
      </header>

      <div className="field-kit-dossier-hero">
        <FieldKitThumbnail image={dossier.coverImage} name={dossier.name} />
        <div>
          <h3>{dossier.name}</h3>
          {!typeConfigurationFound ? (
            <p>LoreBound can display the shared Dossier information, but some specialized details are unavailable.</p>
          ) : (
            <p>{typeConfig.getDetailHeader(dossier)}</p>
          )}
        </div>
      </div>

      <div className="field-kit-dossier-actions">
        {isEditing ? (
          <>
            <Button type="button" variant="brass" onClick={saveSectionDraft} disabled={isSavingSections}>
              {isSavingSections ? 'Saving' : 'Save Changes'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelSectionDraft} disabled={isSavingSections}>
              Cancel
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

      {isEditing ? (
        <div className="field-kit-edit-status" role="status">
          <span>Editing Dossier</span>
          {sectionNotice ? <p>{sectionNotice}</p> : null}
          <Button type="button" variant="secondary" onClick={() => setIsAddSectionOpen(true)}>
            Add Section
          </Button>
        </div>
      ) : null}

      {visibleContentSections
        .map((section, index) => {
          const capabilities = getSectionCapabilities(section);
          const isRenaming = renamingSectionId === section.id;

          return (
            <section key={section.id} className="field-kit-file-section field-kit-dynamic-section">
              <div className="field-kit-section-title-row">
                <button
                  type="button"
                  aria-expanded={!section.isCollapsed}
                  aria-label={`${section.isCollapsed ? 'Expand' : 'Collapse'} ${section.title}`}
                  onClick={() => void toggleSection(section.id)}
                >
                  <h3>{section.title}</h3>
                </button>
                {isEditing ? (
                  <details className="field-kit-section-actions">
                    <summary aria-label={`Section actions for ${section.title}`}>
                      Actions
                    </summary>
                    <div>
                      {capabilities.canRename ? (
                        <button type="button" onClick={() => startRenameSection(section)}>
                          Rename
                        </button>
                      ) : null}
                      {capabilities.canDuplicate ? (
                        <button type="button" onClick={() => duplicateDraftSection(section)}>
                          Duplicate
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
                        disabled={index === visibleContentSections.length - 1}
                      >
                        Move Down
                      </button>
                      {capabilities.canRemove ? (
                        <button type="button" onClick={() => setRemovingSection(section)}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
              {isRenaming ? (
                <div className="field-kit-section-rename">
                  <label>
                    Section Name
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                  </label>
                  <Button type="button" variant="secondary" onClick={() => applySectionRename(section)}>
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setRenamingSectionId(null);
                      setRenameValue('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
              {section.isCollapsed ? (
                <p className="field-kit-section-empty">Section collapsed.</p>
              ) : (
                renderFieldKitSection(
                  section,
                  isEditing,
                  dossier,
                  dossiers,
                  updateSectionBody,
                  evidenceRecords,
                  onCreateEvidenceRecord,
                  (record) => {
                    const targetDossier = dossiers.find((candidate) => candidate.id === record.targetDossierId);

                    if (targetDossier) {
                      onOpenDossier(targetDossier, { evidenceRecordId: record.id });
                      return;
                    }

                    setActiveThreadmarkId(record.id);
                  },
                  setSectionNotice,
                )
              )}
            </section>
          );
        })}

      <details className="field-kit-file-section" open>
        <summary>
          <h3>Evidence Log</h3>
        </summary>
        {evidenceLogEntries.length > 0 ? (
          <ol className="settings-compact-list" aria-label={`${dossier.name} Evidence Log`}>
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
                data-highlighted={activeEvidenceHighlightId === entry.record.id ? 'true' : undefined}
              >
                <article>
                  <button
                    type="button"
                    className="dossier-evidence-origin-link"
                    onClick={() => onOpenDossier(entry.originDossier)}
                  >
                    {entry.originDossier.name}
                  </button>
                  <small>{entry.originDossier.dossierType}</small>
                  <blockquote style={{ margin: '0.65rem 0', whiteSpace: 'pre-wrap' }}>
                    "{formatEvidenceLogSelectedText(entry.record.selectedText)}"
                  </blockquote>
                  <small>{formatShortDate(entry.record.createdAt)}</small>
                  <div className="field-kit-dossier-actions">
                    {canRecordBondFromEvidence(entry.record) ? (
                      <Button type="button" variant="brass" onClick={() => onCreateBondFromEvidence(entry)}>
                        Record Bond
                      </Button>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p>No evidence has been linked to this Dossier.</p>
        )}
      </details>

      {activeThreadmark ? (
        <section
          className="field-kit-file-section"
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
              <div className="field-kit-dossier-actions">
                <Button
                  type="button"
                  variant="brass"
                  onClick={() => {
                    setActiveThreadmarkId(null);
                    onOpenDossier(activeThreadmarkTarget);
                  }}
                >
                  Open Dossier
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void onRemoveEvidenceRecord(activeThreadmark).then(() => setActiveThreadmarkId(null));
                  }}
                >
                  Remove Threadmark
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3>Threadmark Unavailable</h3>
              <p>The linked Dossier is no longer available.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void onRemoveEvidenceRecord(activeThreadmark).then(() => setActiveThreadmarkId(null));
                }}
              >
                Remove Threadmark
              </Button>
            </>
          )}
        </section>
      ) : null}

        <section className="field-kit-file-section">
          <h3>Record Details</h3>
          <dl className="settings-compact-list">
            <InfoRow label="Modified" value={formatShortDate(dossier.dateModified)} />
          </dl>
        </section>

      <section className="field-kit-file-section">
        <div className="field-kit-section-heading">
          <h3>Bonds</h3>
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
                  aria-label={`${bondLabel}: open ${connectedDossier.name}, ${getKnowledgeTypeConfig(connectedDossier.dossierType).singularLabel}`}
                  onClick={() => onOpenDossier(connectedDossier)}
                >
                  <FieldKitThumbnail image={connectedDossier.coverImage} name={connectedDossier.name} />
                  <span>
                    <strong>{bondLabel}</strong>
                    <em>{connectedDossier.name}</em>
                    <small>
                      {getKnowledgeTypeConfig(connectedDossier.dossierType).singularLabel}
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
            </article>
          );
        })}
      </section>

      {isAddSectionOpen ? (
        <div className="field-kit-section-sheet-backdrop" role="presentation">
          <section
            className="field-kit-section-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-kit-add-section-title"
          >
            <header>
              <div>
                <span>Dossier Edit Mode</span>
                <h2 id="field-kit-add-section-title">Add Section</h2>
              </div>
              <button type="button" onClick={() => setIsAddSectionOpen(false)}>
                Close
              </button>
            </header>

            <label className="field-kit-search">
              <span>Search Section Library</span>
              <input
                value={sectionSearchQuery}
                onChange={(event) => setSectionSearchQuery(event.target.value)}
                placeholder="Abilities, Timeline, Quotes"
              />
            </label>

            <div className="field-kit-section-library">
              {sectionTemplatesByCategory.length > 0 ? (
                sectionTemplatesByCategory.map(([category, templates]) => (
                  <section key={category}>
                    <h3>{category}</h3>
                    <div>
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
                <p>No matching Sections found.</p>
              )}
            </div>

            <section className="field-kit-custom-section" aria-labelledby="field-kit-custom-section-title">
              <h3 id="field-kit-custom-section-title">Custom Section</h3>
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
              <label className="field-kit-check-row">
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
        <ConfirmPanel
          title="Remove Section?"
          message={`${removingSection.title} will be removed from this Dossier draft. Save Changes is still required to make it permanent.`}
          onCancel={() => setRemovingSection(null)}
          onConfirm={async () => {
            confirmRemoveSection();
          }}
          confirmLabel="Remove Section"
        />
      ) : null}
      {children}
    </section>
  );
}

function renderFieldKitThreadmarkedText({
  text,
  section,
  dossier,
  evidenceRecords,
  onActivate,
}: {
  text: string;
  section: DossierSection;
  dossier: Dossier;
  evidenceRecords: EvidenceRecord[];
  onActivate: (record: EvidenceRecord) => void;
}) {
  const records = evidenceRecords
    .filter((record) => record.status === 'active')
    .filter((record) => record.caseId === dossier.caseId)
    .filter((record) => record.originDossierId === dossier.id)
    .filter((record) => record.originSectionId === section.id)
    .filter((record) => text.slice(record.anchorStart, record.anchorEnd) === record.selectedText)
    .sort((left, right) => left.anchorStart - right.anchorStart);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  records.forEach((record) => {
    if (record.anchorStart < cursor) {
      return;
    }

    nodes.push(text.slice(cursor, record.anchorStart));
    nodes.push(
      <button
        key={record.id}
        type="button"
        style={{
          background: 'transparent',
          border: 0,
          borderBottom: '2px solid rgba(176, 132, 56, 0.92)',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          padding: '0 1px 1px',
          outlineOffset: '3px',
        }}
        onClick={() => onActivate(record)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(record);
          }
        }}
      >
        {text.slice(record.anchorStart, record.anchorEnd)}
      </button>,
    );
    cursor = record.anchorEnd;
  });

  nodes.push(text.slice(cursor));
  return nodes;
}

function renderFieldKitSection(
  section: DossierSection,
  isEditing: boolean,
  dossier: Dossier,
  dossiers: Dossier[],
  onBodyChange: (sectionId: string, body: string) => void,
  evidenceRecords: EvidenceRecord[],
  onCreateEvidenceRecord: (details: {
    dossier: Dossier;
    section: DossierSection;
    targetDossier: Dossier;
    selectionRange: { start: number; end: number };
  }) => Promise<void>,
  onActivateEvidenceRecord: (record: EvidenceRecord) => void,
  onNotice: (message: string) => void,
) {
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

  if (isEditing && ['custom', 'overview', 'notes'].includes(section.kind)) {
    return (
      <label className="field-kit-section-editor">
        Section Notes
        <ThreadmarkAuthoringTextarea
          rows={5}
          value={section.body ?? ''}
          dossier={dossier}
          sectionId={section.id}
          dossiers={dossiers}
          isMobile
          onChange={(value) => onBodyChange(section.id, value)}
          onCreateEvidenceRecord={(targetDossier, selectionRange) =>
            onCreateEvidenceRecord({ dossier, section, targetDossier, selectionRange })
          }
          onAuthoringNotice={onNotice}
        />
      </label>
    );
  }

  return section.body ? (
    <p>
      {renderFieldKitThreadmarkedText({
        text: section.body,
        section,
        dossier,
        evidenceRecords,
        onActivate: onActivateEvidenceRecord,
      })}
    </p>
  ) : (
    <p>No entries recorded.</p>
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
  confirmLabel = 'Remove Bond',
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
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
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
