import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { CaseFormValues, LoreCase, UniverseType } from '../types/caseTypes';
import { universeTypes } from '../types/caseTypes';
import { CoverImageInput } from './CoverImageInput';

type CaseFormDialogProps = {
  mode: 'create' | 'edit';
  initialCase?: LoreCase;
  onCancel: () => void;
  onSubmit: (values: CaseFormValues) => Promise<void>;
};

export function CaseFormDialog({
  mode,
  initialCase,
  onCancel,
  onSubmit,
}: CaseFormDialogProps) {
  const [caseName, setCaseName] = useState(initialCase?.caseName ?? '');
  const [universeType, setUniverseType] = useState<UniverseType>(
    initialCase?.universeType ?? 'Book',
  );
  const [coverImage, setCoverImage] = useState<string | undefined>(
    initialCase?.coverImage,
  );
  const [authorOrCreator, setAuthorOrCreator] = useState(
    initialCase?.authorOrCreator ?? '',
  );
  const [description, setDescription] = useState(initialCase?.description ?? '');
  const [imageError, setImageError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const trimmedCaseName = caseName.trim();
  const nameError = useMemo(() => {
    if (!caseName) {
      return undefined;
    }

    return trimmedCaseName ? undefined : 'Case Name cannot be blank.';
  }, [caseName, trimmedCaseName]);
  const canSubmit = Boolean(trimmedCaseName) && !imageError && !isSaving;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setSubmitError('Add a Case Name and Universe Type before creating a Case.');
      return;
    }

    setIsSaving(true);
    setSubmitError(undefined);

    try {
      await onSubmit({
        caseName: trimmedCaseName,
        universeType,
        coverImage,
        authorOrCreator,
        description,
      });
    } catch (error) {
      console.error(error);
      setSubmitError('The Case could not be saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="case-dialog-backdrop" role="presentation">
      <section
        className="case-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-dialog-title"
      >
        <form className="case-form" onSubmit={handleSubmit}>
          <div className="case-dialog__header">
            <p>{mode === 'create' ? 'New File' : 'Edit File'}</p>
            <h2 id="case-dialog-title">
              {mode === 'create' ? 'Create New Case' : 'Edit Case'}
            </h2>
          </div>

          <div className="case-form__grid">
            <div className="case-form__field">
              <label htmlFor="case-name">Case Name</label>
              <input
                ref={nameInputRef}
                id="case-name"
                value={caseName}
                onChange={(event) => setCaseName(event.target.value)}
                aria-describedby={nameError ? 'case-name-error' : undefined}
                required
              />
              {nameError ? (
                <p className="case-form__error" id="case-name-error">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="case-form__field">
              <label htmlFor="universe-type">Universe Type</label>
              <select
                id="universe-type"
                value={universeType}
                onChange={(event) => setUniverseType(event.target.value as UniverseType)}
                required
              >
                {universeTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CoverImageInput
            value={coverImage}
            errorMessage={imageError}
            onChange={setCoverImage}
            onError={setImageError}
          />

          <div className="case-form__field">
            <label htmlFor="author-or-creator">Author or Creator</label>
            <input
              id="author-or-creator"
              value={authorOrCreator}
              onChange={(event) => setAuthorOrCreator(event.target.value)}
            />
          </div>

          <div className="case-form__field">
            <label htmlFor="case-description">Description</label>
            <textarea
              id="case-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>

          {submitError ? <p className="case-form__error">{submitError}</p> : null}

          <div className="case-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="brass" disabled={!canSubmit}>
              {isSaving
                ? 'Saving...'
                : mode === 'create'
                  ? 'Create Case'
                  : 'Save Changes'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
