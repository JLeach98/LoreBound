import type { LoreCase } from '../../cases/types/caseTypes';

type FieldKitHeaderProps = {
  activeCase: LoreCase | null;
  onOpenSettings: () => void;
  onQuickAdd: () => void;
};

export function FieldKitHeader({ activeCase, onOpenSettings, onQuickAdd }: FieldKitHeaderProps) {
  return (
    <header className="field-kit-header">
      <div>
        <span>Field Kit</span>
        <strong>LoreBound</strong>
        {activeCase ? <small>{activeCase.caseName}</small> : <small>Portable Archive</small>}
      </div>
      <div className="field-kit-header__actions">
        <button type="button" aria-label="Quick Add" onClick={onQuickAdd}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" aria-label="Open Settings" onClick={onOpenSettings}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" />
            <path d="M19.5 12a7.56 7.56 0 0 0-.08-1.08l2.05-1.6-2-3.46-2.42.98a7.5 7.5 0 0 0-1.86-1.08L14.82 3h-4l-.37 2.76a7.5 7.5 0 0 0-1.86 1.08l-2.42-.98-2 3.46 2.05 1.6a7.11 7.11 0 0 0 0 2.16l-2.05 1.6 2 3.46 2.42-.98c.56.45 1.18.82 1.86 1.08l.37 2.76h4l.37-2.76a7.5 7.5 0 0 0 1.86-1.08l2.42.98 2-3.46-2.05-1.6c.05-.35.08-.71.08-1.08Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
