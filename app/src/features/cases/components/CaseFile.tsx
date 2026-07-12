import type { LoreCase } from '../types/caseTypes';
import { formatCaseDate } from '../utils/caseSorting';

type CaseFileProps = {
  loreCase: LoreCase;
  onOpen: (id: string) => void;
  onEdit: (loreCase: LoreCase) => void;
  onDelete: (loreCase: LoreCase) => void;
};

export function CaseFile({ loreCase, onOpen, onEdit, onDelete }: CaseFileProps) {
  return (
    <article className="case-file-card">
      <div className="case-file-card__tab">{loreCase.universeType}</div>
      <div className="case-file-card__body">
        {loreCase.coverImage ? (
          <img
            className="case-file-card__cover"
            src={loreCase.coverImage}
            alt={`${loreCase.caseName} cover`}
          />
        ) : (
          <div className="case-file-card__cover-placeholder" aria-hidden="true">
            LB
          </div>
        )}
        <div className="case-file-card__content">
          <h3>{loreCase.caseName}</h3>
          <p>{loreCase.universeType}</p>
          {loreCase.authorOrCreator ? <p>{loreCase.authorOrCreator}</p> : null}
          <p>Last opened: {formatCaseDate(loreCase.dateLastOpened)}</p>
        </div>
      </div>
      <div className="case-file-card__actions">
        <button type="button" onClick={() => onOpen(loreCase.id)}>
          Open Case
        </button>
        <button type="button" onClick={() => onEdit(loreCase)}>
          Edit
        </button>
        <button type="button" className="case-file-card__delete" onClick={() => onDelete(loreCase)}>
          Delete
        </button>
      </div>
    </article>
  );
}
