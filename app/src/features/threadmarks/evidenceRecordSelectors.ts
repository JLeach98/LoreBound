import type { EvidenceRecord } from './evidenceRecordTypes';

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
