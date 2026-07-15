import {
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { Button } from '../../../components/ui/Button';
import { useBoard } from '../../cases/context/BoardContext';
import { useBonds } from '../../cases/context/BondContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { BoardPin } from '../../cases/types/boardTypes';
import type { Dossier } from '../../cases/types/dossierTypes';
import { getBondLabel } from '../utils/fieldKitFormat';
import { FieldKitThumbnail } from './FieldKitThumbnail';

type FieldKitBoardProps = {
  onOpenDossier: (dossier: Dossier) => void;
  onBrowseDossiers: () => void;
};

type ViewState = {
  x: number;
  y: number;
  scale: number;
};

const boardSize = 1000;

export function FieldKitBoard({ onOpenDossier, onBrowseDossiers }: FieldKitBoardProps) {
  const { dossiers } = useDossiers();
  const { bonds } = useBonds();
  const { boardPins, movePin } = useBoard();
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, scale: 0.72 });
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const gestureRef = useRef<
    | { mode: 'pan'; startX: number; startY: number; originX: number; originY: number }
    | { mode: 'pinch'; startDistance: number; originScale: number }
    | { mode: 'drag'; pinId: string; pointerId: number }
    | null
  >(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const viewportRef = useRef<HTMLDivElement>(null);

  const pinnedDossiers = useMemo(
    () =>
      boardPins
        .map((pin) => ({
          pin,
          dossier: dossiers.find((dossier) => dossier.id === pin.dossierId) ?? null,
        }))
        .filter((entry): entry is { pin: BoardPin; dossier: Dossier } => Boolean(entry.dossier)),
    [boardPins, dossiers],
  );

  const selectedEntry = pinnedDossiers.find((entry) => entry.pin.id === selectedPinId) ?? null;

  function fitEvidence() {
    if (pinnedDossiers.length === 0 || !viewportRef.current) {
      setViewState({ x: 0, y: 0, scale: 0.72 });
      return;
    }

    const xs = pinnedDossiers.map(({ pin }) => pin.position.x * boardSize);
    const ys = pinnedDossiers.map(({ pin }) => pin.position.y * boardSize);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rect = viewportRef.current.getBoundingClientRect();
    const contentWidth = Math.max(220, maxX - minX + 180);
    const contentHeight = Math.max(220, maxY - minY + 180);
    const nextScale = Math.min(1.2, Math.max(0.42, Math.min(rect.width / contentWidth, rect.height / contentHeight)));

    setViewState({
      scale: nextScale,
      x: rect.width / 2 - ((minX + maxX) / 2) * nextScale,
      y: rect.height / 2 - ((minY + maxY) / 2) * nextScale,
    });
  }

  function resetView() {
    setViewState({ x: 0, y: 0, scale: 0.72 });
  }

  function handleViewportPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.field-kit-board-card')) {
      return;
    }

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      const [firstPointer, secondPointer] = Array.from(pointersRef.current.values());
      gestureRef.current = {
        mode: 'pinch',
        startDistance: Math.hypot(
          secondPointer.x - firstPointer.x,
          secondPointer.y - firstPointer.y,
        ),
        originScale: viewState.scale,
      };
      return;
    }

    gestureRef.current = {
      mode: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewState.x,
      originY: viewState.y,
    };
  }

  function handleViewportPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    if (gesture.mode === 'pinch' && pointersRef.current.size >= 2) {
      const [firstPointer, secondPointer] = Array.from(pointersRef.current.values());
      const currentDistance = Math.hypot(
        secondPointer.x - firstPointer.x,
        secondPointer.y - firstPointer.y,
      );
      const nextScale = gesture.originScale * (currentDistance / Math.max(1, gesture.startDistance));

      setViewState((current) => ({
        ...current,
        scale: Math.min(1.8, Math.max(0.38, nextScale)),
      }));
      return;
    }

    if (gesture.mode === 'pan') {
      setViewState((current) => ({
        ...current,
        x: gesture.originX + event.clientX - gesture.startX,
        y: gesture.originY + event.clientY - gesture.startY,
      }));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;

    setViewState((current) => ({
      ...current,
      scale: Math.min(1.8, Math.max(0.38, current.scale + direction)),
    }));
  }

  async function handlePinPointerMove(event: PointerEvent<HTMLButtonElement>, pin: BoardPin) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.mode !== 'drag' || gesture.pinId !== pin.id || !isArrangeMode) {
      return;
    }

    const boardRect = viewportRef.current?.getBoundingClientRect();

    if (!boardRect) {
      return;
    }

    const nextX = Math.min(0.96, Math.max(0.04, (event.clientX - boardRect.left - viewState.x) / viewState.scale / boardSize));
    const nextY = Math.min(0.96, Math.max(0.04, (event.clientY - boardRect.top - viewState.y) / viewState.scale / boardSize));

    await movePin(pin.id, { x: nextX, y: nextY });
  }

  return (
    <section className="field-kit-board" aria-labelledby="field-kit-board-title">
      <header className="field-kit-panel__header">
        <div>
          <span>Evidence Board</span>
          <h2 id="field-kit-board-title">Board Review</h2>
        </div>
        <Button
          type="button"
          variant={isArrangeMode ? 'brass' : 'secondary'}
          onClick={() => setIsArrangeMode((current) => !current)}
        >
          {isArrangeMode ? 'Done' : 'Arrange'}
        </Button>
      </header>

      <div className="field-kit-board__tools">
        <Button type="button" variant="secondary" onClick={fitEvidence}>
          Fit Evidence
        </Button>
        <Button type="button" variant="ghost" onClick={resetView}>
          Reset View
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="field-kit-board__viewport"
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className="field-kit-board__surface"
          style={{
            width: boardSize,
            height: boardSize,
            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
          }}
        >
          <svg className="field-kit-board__threads" viewBox={`0 0 ${boardSize} ${boardSize}`} aria-hidden="true">
            {bonds.map((bond) => {
              const sourcePin = boardPins.find((pin) => pin.dossierId === bond.sourceDossierId);
              const targetPin = boardPins.find((pin) => pin.dossierId === bond.targetDossierId);

              if (!sourcePin || !targetPin) {
                return null;
              }

              return (
                <line
                  key={bond.id}
                  x1={sourcePin.position.x * boardSize}
                  y1={sourcePin.position.y * boardSize}
                  x2={targetPin.position.x * boardSize}
                  y2={targetPin.position.y * boardSize}
                />
              );
            })}
          </svg>
          {pinnedDossiers.map(({ pin, dossier }) => (
            <button
              key={pin.id}
              type="button"
              className={`field-kit-board-card${selectedPinId === pin.id ? ' field-kit-board-card--selected' : ''}`}
              style={{
                left: `${pin.position.x * boardSize}px`,
                top: `${pin.position.y * boardSize}px`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedPinId(pin.id);

                if (isArrangeMode) {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  gestureRef.current = { mode: 'drag', pinId: pin.id, pointerId: event.pointerId };
                }
              }}
              onPointerMove={(event) => void handlePinPointerMove(event, pin)}
              onPointerUp={() => {
                gestureRef.current = null;
              }}
              onDoubleClick={() => onOpenDossier(dossier)}
            >
              <span className="field-kit-board-card__pin" />
              <FieldKitThumbnail image={dossier.coverImage} name={dossier.name} />
            </button>
          ))}
        </div>
        {pinnedDossiers.length === 0 ? (
          <div className="field-kit-board-empty">
            <h3>No Evidence Pinned</h3>
            <p>Pin Dossiers to begin assembling this Investigation.</p>
            <Button type="button" variant="brass" onClick={onBrowseDossiers}>
              Browse Dossiers
            </Button>
          </div>
        ) : null}
      </div>

      {selectedEntry ? (
        <aside className="field-kit-board-inspector" aria-live="polite">
          <div>
            <span>{selectedEntry.dossier.dossierType}</span>
            <strong>{selectedEntry.dossier.name}</strong>
            <small>
              {bonds
                .filter(
                  (bond) =>
                    bond.sourceDossierId === selectedEntry.dossier.id ||
                    bond.targetDossierId === selectedEntry.dossier.id,
                )
                .map((bond) => getBondLabel(bond, selectedEntry.dossier.id))
                .slice(0, 2)
                .join(', ') || 'No Bonds on Board'}
            </small>
          </div>
          <Button type="button" variant="brass" onClick={() => onOpenDossier(selectedEntry.dossier)}>
            Open Dossier
          </Button>
        </aside>
      ) : null}
    </section>
  );
}
