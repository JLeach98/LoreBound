import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { Bond } from '../types/bondTypes';
import type { Dossier } from '../types/dossierTypes';

type DeleteBondDialogProps = {
  bond: Bond;
  sourceDossier?: Dossier;
  targetDossier?: Dossier;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteBondDialog({
  bond,
  sourceDossier,
  targetDossier,
  onCancel,
  onConfirm,
}: DeleteBondDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  async function handleConfirm() {
    setIsDeleting(true);
    setErrorMessage(undefined);

    try {
      await onConfirm();
    } catch (error) {
      console.error(error);
      setErrorMessage('The Bond could not be deleted. Try again.');
      setIsDeleting(false);
    }
  }

  const sourceName = sourceDossier?.name ?? 'Unknown source';
  const targetName = targetDossier?.name ?? 'Unknown target';

  return (
    <div className="case-dialog-backdrop" role="presentation">
      <section
        className="case-dialog case-dialog--narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-bond-title"
      >
        <div className="case-dialog__header">
          <p>Delete Bond</p>
          <h2 id="delete-bond-title">Delete {bond.bondType}?</h2>
        </div>
        <p className="case-dialog__copy">
          This removes the Bond between "{sourceName}" and "{targetName}". The Dossiers
          remain in the Case.
        </p>
        {errorMessage ? <p className="case-form__error">{errorMessage}</p> : null}
        <div className="case-dialog__actions">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <button
            type="button"
            className="danger-button"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Bond'}
          </button>
        </div>
      </section>
    </div>
  );
}
