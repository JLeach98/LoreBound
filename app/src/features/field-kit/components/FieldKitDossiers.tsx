import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { isThreadmarkGeneratedBond } from '../../threadmarks';
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
  DossierType,
} from '../../cases/types/dossierTypes';
import { syncService } from '../../../services/sync/SyncService';
import { requestAutomaticSynchronization } from '../../../services/sync/AutomaticSyncContext';
import type { SyncPlan } from '../../../services/sync/SyncTypes';
import { evidenceRecordRepository } from '../../../repositories/EvidenceRecordRepository';
import {
  type EvidenceLogEntry,
  formatEvidenceLogSelectedText,
  getEvidenceLogEntries,
} from '../../threadmarks/evidenceRecordSelectors';
import type { EvidenceRecord } from '../../threadmarks/evidenceRecordTypes';
import { threadmarkKeyToBondType } from '../../threadmarks/bondThreadmarkCompatibility';
import {
  createDefaultDossierSections,
  ensureDossierSections,
} from '../../cases/utils/dossierSections';
import { getCaseFileBlockType } from '../../cases/utils/dossierBlocks';
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
  const { dossiers, deleteExistingDossier, refreshDossiers } = useDossiers();
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
    setEditorState(null);
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
          onBack={() => {
            setHighlightedEvidenceRecordId(null);
            setSelectedDossier(null);
          }}
          onOpenDossier={(dossier, options) => {
            setSelectedDossier(dossier);
            setHighlightedEvidenceRecordId(options?.evidenceRecordId ?? null);
          }}
          onEditDossier={() => setEditorState({ mode: 'edit', dossier: selectedDossier })}
          onDelete={() => setDeletingDossier(selectedDossier)}
          onPin={async () => {
            await pinDossier(selectedDossier.id);
          }}
          onUnpin={async () => {
            await removeDossierFromBoard(selectedDossier.id);
          }}
          onCreateBondFromEvidence={(entry) => setCreatingBondFromEvidence({ dossier: selectedDossier, entry })}
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
              onCreated={handleCanonicalDossierSaved}
              onOpenDossier={(dossier, options) => {
                setEditorState(null);
                setSelectedDossier(dossier);
                setHighlightedEvidenceRecordId(options?.evidenceRecordId ?? null);
              }}
              closeAfterSave
              closeAfterCancel
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
  children: ReactNode;
  onBack: () => void;
  onOpenDossier: (dossier: Dossier, options?: { evidenceRecordId?: string }) => void;
  onEditDossier: () => void;
  onDelete: () => void;
  onPin: () => Promise<void>;
  onUnpin: () => Promise<void>;
  onCreateBondFromEvidence: (entry: EvidenceLogEntry) => void;
  onRemoveEvidenceRecord: (record: EvidenceRecord) => Promise<void>;
};

function FieldKitDossierView({
  dossier,
  dossiers,
  bonds,
  evidenceRecords,
  highlightedEvidenceRecordId,
  isPinned,
  children,
  onBack,
  onOpenDossier,
  onEditDossier,
  onDelete,
  onPin,
  onUnpin,
  onCreateBondFromEvidence,
  onRemoveEvidenceRecord,
}: FieldKitDossierViewProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [activeThreadmarkId, setActiveThreadmarkId] = useState<string | null>(null);
  const [activeEvidenceHighlightId, setActiveEvidenceHighlightId] = useState<string | null>(
    highlightedEvidenceRecordId ?? null,
  );
  const evidenceEntryRefs = useRef(new Map<string, HTMLLIElement>());
  const typeConfig = getKnowledgeTypeConfig(dossier.dossierType);
  const typeConfigurationFound = hasKnowledgeTypeConfig(dossier.dossierType);
  const dossierSections = useMemo(() => ensureDossierSections(dossier), [dossier]);
  const visibleContentSections = useMemo(
    () =>
      dossierSections
        .filter((section) => section.kind !== 'relationships')
        .filter((section) => section.kind !== 'identity')
        .filter(hasReadableFieldKitSection),
    [dossierSections],
  );
  const metadataRows = useMemo(() => getFieldKitMetadataRows(dossier), [dossier]);
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
    writeFieldKitDossierDiagnostics({
      renderer: 'Field Kit',
      sharedSectionCount: dossierSections.length,
      sectionTypesReceived: Array.from(new Set(dossierSections.map((section) => section.kind))).sort(),
      unsupportedSectionRendererCount: 0,
      legacyCompatibilityMappingUsed: !dossier.sections?.length,
      currentDossierEditMode: false,
      draftSectionCount: 0,
      persistedSectionCount: dossierSections.length,
      lastFieldKitDossierSaveStatus: 'Canonical Open Canvas available',
      synchronizationDetectedMobileChange: false,
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
    typeConfigurationFound,
    dossierSections,
  ]);

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

      {metadataRows.length > 0 ? (
        <dl className="field-kit-dossier-metadata" aria-label={`${dossier.name} metadata`}>
          {metadataRows.map((field) => (
            <InfoRow key={field.label} label={field.label} value={field.value} />
          ))}
        </dl>
      ) : null}

      <div className="field-kit-dossier-actions">
        <Button type="button" variant="brass" onClick={onEditDossier} aria-label={`Edit ${dossier.name}`}>
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

      <article className="field-kit-dossier-document" aria-label={`${dossier.name} document`}>
        {visibleContentSections.length > 0 ? (
          visibleContentSections.map((section) =>
            renderFieldKitReadingSection({
              section,
              dossier,
              evidenceRecords,
              onActivateEvidenceRecord: (record) => {
                const targetDossier = dossiers.find((candidate) => candidate.id === record.targetDossierId);

                if (targetDossier) {
                  onOpenDossier(targetDossier, { evidenceRecordId: record.id });
                  return;
                }

                setActiveThreadmarkId(record.id);
              },
            }),
          )
        ) : (
          <p className="field-kit-section-empty">No dossier notes have been recorded.</p>
        )}
      </article>

      <details className="field-kit-file-module" open>
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
          className="field-kit-file-module"
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

      <section className="field-kit-file-module field-kit-record-details">
          <h3>Record Details</h3>
          <dl className="settings-compact-list">
            <InfoRow label="Modified" value={formatShortDate(dossier.dateModified)} />
          </dl>
      </section>

      <section className="field-kit-file-module">
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
  offset,
}: {
  text: string;
  section: DossierSection;
  dossier: Dossier;
  evidenceRecords: EvidenceRecord[];
  onActivate: (record: EvidenceRecord) => void;
  offset?: number;
}) {
  const anchorOffset = offset ?? 0;
  const records = evidenceRecords
    .filter((record) => record.status === 'active')
    .filter((record) => record.caseId === dossier.caseId)
    .filter((record) => record.originDossierId === dossier.id)
    .filter((record) => record.originSectionId === section.id)
    .filter((record) => {
      const relativeStart = record.anchorStart - anchorOffset;
      const relativeEnd = record.anchorEnd - anchorOffset;

      return (
        relativeStart >= 0 &&
        relativeEnd <= text.length &&
        text.slice(relativeStart, relativeEnd) === record.selectedText
      );
    })
    .sort((left, right) => left.anchorStart - right.anchorStart);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  records.forEach((record) => {
    const relativeStart = record.anchorStart - anchorOffset;
    const relativeEnd = record.anchorEnd - anchorOffset;

    if (relativeStart < cursor) {
      return;
    }

    nodes.push(text.slice(cursor, relativeStart));
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
        {text.slice(relativeStart, relativeEnd)}
      </button>,
    );
    cursor = relativeEnd;
  });

  nodes.push(text.slice(cursor));
  return nodes;
}

function hasReadableFieldKitSection(section: DossierSection) {
  if (section.kind === 'identity') {
    return Boolean(section.fields?.some((field) => field.value.trim()));
  }

  if (section.kind === 'timeline' || section.kind === 'gallery' || section.kind === 'evidence') {
    return true;
  }

  return Boolean(section.body?.trim());
}

function renderFieldKitReadingSection({
  section,
  dossier,
  evidenceRecords,
  onActivateEvidenceRecord,
}: {
  section: DossierSection;
  dossier: Dossier;
  evidenceRecords: EvidenceRecord[];
  onActivateEvidenceRecord: (record: EvidenceRecord) => void;
}) {
  const body = section.body?.trim() ?? '';
  const blockType = getCaseFileBlockType(section);

  if (section.kind === 'identity') {
    return section.fields?.length ? (
      <dl className="settings-compact-list">
        {section.fields.map((field) => (
          <InfoRow key={field.id} label={field.label} value={field.value} />
        ))}
      </dl>
    ) : (
      <p className="field-kit-section-empty">No identity facts have been recorded.</p>
    );
  }

  if (section.kind === 'timeline') {
    return (
      <>
        <h3>{section.title}</h3>
        <p className="field-kit-section-empty">Timeline Sections are reserved for a future LoreBound update.</p>
      </>
    );
  }

  if (section.kind === 'gallery') {
    return (
      <>
        <h3>{section.title}</h3>
        <p className="field-kit-section-empty">Gallery Sections are reserved for a future LoreBound update.</p>
      </>
    );
  }

  if (section.kind === 'evidence') {
    return (
      <>
        <h3>{section.title}</h3>
        <p className="field-kit-section-empty">Evidence Sections are reserved for a future LoreBound update.</p>
      </>
    );
  }

  if (blockType === 'divider') {
    return <hr key={section.id} className="field-kit-document-divider" />;
  }

  if (!body) {
    return null;
  }

  if (blockType === 'section-heading') {
    return (
      <h3 key={section.id} className="field-kit-document-heading">
        {body || section.title}
      </h3>
    );
  }

  if (blockType === 'bulleted-list' || blockType === 'numbered-list') {
    const listItems = body
      .split(/\n+/)
      .map((item) => item.replace(/^[-\d.\s]+/, '').trim())
      .filter(Boolean);
    let searchOffset = 0;
    const listItemsWithOffsets = listItems.map((item) => {
      const offset = Math.max(0, body.indexOf(item, searchOffset));
      searchOffset = offset + item.length;
      return { item, offset };
    });

    if (listItemsWithOffsets.length === 0) {
      return null;
    }

    const ListTag = blockType === 'bulleted-list' ? 'ul' : 'ol';

    return (
      <ListTag key={section.id} className="field-kit-document-list">
        {listItemsWithOffsets.map(({ item, offset }) => (
          <li key={`${section.id}-${offset}`}>
            {renderFieldKitThreadmarkedText({
              text: item,
              section,
              dossier,
              evidenceRecords,
              onActivate: onActivateEvidenceRecord,
              offset,
            })}
          </li>
        ))}
      </ListTag>
    );
  }

  if (blockType === 'quote') {
    return (
      <blockquote key={section.id} className="field-kit-document-quote">
        {renderFieldKitThreadmarkedText({
          text: body,
          section,
          dossier,
          evidenceRecords,
          onActivate: onActivateEvidenceRecord,
        })}
      </blockquote>
    );
  }

  const shouldShowSectionTitle =
    section.kind === 'custom' &&
    section.title.trim() &&
    section.title !== 'Paragraph' &&
    section.title !== 'Overview' &&
    section.title !== 'Investigation Notes';
  let paragraphSearchOffset = 0;
  const paragraphsWithOffsets = body.split(/\n{2,}/).map((paragraph) => {
    const offset = Math.max(0, body.indexOf(paragraph, paragraphSearchOffset));
    paragraphSearchOffset = offset + paragraph.length;
    return { paragraph, offset };
  });

  return (
    <section key={section.id} className="field-kit-document-section">
      {shouldShowSectionTitle ? <h3>{section.title}</h3> : null}
      {paragraphsWithOffsets.map(({ paragraph, offset }) => (
        <p key={`${section.id}-paragraph-${offset}`}>
          {renderFieldKitThreadmarkedText({
            text: paragraph,
            section,
            dossier,
            evidenceRecords,
            onActivate: onActivateEvidenceRecord,
            offset,
          })}
        </p>
      ))}
    </section>
  );
}

function getFieldKitMetadataRows(dossier: Dossier) {
  const fieldsByType: Record<DossierType, Array<{ label: string; value?: string }>> = {
    Character: [
      { label: 'Alias', value: dossier.alias },
      { label: 'Status', value: dossier.characterStatus },
      { label: 'Affiliation', value: dossier.affiliation },
    ],
    Location: [
      { label: 'Region', value: dossier.region },
      { label: 'World', value: dossier.world },
    ],
    Event: [
      { label: 'Date', value: dossier.eventDate },
      { label: 'Era', value: dossier.era },
    ],
    Organization: [
      { label: 'Leader', value: dossier.leader },
      { label: 'Type', value: dossier.organizationType },
    ],
    Theory: [
      { label: 'Confidence', value: dossier.theoryConfidence },
      { label: 'Status', value: dossier.theoryStatus },
    ],
    Artifact: [],
  };

  return fieldsByType[dossier.dossierType]
    .map((field) => ({ label: field.label, value: field.value?.trim() ?? '' }))
    .filter((field) => field.value);
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
