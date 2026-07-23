import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useBonds } from '../context/BondContext';
import { useBoard } from '../context/BoardContext';
import { useDossiers } from '../context/DossierContext';
import type { Bond, BondFormValues } from '../types/bondTypes';
import type { BoardPin } from '../types/boardTypes';
import type { LoreCase } from '../types/caseTypes';
import type { Dossier, DossierType } from '../types/dossierTypes';
import { getBondDisplayLabel } from '../utils/bondLabels';
import { BondFormDialog } from './BondFormDialog';
import { DeleteBondDialog } from './DeleteBondDialog';
import { DeleteDossierDialog } from './DeleteDossierDialog';
import { DossierSheet } from './DossierSheet';
import { EvidenceTray } from './EvidenceTray';

type BoardEvidenceLayerProps = {
  activeCase: LoreCase;
  onReturnToOffice: () => void;
};

function getDossierInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'LB';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function DossierTypeIcon({ dossierType }: { dossierType: DossierType }) {
  if (dossierType === 'Character') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.75 19c.9-3.4 3-5.1 6.25-5.1s5.35 1.7 6.25 5.1" />
      </svg>
    );
  }

  if (dossierType === 'Location') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21s6-5.45 6-11a6 6 0 0 0-12 0c0 5.55 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    );
  }

  if (dossierType === 'Event') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 4v3M17 4v3M5.5 9.5h13M7 6h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      </svg>
    );
  }

  if (dossierType === 'Organization') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 20h16M6 20V9l6-4 6 4v11M9 20v-6h6v6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 6.5c2.8-2 5.2-2 7 0s4.2 2 7 0M5 17.5c2.8-2 5.2-2 7 0s4.2 2 7 0M7 12h10" />
    </svg>
  );
}

export function BoardEvidenceLayer({
  activeCase,
  onReturnToOffice,
}: BoardEvidenceLayerProps) {
  const { dossiers, deleteExistingDossier } = useDossiers();
  const {
    bonds,
    bondsForDossier,
    updateExistingBond,
    deleteExistingBond,
    refreshBonds,
  } = useBonds();
  const {
    boardPins,
    isLoading,
    errorMessage,
    clearError,
    pinDossier,
    movePin,
    removeDossierFromBoard,
    isDossierPinned,
  } = useBoard();
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [focusedEvidenceRecordId, setFocusedEvidenceRecordId] = useState<string | null>(null);
  const [deletingDossier, setDeletingDossier] = useState<Dossier | null>(null);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DossierType>('Character');
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());
  const [isShowingBonds, setIsShowingBonds] = useState(true);
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const [editingBond, setEditingBond] = useState<Bond | null>(null);
  const [deletingBond, setDeletingBond] = useState<Bond | null>(null);
  const [settlingPinIds, setSettlingPinIds] = useState<Set<string>>(new Set());
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  const [dragPreviewPositions, setDragPreviewPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [trayDragState, setTrayDragState] = useState<{
    dossier: Dossier;
    x: number;
    y: number;
    didMove: boolean;
    isOverBoard: boolean;
  } | null>(null);
  const lastOpenedControlRef = useRef<HTMLElement | null>(null);
  const boardSurfaceRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pinId: string;
    pointerId: number;
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
    didMove: boolean;
  } | null>(null);
  const suppressedOpenDossierIdsRef = useRef<Set<string>>(new Set());
  const trayDragStateRef = useRef<{
    dossier: Dossier;
    pointerId: number;
    startX: number;
    startY: number;
    didMove: boolean;
  } | null>(null);

  const pinnedDossiers = useMemo(
    () =>
      boardPins
        .map((pin) => ({
          pin,
          dossier: dossiers.find((candidate) => candidate.id === pin.dossierId),
        }))
        .filter((entry): entry is { pin: (typeof boardPins)[number]; dossier: Dossier } =>
          Boolean(entry.dossier),
        ),
    [boardPins, dossiers],
  );
  const pinnedDossierById = useMemo(
    () =>
      new Map(
        pinnedDossiers.map((entry) => [
          entry.dossier.id,
          {
            ...entry,
            position: dragPreviewPositions[entry.pin.id] ?? entry.pin.position,
          },
        ]),
      ),
    [dragPreviewPositions, pinnedDossiers],
  );
  const visibleBonds = useMemo(
    () =>
      bonds.filter(
        (bond) =>
          pinnedDossierById.has(bond.sourceDossierId) &&
          pinnedDossierById.has(bond.targetDossierId),
      ),
    [bonds, pinnedDossierById],
  );
  function openDossier(dossier: Dossier, opener: HTMLElement) {
    if (suppressedOpenDossierIdsRef.current.has(dossier.id)) {
      return;
    }

    lastOpenedControlRef.current = opener;
    setSelectedDossier(dossier);
  }

  function selectPin(pinId: string) {
    setSelectedPinIds(new Set([pinId]));
  }

  function closeDossier() {
    setSelectedDossier(null);
    setFocusedEvidenceRecordId(null);
    window.setTimeout(() => lastOpenedControlRef.current?.focus(), 0);
  }

  function getDossierById(dossierId: string) {
    return dossiers.find((candidate) => candidate.id === dossierId) ?? null;
  }

  async function handleDeleteDossier() {
    if (!deletingDossier) {
      return;
    }

    await deleteExistingDossier(deletingDossier.id);
    await removeDossierFromBoard(deletingDossier.id);
    await refreshBonds();
    setDeletingDossier(null);
    setSelectedDossier(null);
  }

  async function handleRemoveDossierFromBoard(dossier: Dossier) {
    await removeDossierFromBoard(dossier.id);
    setSelectedDossier(null);
  }

  async function handleAddToInvestigation(dossier: Dossier, position?: { x: number; y: number }) {
    const pin = await pinDossier(dossier.id, position);
    selectPin(pin.id);
  }

  async function handleUpdateBond(values: BondFormValues) {
    if (!editingBond) {
      return;
    }

    const updatedBond = await updateExistingBond(editingBond.id, values);
    setSelectedBond(updatedBond);
    setEditingBond(null);
  }

  async function handleDeleteBond() {
    if (!deletingBond) {
      return;
    }

    await deleteExistingBond(deletingBond.id);
    setDeletingBond(null);
    setSelectedBond(null);
  }

  function clampPosition(position: { x: number; y: number }) {
    return {
      x: Math.min(84, Math.max(0, position.x)),
      y: Math.min(82, Math.max(0, position.y)),
    };
  }

  function getPointerPosition(event: PointerEvent<HTMLElement>, pin: BoardPin) {
    const surface = boardSurfaceRef.current;

    if (!surface) {
      return pin.position;
    }

    const rect = surface.getBoundingClientRect();
    const state = dragStateRef.current;
    const startPosition = state?.startPosition ?? pin.position;
    const deltaX = ((event.clientX - (state?.startX ?? event.clientX)) / rect.width) * 100;
    const deltaY = ((event.clientY - (state?.startY ?? event.clientY)) / rect.height) * 100;

    return clampPosition({
      x: startPosition.x + deltaX,
      y: startPosition.y + deltaY,
    });
  }

  function getBoardDropPosition(event: PointerEvent<HTMLElement>) {
    const surface = boardSurfaceRef.current;

    if (!surface) {
      return null;
    }

    const rect = surface.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return null;
    }

    return clampPosition({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  function handleCardPointerDown(event: PointerEvent<HTMLElement>, pin: BoardPin) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pinId: pin.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: pin.position,
      didMove: false,
    };
    selectPin(pin.id);
    setDraggingPinId(pin.id);
  }

  function handleCardPointerMove(event: PointerEvent<HTMLElement>, pin: BoardPin) {
    const state = dragStateRef.current;

    if (!state || state.pinId !== pin.id) {
      return;
    }

    const movedDistance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);

    if (movedDistance > 4) {
      state.didMove = true;
    }

    if (!state.didMove) {
      return;
    }

    setDragPreviewPositions((positions) => ({
      ...positions,
      [pin.id]: getPointerPosition(event, pin),
    }));
  }

  async function handleCardPointerUp(event: PointerEvent<HTMLElement>, pin: BoardPin) {
    const state = dragStateRef.current;

    if (!state || state.pinId !== pin.id) {
      return;
    }

    event.currentTarget.releasePointerCapture(state.pointerId);
    const nextPosition = state.didMove ? getPointerPosition(event, pin) : pin.position;
    dragStateRef.current = null;
    setDraggingPinId(null);

    if (state.didMove) {
      suppressedOpenDossierIdsRef.current.add(pin.dossierId);
      window.setTimeout(() => {
        suppressedOpenDossierIdsRef.current.delete(pin.dossierId);
      }, 0);
      setDragPreviewPositions((positions) => ({
        ...positions,
        [pin.id]: nextPosition,
      }));
      await movePin(pin.id, nextPosition);
      setSettlingPinIds((currentPinIds) => new Set(currentPinIds).add(pin.id));
      window.setTimeout(() => {
        setSettlingPinIds((currentPinIds) => {
          const nextPinIds = new Set(currentPinIds);
          nextPinIds.delete(pin.id);
          return nextPinIds;
        });
      }, 220);
      setDragPreviewPositions((positions) => {
        const nextPositions = { ...positions };
        delete nextPositions[pin.id];
        return nextPositions;
      });
    }
  }

  function handleCardClick(event: MouseEvent<HTMLElement>, pin: BoardPin) {
    if (suppressedOpenDossierIdsRef.current.has(pin.dossierId)) {
      return;
    }

    event.stopPropagation();

    selectPin(pin.id);
  }

  function handleCardDoubleClick(
    event: MouseEvent<HTMLElement>,
    dossier: Dossier,
  ) {
    event.stopPropagation();
    openDossier(dossier, event.currentTarget);
  }

  function handleCardPointerCancel(pin: BoardPin) {
    dragStateRef.current = null;
    setDraggingPinId(null);
    setDragPreviewPositions((positions) => {
      const nextPositions = { ...positions };
      delete nextPositions[pin.id];
      return nextPositions;
    });
  }

  async function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, pin: BoardPin) {
    const movement = event.shiftKey ? 5 : 2;
    const keyMovement: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
    };
    const delta = keyMovement[event.key];

    if (event.key === 'Enter') {
      const dossier = dossiers.find((candidate) => candidate.id === pin.dossierId);

      if (dossier) {
        openDossier(dossier, event.currentTarget);
      }

      return;
    }

    if (!delta) {
      return;
    }

    event.preventDefault();
    selectPin(pin.id);
    await movePin(
      pin.id,
      clampPosition({
        x: pin.position.x + delta.x,
        y: pin.position.y + delta.y,
      }),
    );
  }

  function handleTrayDragStart(dossier: Dossier, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    trayDragStateRef.current = {
      dossier,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      didMove: false,
    };
  }

  function handleTrayDragMove(dossier: Dossier, event: PointerEvent<HTMLElement>) {
    const state = trayDragStateRef.current;

    if (!state || state.dossier.id !== dossier.id) {
      return;
    }

    const movedDistance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);

    if (movedDistance > 4) {
      state.didMove = true;
    }

    if (!state.didMove) {
      return;
    }

    setTrayDragState({
      dossier,
      x: event.clientX,
      y: event.clientY,
      didMove: true,
      isOverBoard: Boolean(getBoardDropPosition(event)),
    });
  }

  async function handleTrayDragEnd(dossier: Dossier, event: PointerEvent<HTMLElement>) {
    const state = trayDragStateRef.current;

    if (!state || state.dossier.id !== dossier.id) {
      return;
    }

    event.currentTarget.releasePointerCapture(state.pointerId);
    trayDragStateRef.current = null;
    setTrayDragState(null);

    if (!state.didMove) {
      return;
    }

    const dropPosition = getBoardDropPosition(event);

    if (dropPosition) {
      await handleAddToInvestigation(dossier, dropPosition);
    }
  }

  function handleTrayDragCancel() {
    trayDragStateRef.current = null;
    setTrayDragState(null);
  }

  return (
    <>
      <div className="investigation-mode-topbar" aria-label="Investigation Mode">
        <div className="investigation-case-label">
          <strong>{activeCase.caseName}</strong>
          <span>
            {activeCase.universeType}
            {activeCase.authorOrCreator ? ` / ${activeCase.authorOrCreator}` : ''}
          </span>
        </div>
        <div className="investigation-mode-actions">
          <button
            type="button"
            className="board-control-button"
            aria-pressed={isShowingBonds}
            onClick={() => setIsShowingBonds((currentValue) => !currentValue)}
          >
            {isShowingBonds ? 'Hide Bonds' : 'Show Bonds'}
          </button>
        </div>
        <button type="button" className="return-office-button" onClick={onReturnToOffice}>
          Return to Office
        </button>
      </div>

      <section
        className="board-evidence"
        aria-label="Evidence Board"
        data-drop-target={trayDragState?.isOverBoard ? 'true' : 'false'}
        onClick={() => setSelectedPinIds(new Set())}
      >
        {errorMessage ? (
          <div className="board-evidence__alert" role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <p className="board-evidence__empty">Reading the Board...</p>
        ) : null}

        {!isLoading && pinnedDossiers.length === 0 ? (
          <div className="board-evidence__empty">
            <h2>No Evidence on Board</h2>
            <p>
              Add Character, Location, Event, Organization, or Theory Dossiers to begin
              your investigation.
            </p>
          </div>
        ) : null}

        <div className="board-evidence__surface" ref={boardSurfaceRef}>
          <svg className="board-bonds" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker
                id="bond-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" />
              </marker>
            </defs>
            {isShowingBonds
              ? visibleBonds.map((bond) => {
                  const sourceEntry = pinnedDossierById.get(bond.sourceDossierId);
                  const targetEntry = pinnedDossierById.get(bond.targetDossierId);

                  if (!sourceEntry || !targetEntry) {
                    return null;
                  }

                  const x1 = sourceEntry.position.x + 5.5;
                  const y1 = sourceEntry.position.y + 7;
                  const x2 = targetEntry.position.x + 5.5;
                  const y2 = targetEntry.position.y + 7;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const sag = Math.min(5.5, Math.max(2, Math.abs(x2 - x1) * 0.08));
                  const controlY = midY + sag;
                  const pathDefinition = `M ${x1} ${y1} Q ${midX} ${controlY} ${x2} ${y2}`;

                  return (
                    <g
                      key={bond.id}
                      className={`board-bond board-bond--${(bond.status ?? 'unknown').toLowerCase()}`}
                      data-selected={selectedBond?.id === bond.id ? 'true' : 'false'}
                      role="button"
                      tabIndex={0}
                      aria-label={`${getBondDisplayLabel(bond)} Bond between ${sourceEntry.dossier.name} and ${targetEntry.dossier.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedBond(bond);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedBond(bond);
                        }
                      }}
                    >
                      <path
                        className="board-bond__hit-area"
                        d={pathDefinition}
                      />
                      <path
                        className="board-bond__shadow"
                        d={pathDefinition}
                        pathLength={1}
                      />
                      <path
                        className="board-bond__thread"
                        d={pathDefinition}
                        pathLength={1}
                        markerEnd={bond.bondBehavior === 'Directional' ? 'url(#bond-arrow)' : undefined}
                      />
                      <text
                        className="board-bond__label"
                        x={midX}
                        y={controlY - 1.4}
                        textAnchor="middle"
                      >
                        {getBondDisplayLabel(bond)}
                      </text>
                    </g>
                  );
                })
              : null}
          </svg>
          {visibleBonds.length > 0 ? (
            <ul className="sr-only" aria-label="Visible board Bonds">
              {visibleBonds.map((bond) => (
                <li key={bond.id}>
                  {getBondDisplayLabel(bond)} between{' '}
                  {getDossierById(bond.sourceDossierId)?.name ?? 'unknown source'} and{' '}
                  {getDossierById(bond.targetDossierId)?.name ?? 'unknown target'}
                </li>
              ))}
            </ul>
          ) : null}
          {pinnedDossiers.length > 0
            ? pinnedDossiers.map(({ pin, dossier }, index) => (
                <article
                  key={pin.id}
                  className={`board-card board-card--${dossier.dossierType.toLowerCase()}`}
                  data-dragging={draggingPinId === pin.id ? 'true' : 'false'}
                  data-selected={selectedPinIds.has(pin.id) ? 'true' : 'false'}
                  data-settling={settlingPinIds.has(pin.id) ? 'true' : 'false'}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedPinIds.has(pin.id)}
                  aria-label={`${dossier.name}. ${selectedPinIds.has(pin.id) ? 'Selected. ' : ''}Double-click or press Enter to open. Use arrow keys to move.`}
                  style={{
                    left: `${(dragPreviewPositions[pin.id] ?? pin.position).x}%`,
                    top: `${(dragPreviewPositions[pin.id] ?? pin.position).y}%`,
                    transform: `rotate(${index % 2 === 0 ? '-1.2deg' : '1.1deg'})`,
                  }}
                  onPointerDown={(event) => handleCardPointerDown(event, pin)}
                  onPointerMove={(event) => handleCardPointerMove(event, pin)}
                  onPointerUp={(event) => handleCardPointerUp(event, pin)}
                  onPointerCancel={() => handleCardPointerCancel(pin)}
                  onKeyDown={(event) => handleCardKeyDown(event, pin)}
                  onClick={(event) => handleCardClick(event, pin)}
                  onDoubleClick={(event) => handleCardDoubleClick(event, dossier)}
                >
                  <span className="board-card__pin" aria-hidden="true" />
                  <div className="board-card__open" aria-hidden="true">
                    {dossier.coverImage ? (
                      <img src={dossier.coverImage} alt="" />
                    ) : (
                      <span className="board-card__fallback" aria-hidden="true">
                        <DossierTypeIcon dossierType={dossier.dossierType} />
                        <strong>{getDossierInitials(dossier.name)}</strong>
                      </span>
                    )}
                  </div>
                  <span className="board-card__tooltip" role="tooltip">
                    <strong>{dossier.name}</strong>
                    <small>{dossier.dossierType}</small>
                  </span>
                </article>
              ))
            : null}
        </div>
      </section>

      <EvidenceTray
        dossiers={dossiers}
        selectedCategory={selectedCategory}
        isOpen={isTrayOpen}
        isDossierPinned={isDossierPinned}
        onSelectCategory={setSelectedCategory}
        onToggleOpen={() => setIsTrayOpen((currentValue) => !currentValue)}
        onAddToInvestigation={handleAddToInvestigation}
        onRemoveFromInvestigation={(dossier) => removeDossierFromBoard(dossier.id)}
        onOpenDossier={openDossier}
        onTrayDragStart={handleTrayDragStart}
        onTrayDragMove={handleTrayDragMove}
        onTrayDragEnd={handleTrayDragEnd}
        onTrayDragCancel={handleTrayDragCancel}
      />

      {selectedBond ? (
        <aside className="bond-inspector" aria-label="Selected Bond">
          <p>Selected Bond</p>
          <h2>{getBondDisplayLabel(selectedBond)}</h2>
          <span>
            {getDossierById(selectedBond.sourceDossierId)?.name ?? 'Unknown'} /{' '}
            {getDossierById(selectedBond.targetDossierId)?.name ?? 'Unknown'}
          </span>
          {selectedBond.status ? <small>{selectedBond.status}</small> : null}
          <div className="bond-inspector__actions">
            <button type="button" onClick={() => setEditingBond(selectedBond)}>
              Edit
            </button>
            <button type="button" onClick={() => setDeletingBond(selectedBond)}>
              Delete
            </button>
            <button type="button" onClick={() => setSelectedBond(null)}>
              Close
            </button>
          </div>
        </aside>
      ) : null}

      {trayDragState?.didMove ? (
        <div
          className="tray-drag-preview"
          data-valid-drop={trayDragState.isOverBoard ? 'true' : 'false'}
          style={{
            left: `${trayDragState.x}px`,
            top: `${trayDragState.y}px`,
          }}
          aria-hidden="true"
        >
          {trayDragState.dossier.coverImage ? (
            <img
              src={trayDragState.dossier.coverImage}
              alt=""
            />
          ) : (
            <span>{getDossierInitials(trayDragState.dossier.name)}</span>
          )}
        </div>
      ) : null}

      {selectedDossier ? (
        <DossierSheet
          dossier={selectedDossier}
          onClose={closeDossier}
          onDelete={setDeletingDossier}
          isPinned={isDossierPinned(selectedDossier.id)}
          onRemoveFromBoard={handleRemoveDossierFromBoard}
          focusedEvidenceRecordId={focusedEvidenceRecordId}
          onOpenDossier={(dossier, options) => {
            setSelectedDossier(dossier);
            setFocusedEvidenceRecordId(options?.evidenceRecordId ?? null);
          }}
        />
      ) : null}

      {deletingDossier ? (
        <DeleteDossierDialog
          dossier={deletingDossier}
          bondCount={bondsForDossier(deletingDossier.id).length}
          onCancel={() => setDeletingDossier(null)}
          onConfirm={handleDeleteDossier}
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
          sourceDossier={getDossierById(deletingBond.sourceDossierId) ?? undefined}
          targetDossier={getDossierById(deletingBond.targetDossierId) ?? undefined}
          onCancel={() => setDeletingBond(null)}
          onConfirm={handleDeleteBond}
        />
      ) : null}
    </>
  );
}
