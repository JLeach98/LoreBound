import { Button } from '../../../components/ui/Button';
import { useEffect, useMemo, useRef } from 'react';
import type { Dossier } from '../types/dossierTypes';
import { dossierTypeLabels } from '../types/dossierTypes';

type DossierSheetProps = {
  dossier: Dossier;
  onClose: () => void;
  onEdit: (dossier: Dossier) => void;
  onDelete: (dossier: Dossier) => void;
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

export function DossierSheet({ dossier, onClose, onEdit, onDelete }: DossierSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const keyFacts = useMemo(
    () => keyFactsForDossier(dossier).filter((field) => field.value),
    [dossier],
  );
  const hasImage = Boolean(dossier.coverImage);

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
            <Button type="button" variant="brass" onClick={() => onEdit(dossier)}>
              Edit
            </Button>
            <button type="button" className="danger-button" onClick={() => onDelete(dossier)}>
              Delete
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
