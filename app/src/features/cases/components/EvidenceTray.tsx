import type { PointerEvent } from 'react';
import type { Dossier, DossierType } from '../types/dossierTypes';
import { dossierTypeLabels, dossierTypes } from '../types/dossierTypes';

type EvidenceTrayProps = {
  dossiers: Dossier[];
  selectedCategory: DossierType;
  isOpen: boolean;
  isDossierPinned: (dossierId: string) => boolean;
  onSelectCategory: (category: DossierType) => void;
  onToggleOpen: () => void;
  onAddToInvestigation: (dossier: Dossier) => void;
  onRemoveFromInvestigation: (dossier: Dossier) => void;
  onOpenDossier: (dossier: Dossier, opener: HTMLElement) => void;
  onTrayDragStart: (dossier: Dossier, event: PointerEvent<HTMLElement>) => void;
  onTrayDragMove: (dossier: Dossier, event: PointerEvent<HTMLElement>) => void;
  onTrayDragEnd: (dossier: Dossier, event: PointerEvent<HTMLElement>) => void;
  onTrayDragCancel: () => void;
};

function getDossierSecondaryText(dossier: Dossier) {
  if (dossier.dossierType === 'Character') {
    return [dossier.alias, dossier.characterStatus, dossier.affiliation]
      .filter(Boolean)
      .join(' / ');
  }

  if (dossier.dossierType === 'Location') {
    return [dossier.region, dossier.world].filter(Boolean).join(' / ');
  }

  if (dossier.dossierType === 'Event') {
    return [dossier.eventDate, dossier.era].filter(Boolean).join(' / ');
  }

  if (dossier.dossierType === 'Organization') {
    return [dossier.leader, dossier.organizationType].filter(Boolean).join(' / ');
  }

  return [dossier.theoryConfidence, dossier.theoryStatus].filter(Boolean).join(' / ');
}

const categoryLabels: Record<DossierType, string> = {
  Character: 'Characters',
  Location: 'Locations',
  Event: 'Events',
  Organization: 'Organizations',
  Theory: 'Theories',
};

export function EvidenceTray({
  dossiers,
  selectedCategory,
  isOpen,
  isDossierPinned,
  onSelectCategory,
  onToggleOpen,
  onAddToInvestigation,
  onRemoveFromInvestigation,
  onOpenDossier,
  onTrayDragStart,
  onTrayDragMove,
  onTrayDragEnd,
  onTrayDragCancel,
}: EvidenceTrayProps) {
  const visibleDossiers = dossiers.filter(
    (dossier) => dossier.dossierType === selectedCategory,
  );

  return (
    <aside className="evidence-tray" aria-label="Evidence tray" data-open={isOpen}>
      <div className="evidence-tray__handle">
        <button
          type="button"
          className="evidence-tray__toggle"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
        >
          Evidence Tray
        </button>
      </div>

      {isOpen ? (
        <div className="evidence-tray__content">
          <div
            className="evidence-tray__categories"
            role="tablist"
            aria-label="Dossier categories"
          >
            {dossierTypes.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selectedCategory === type}
                onClick={() => onSelectCategory(type)}
              >
                {categoryLabels[type]}
              </button>
            ))}
          </div>

          <div className="evidence-tray__items" aria-label={`${selectedCategory} Dossiers`}>
            {visibleDossiers.length === 0 ? (
              <p className="evidence-tray__empty">
                No {dossierTypeLabels[selectedCategory]} records are available.
              </p>
            ) : null}

            {visibleDossiers.map((dossier) => {
              const isPinned = isDossierPinned(dossier.id);

              return (
                <article
                  key={dossier.id}
                  className="evidence-tray__item"
                  data-pinned={isPinned ? 'true' : 'false'}
                  onPointerDown={(event) => onTrayDragStart(dossier, event)}
                  onPointerMove={(event) => onTrayDragMove(dossier, event)}
                  onPointerUp={(event) => onTrayDragEnd(dossier, event)}
                  onPointerCancel={onTrayDragCancel}
                >
                  {dossier.coverImage ? (
                    <img src={dossier.coverImage} alt={`${dossier.name} cover`} />
                  ) : (
                    <span className="evidence-tray__fallback" aria-hidden="true">
                      {dossier.dossierType.slice(0, 2)}
                    </span>
                  )}
                  <div className="evidence-tray__item-copy">
                    <strong>{dossier.name}</strong>
                    {getDossierSecondaryText(dossier) ? (
                      <span>{getDossierSecondaryText(dossier)}</span>
                    ) : null}
                    <small>
                      {isPinned ? 'In Investigation' : dossierTypeLabels[dossier.dossierType]}
                    </small>
                  </div>
                  <div className="evidence-tray__actions">
                    <button
                      type="button"
                      aria-label={`Open ${dossier.name}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => onOpenDossier(dossier, event.currentTarget)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M7 4.5h7l3 3v12H7z" />
                        <path d="M14 4.5v3h3M9.5 12h5M9.5 15h5" />
                      </svg>
                      <span>Open</span>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        isPinned
                          ? `Remove ${dossier.name} from Investigation`
                          : `Add ${dossier.name} to Investigation`
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() =>
                        isPinned
                          ? onRemoveFromInvestigation(dossier)
                          : onAddToInvestigation(dossier)
                      }
                    >
                      {isPinned ? 'Remove' : 'Add'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
