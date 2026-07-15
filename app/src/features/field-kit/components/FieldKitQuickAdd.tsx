import type { DossierType } from '../../cases/types/dossierTypes';
import { fieldKitDossierTypes } from '../utils/fieldKitFormat';

type FieldKitQuickAddProps = {
  onChoose: (dossierType: DossierType) => void;
  onClose: () => void;
};

export function FieldKitQuickAdd({ onChoose, onClose }: FieldKitQuickAddProps) {
  return (
    <div className="field-kit-sheet-backdrop" role="presentation">
      <section className="field-kit-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <header>
          <div>
            <span>Quick Add</span>
            <h2 id="quick-add-title">Capture Dossier</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="field-kit-quick-grid">
          {fieldKitDossierTypes.map((type) => (
            <button key={type} type="button" onClick={() => onChoose(type)}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M5 4.5h9l5 5v10H5zM14 4.5v5h5M8 14h8M8 17h5" />
              </svg>
              <span>{type}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
