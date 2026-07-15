import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type {
  CharacterStatus,
  Dossier,
  DossierFormValues,
  DossierType,
  TheoryConfidence,
  TheoryStatus,
} from '../types/dossierTypes';
import { dossierTypeLabels } from '../types/dossierTypes';
import { mergeDossierSectionsWithFormValues } from '../utils/dossierSections';
import { CoverImageInput } from './CoverImageInput';

type DossierFormDialogProps = {
  dossierType: DossierType;
  initialDossier?: Dossier;
  initialName?: string;
  onCancel: () => void;
  onSubmit: (values: DossierFormValues) => Promise<void>;
};

export function DossierFormDialog({
  dossierType,
  initialDossier,
  initialName = '',
  onCancel,
  onSubmit,
}: DossierFormDialogProps) {
  const [name, setName] = useState(initialDossier?.name ?? initialName);
  const [coverImage, setCoverImage] = useState<string | undefined>(
    initialDossier?.coverImage,
  );
  const [summary, setSummary] = useState(initialDossier?.summary ?? '');
  const [notes, setNotes] = useState(initialDossier?.notes ?? '');
  const [alias, setAlias] = useState(initialDossier?.alias ?? '');
  const [characterStatus, setCharacterStatus] = useState<CharacterStatus>(
    initialDossier?.characterStatus ?? 'Unknown',
  );
  const [affiliation, setAffiliation] = useState(initialDossier?.affiliation ?? '');
  const [region, setRegion] = useState(initialDossier?.region ?? '');
  const [world, setWorld] = useState(initialDossier?.world ?? '');
  const [eventDate, setEventDate] = useState(initialDossier?.eventDate ?? '');
  const [era, setEra] = useState(initialDossier?.era ?? '');
  const [leader, setLeader] = useState(initialDossier?.leader ?? '');
  const [organizationType, setOrganizationType] = useState(
    initialDossier?.organizationType ?? '',
  );
  const [theoryConfidence, setTheoryConfidence] = useState<TheoryConfidence>(
    initialDossier?.theoryConfidence ?? 'Medium',
  );
  const [theoryStatus, setTheoryStatus] = useState<TheoryStatus>(
    initialDossier?.theoryStatus ?? 'Open',
  );
  const [imageError, setImageError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameError = useMemo(() => {
    if (!name) {
      return undefined;
    }

    return trimmedName ? undefined : 'Name cannot be blank.';
  }, [name, trimmedName]);
  const canSubmit = Boolean(trimmedName) && !imageError && !isSaving;

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
      setSubmitError('Add a Name before saving this Dossier.');
      return;
    }

    setIsSaving(true);
    setSubmitError(undefined);

    try {
      const values: DossierFormValues = {
        dossierType,
        name: trimmedName,
        coverImage,
        summary,
        notes,
        alias,
        characterStatus,
        affiliation,
        region,
        world,
        eventDate,
        era,
        leader,
        organizationType,
        theoryConfidence,
        theoryStatus,
      };

      await onSubmit({
        ...values,
        sections: initialDossier
          ? mergeDossierSectionsWithFormValues(initialDossier, values)
          : undefined,
      });
    } catch (error) {
      console.error(error);
      setSubmitError('The Dossier could not be saved. Try again.');
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
        aria-labelledby="dossier-dialog-title"
      >
        <form className="case-form" onSubmit={handleSubmit}>
          <div className="case-dialog__header">
            <p>{initialDossier ? 'Edit Dossier' : 'New Dossier'}</p>
            <h2 id="dossier-dialog-title">
              {initialDossier ? 'Edit' : 'Create'} {dossierTypeLabels[dossierType]}
            </h2>
          </div>

          <div className="case-form__field">
            <label htmlFor="dossier-name">Name</label>
            <input
              ref={nameInputRef}
              id="dossier-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby={nameError ? 'dossier-name-error' : undefined}
              required
            />
            {nameError ? (
              <p className="case-form__error" id="dossier-name-error">
                {nameError}
              </p>
            ) : null}
          </div>

          <CoverImageInput
            value={coverImage}
            errorMessage={imageError}
            onChange={setCoverImage}
            onError={setImageError}
          />

          {dossierType === 'Character' ? (
            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="alias">Alias</label>
                <input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} />
              </div>
              <div className="case-form__field">
                <label htmlFor="character-status">Status</label>
                <select
                  id="character-status"
                  value={characterStatus}
                  onChange={(event) =>
                    setCharacterStatus(event.target.value as CharacterStatus)
                  }
                >
                  <option value="Alive">Alive</option>
                  <option value="Deceased">Deceased</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div className="case-form__field">
                <label htmlFor="affiliation">Affiliation</label>
                <input
                  id="affiliation"
                  value={affiliation}
                  onChange={(event) => setAffiliation(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {dossierType === 'Location' ? (
            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="region">Region</label>
                <input id="region" value={region} onChange={(event) => setRegion(event.target.value)} />
              </div>
              <div className="case-form__field">
                <label htmlFor="world">World</label>
                <input id="world" value={world} onChange={(event) => setWorld(event.target.value)} />
              </div>
            </div>
          ) : null}

          {dossierType === 'Event' ? (
            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="event-date">Date</label>
                <input
                  id="event-date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                />
              </div>
              <div className="case-form__field">
                <label htmlFor="era">Era</label>
                <input id="era" value={era} onChange={(event) => setEra(event.target.value)} />
              </div>
            </div>
          ) : null}

          {dossierType === 'Organization' ? (
            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="leader">Leader</label>
                <input id="leader" value={leader} onChange={(event) => setLeader(event.target.value)} />
              </div>
              <div className="case-form__field">
                <label htmlFor="organization-type">Type</label>
                <input
                  id="organization-type"
                  value={organizationType}
                  onChange={(event) => setOrganizationType(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {dossierType === 'Theory' ? (
            <div className="case-form__grid">
              <div className="case-form__field">
                <label htmlFor="theory-confidence">Confidence</label>
                <select
                  id="theory-confidence"
                  value={theoryConfidence}
                  onChange={(event) =>
                    setTheoryConfidence(event.target.value as TheoryConfidence)
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="case-form__field">
                <label htmlFor="theory-status">Status</label>
                <select
                  id="theory-status"
                  value={theoryStatus}
                  onChange={(event) => setTheoryStatus(event.target.value as TheoryStatus)}
                >
                  <option value="Open">Open</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Disproven">Disproven</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="case-form__field">
            <label htmlFor="dossier-summary">Summary</label>
            <textarea
              id="dossier-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
            />
          </div>

          <div className="case-form__field">
            <label htmlFor="dossier-notes">Notes</label>
            <textarea
              id="dossier-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          </div>

          {submitError ? <p className="case-form__error">{submitError}</p> : null}

          <div className="case-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="brass" disabled={!canSubmit}>
              {isSaving ? 'Saving...' : 'Save Dossier'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
