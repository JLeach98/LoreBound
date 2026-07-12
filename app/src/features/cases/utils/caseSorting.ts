import type { LoreCase } from '../types/caseTypes';

function sortableDate(loreCase: LoreCase) {
  return loreCase.dateLastOpened ?? loreCase.dateCreated;
}

export function sortCasesByRecentActivity(cases: LoreCase[]) {
  return [...cases].sort(
    (left, right) =>
      new Date(sortableDate(right)).getTime() - new Date(sortableDate(left)).getTime(),
  );
}

export function filterCasesByName(cases: LoreCase[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return cases;
  }

  return cases.filter((loreCase) =>
    loreCase.caseName.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function formatCaseDate(date: string | null) {
  if (!date) {
    return 'Never opened';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
