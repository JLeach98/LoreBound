import type { EvidenceRecord } from './evidenceRecordTypes';
import type { Dossier, DossierSection } from '../cases/types/dossierTypes';
import { parseThreadmarks } from './threadmarkParser';
import { resolveThreadmarkDocument } from './threadmarkResolver';

export type EvidenceLogEntry = {
  record: EvidenceRecord;
  originDossier: Dossier;
};

export function getEvidenceRecordsByCaseId(records: readonly EvidenceRecord[], caseId: string) {
  return records.filter((record) => record.caseId === caseId);
}

export function getEvidenceRecordsByTargetDossierId(records: readonly EvidenceRecord[], targetDossierId: string) {
  return records.filter((record) => record.targetDossierId === targetDossierId);
}

export function getEvidenceRecordsByOriginDossierId(records: readonly EvidenceRecord[], originDossierId: string) {
  return records.filter((record) => record.originDossierId === originDossierId);
}

export function getEvidenceRecordsByOriginSectionId(records: readonly EvidenceRecord[], originSectionId: string) {
  return records.filter((record) => record.originSectionId === originSectionId);
}

export function getActiveEvidenceRecords(records: readonly EvidenceRecord[]) {
  return records.filter((record) => record.status === 'active');
}

export function getEvidenceLogEntries({
  records,
  dossiers,
  caseId,
  targetDossierId,
}: {
  records: readonly EvidenceRecord[];
  dossiers: readonly Dossier[];
  caseId: string;
  targetDossierId: string;
}): EvidenceLogEntry[] {
  const dossiersById = new Map(
    dossiers
      .filter((dossier) => dossier.caseId === caseId)
      .map((dossier) => [dossier.id, dossier]),
  );

  return records
    .filter((record) => record.status === 'active')
    .filter((record) => record.caseId === caseId)
    .filter((record) => record.targetDossierId === targetDossierId)
    .map((record) => {
      const originDossier = dossiersById.get(record.originDossierId);
      return originDossier ? { record, originDossier } : null;
    })
    .filter((entry): entry is EvidenceLogEntry => Boolean(entry))
    .sort(
      (left, right) =>
        new Date(left.record.createdAt).getTime() - new Date(right.record.createdAt).getTime(),
    );
}

export function formatEvidenceLogSelectedText(value: string, maxLength = 250) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function hasDuplicateEvidenceRecord(
  records: readonly EvidenceRecord[],
  incomingRecord: Pick<
    EvidenceRecord,
    | 'caseId'
    | 'originDossierId'
    | 'originSectionId'
    | 'targetDossierId'
    | 'anchorStart'
    | 'anchorEnd'
  >,
) {
  return records.some(
    (record) =>
      record.caseId === incomingRecord.caseId &&
      record.originDossierId === incomingRecord.originDossierId &&
      record.originSectionId === incomingRecord.originSectionId &&
      record.targetDossierId === incomingRecord.targetDossierId &&
      record.anchorStart === incomingRecord.anchorStart &&
      record.anchorEnd === incomingRecord.anchorEnd,
  );
}

export function createEvidenceAnchorContext(text: string, start: number, end: number) {
  return {
    prefix: text.slice(Math.max(0, start - 32), start),
    suffix: text.slice(end, Math.min(text.length, end + 32)),
  };
}

function findUniqueMatch(text: string, needle: string, prefix: string, suffix: string) {
  if (!needle) {
    return null;
  }

  const matches: Array<{ start: number; end: number; score: number }> = [];
  let searchOffset = 0;

  while (searchOffset <= text.length) {
    const start = text.indexOf(needle, searchOffset);

    if (start === -1) {
      break;
    }

    const end = start + needle.length;
    const hasPrefix = prefix ? text.slice(Math.max(0, start - prefix.length), start) === prefix : true;
    const hasSuffix = suffix ? text.slice(end, end + suffix.length) === suffix : true;
    const score = Number(hasPrefix) + Number(hasSuffix);

    if (score > 0 || (!prefix && !suffix)) {
      matches.push({ start, end, score });
    }

    searchOffset = start + Math.max(1, needle.length);
  }

  const bestScore = Math.max(0, ...matches.map((match) => match.score));
  const bestMatches = matches.filter((match) => match.score === bestScore);

  return bestMatches.length === 1 ? bestMatches[0] : null;
}

function findChangeWindow(previousText: string, updatedText: string) {
  let prefixLength = 0;

  while (
    prefixLength < previousText.length &&
    prefixLength < updatedText.length &&
    previousText[prefixLength] === updatedText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffix = previousText.length;
  let updatedSuffix = updatedText.length;

  while (
    previousSuffix > prefixLength &&
    updatedSuffix > prefixLength &&
    previousText[previousSuffix - 1] === updatedText[updatedSuffix - 1]
  ) {
    previousSuffix -= 1;
    updatedSuffix -= 1;
  }

  return {
    previousStart: prefixLength,
    previousEnd: previousSuffix,
    updatedStart: prefixLength,
    updatedEnd: updatedSuffix,
    delta: updatedText.length - previousText.length,
  };
}

export function reconcileEvidenceRecordsForSection({
  records,
  originSectionId,
  previousText,
  updatedText,
  updatedAt,
}: {
  records: readonly EvidenceRecord[];
  originSectionId: string;
  previousText: string;
  updatedText: string;
  updatedAt: string;
}) {
  if (previousText === updatedText) {
    return [];
  }

  const change = findChangeWindow(previousText, updatedText);

  return records
    .filter((record) => record.originSectionId === originSectionId && record.status === 'active')
    .map((record) => {
      let nextStart = record.anchorStart;
      let nextEnd = record.anchorEnd;

      if (change.previousEnd <= record.anchorStart) {
        nextStart += change.delta;
        nextEnd += change.delta;
      }

      if (change.previousStart >= record.anchorEnd) {
        nextStart = record.anchorStart;
        nextEnd = record.anchorEnd;
      }

      const expectedText = updatedText.slice(Math.max(0, nextStart), Math.max(0, nextEnd));

      if (expectedText === record.selectedText && nextStart >= 0) {
        return {
          ...record,
          anchorStart: nextStart,
          anchorEnd: nextEnd,
          anchorContext: createEvidenceAnchorContext(updatedText, nextStart, nextEnd),
          updatedAt,
          status: 'active' as const,
        };
      }

      const contextMatch = findUniqueMatch(
        updatedText,
        record.selectedText,
        record.anchorContext.prefix,
        record.anchorContext.suffix,
      );

      if (contextMatch) {
        return {
          ...record,
          anchorStart: contextMatch.start,
          anchorEnd: contextMatch.end,
          anchorContext: createEvidenceAnchorContext(updatedText, contextMatch.start, contextMatch.end),
          updatedAt,
          status: 'active' as const,
        };
      }

      return {
        ...record,
        status: 'orphaned' as const,
        updatedAt,
      };
    });
}

export function createMissingEvidenceRecordsFromThreadmarks({
  records,
  sourceDossier,
  sections,
  dossiers,
  updatedAt,
  createId,
}: {
  records: readonly EvidenceRecord[];
  sourceDossier: Dossier;
  sections: readonly DossierSection[];
  dossiers: readonly Dossier[];
  updatedAt: string;
  createId: () => string;
}) {
  const activeCaseDossiers = dossiers.filter((dossier) => dossier.caseId === sourceDossier.caseId);
  const existingRecords: EvidenceRecord[] = [...records];
  const createdRecords: EvidenceRecord[] = [];

  sections.forEach((section) => {
    const text = section.body ?? '';

    if (!text.trim()) {
      return;
    }

    const occurrences = parseThreadmarks(text);
    const resolution = resolveThreadmarkDocument({
      occurrences,
      sourceDossier,
      activeInvestigationId: sourceDossier.caseId,
      dossiers: activeCaseDossiers,
    });

    resolution.results.forEach((result, index) => {
      const occurrence = occurrences[index];

      if (!occurrence || result.status !== 'resolved' || !result.targetDossierId) {
        return;
      }

      const incoming = {
        caseId: sourceDossier.caseId,
        originDossierId: sourceDossier.id,
        originSectionId: section.id,
        targetDossierId: result.targetDossierId,
        anchorStart: occurrence.startOffset,
        anchorEnd: occurrence.endOffset,
      };

      if (hasDuplicateEvidenceRecord(existingRecords, incoming)) {
        return;
      }

      const record: EvidenceRecord = {
        id: createId(),
        ...incoming,
        selectedText: occurrence.rawText,
        anchorContext: createEvidenceAnchorContext(text, occurrence.startOffset, occurrence.endOffset),
        metadata: {
          relationshipKey: result.relationshipKey,
          targetDisplayName: result.targetDisplayName,
        },
        status: 'active',
        createdAt: updatedAt,
        updatedAt,
      };

      existingRecords.push(record);
      createdRecords.push(record);
    });
  });

  return createdRecords;
}
