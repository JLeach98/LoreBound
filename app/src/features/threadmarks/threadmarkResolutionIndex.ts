import type {
  ThreadmarkResolutionDossierCandidate,
} from './threadmarkResolverTypes';

export type ThreadmarkResolutionIndex = Readonly<{
  byId: ReadonlyMap<string, ThreadmarkResolutionDossierCandidate>;
  byExactName: ReadonlyMap<string, readonly ThreadmarkResolutionDossierCandidate[]>;
  byCaseInsensitiveName: ReadonlyMap<string, readonly ThreadmarkResolutionDossierCandidate[]>;
  byExactAlias: ReadonlyMap<string, readonly ThreadmarkResolutionDossierCandidate[]>;
  byCaseInsensitiveAlias: ReadonlyMap<string, readonly ThreadmarkResolutionDossierCandidate[]>;
  byKnowledgeType: ReadonlyMap<string, readonly ThreadmarkResolutionDossierCandidate[]>;
  activeCandidates: readonly ThreadmarkResolutionDossierCandidate[];
  invalidCandidateCount: number;
}>;

export function normalizeResolutionText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeResolutionTextCaseFold(value: string) {
  return normalizeResolutionText(value).toLocaleLowerCase();
}

function addToIndex(
  index: Map<string, ThreadmarkResolutionDossierCandidate[]>,
  key: string,
  dossier: ThreadmarkResolutionDossierCandidate,
) {
  if (!key) {
    return;
  }

  index.set(key, [...(index.get(key) ?? []), dossier]);
}

function dossierAliases(dossier: ThreadmarkResolutionDossierCandidate) {
  return [
    dossier.alias,
    ...(dossier.sections ?? [])
      .filter((section) => section.title.toLocaleLowerCase().includes('alias'))
      .flatMap((section) => [
        section.body,
        ...(section.fields ?? []).map((field) => field.value),
      ]),
  ].filter((value): value is string => Boolean(value?.trim()));
}

function isCandidateShapeValid(dossier: ThreadmarkResolutionDossierCandidate) {
  return Boolean(dossier.id && dossier.caseId && dossier.name && dossier.dossierType);
}

export function isThreadmarkResolutionCandidateAvailable(
  dossier?: ThreadmarkResolutionDossierCandidate,
) {
  return Boolean(
    dossier &&
      isCandidateShapeValid(dossier) &&
      !dossier.isDeleted &&
      !dossier.deleted &&
      !dossier.isHidden &&
      !dossier.hidden,
  );
}

export function buildThreadmarkResolutionIndex({
  dossiers,
  activeInvestigationId,
}: {
  dossiers: readonly ThreadmarkResolutionDossierCandidate[];
  activeInvestigationId: string;
}): ThreadmarkResolutionIndex {
  const byId = new Map<string, ThreadmarkResolutionDossierCandidate>();
  const byExactName = new Map<string, ThreadmarkResolutionDossierCandidate[]>();
  const byCaseInsensitiveName = new Map<string, ThreadmarkResolutionDossierCandidate[]>();
  const byExactAlias = new Map<string, ThreadmarkResolutionDossierCandidate[]>();
  const byCaseInsensitiveAlias = new Map<string, ThreadmarkResolutionDossierCandidate[]>();
  const byKnowledgeType = new Map<string, ThreadmarkResolutionDossierCandidate[]>();
  let invalidCandidateCount = 0;

  const activeCandidates = dossiers
    .filter((dossier) => dossier.caseId === activeInvestigationId)
    .filter((dossier) => {
      if (!isCandidateShapeValid(dossier)) {
        invalidCandidateCount += 1;
        return false;
      }

      return true;
    })
    .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));

  activeCandidates.forEach((dossier) => {
    byId.set(dossier.id, dossier);
    addToIndex(byExactName, normalizeResolutionText(dossier.name), dossier);
    addToIndex(byCaseInsensitiveName, normalizeResolutionTextCaseFold(dossier.name), dossier);
    addToIndex(byKnowledgeType, dossier.dossierType, dossier);

    dossierAliases(dossier).forEach((alias) => {
      addToIndex(byExactAlias, normalizeResolutionText(alias), dossier);
      addToIndex(byCaseInsensitiveAlias, normalizeResolutionTextCaseFold(alias), dossier);
    });
  });

  return Object.freeze({
    byId,
    byExactName,
    byCaseInsensitiveName,
    byExactAlias,
    byCaseInsensitiveAlias,
    byKnowledgeType,
    activeCandidates: Object.freeze(activeCandidates),
    invalidCandidateCount,
  });
}

