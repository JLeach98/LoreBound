import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { LoreCase } from '../types/caseTypes';

type DeleteCaseDialogProps = {
  loreCase: LoreCase;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteCaseDialog({
  loreCase,
  onCancel,
  onConfirm,
}: DeleteCaseDialogProps) {
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
      setErrorMessage('The Case could not be deleted. Try again.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="case-dialog-backdrop" role="presentation">
      <section
        className="case-dialog case-dialog--narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-case-title"
      >
        <div className="case-dialog__header">
          <p>Delete File</p>
          <h2 id="delete-case-title">Delete {loreCase.caseName}?</h2>
        </div>
        <p className="case-dialog__copy">
          This removes "{loreCase.caseName}" from this browser. This cannot be undone.
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
            {isDeleting ? 'Deleting...' : 'Delete Case'}
          </button>
        </div>
      </section>
    </div>
  );
}
