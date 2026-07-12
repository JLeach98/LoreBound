import type { LoreCase } from '../types/caseTypes';

type ActiveCaseFileProps = {
  activeCase: LoreCase;
};

export function ActiveCaseFile({ activeCase }: ActiveCaseFileProps) {
  return (
    <aside className="active-case-file" aria-label="Active Case file">
      <div className="active-case-file__tab">{activeCase.universeType}</div>
      <div className="active-case-file__cover">
        {activeCase.coverImage ? (
          <img src={activeCase.coverImage} alt={`${activeCase.caseName} cover`} />
        ) : (
          <span aria-hidden="true">LB</span>
        )}
      </div>
      <div>
        <p>Active File</p>
        <h2>{activeCase.caseName}</h2>
        <span>
          {activeCase.universeType}
          {activeCase.authorOrCreator ? ` / ${activeCase.authorOrCreator}` : ''}
        </span>
      </div>
    </aside>
  );
}
