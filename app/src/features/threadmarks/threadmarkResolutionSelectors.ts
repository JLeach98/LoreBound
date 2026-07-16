import type {
  ThreadmarkResolutionCandidate,
  ThreadmarkResolutionDossierCandidate,
} from './threadmarkResolverTypes';

export function summarizeResolutionCandidate(
  dossier: ThreadmarkResolutionDossierCandidate,
): ThreadmarkResolutionCandidate {
  const distinguishingMetadata =
    dossier.affiliation ??
    dossier.region ??
    dossier.world ??
    dossier.leader ??
    dossier.organizationType ??
    dossier.eventDate ??
    dossier.era ??
    dossier.theoryStatus;

  return Object.freeze({
    dossierId: dossier.id,
    displayName: dossier.name,
    knowledgeType: dossier.dossierType,
    distinguishingMetadata,
  });
}

export function summarizeResolutionCandidates(
  dossiers: readonly ThreadmarkResolutionDossierCandidate[],
) {
  return Object.freeze(dossiers.map(summarizeResolutionCandidate));
}

