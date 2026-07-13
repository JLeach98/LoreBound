import { supabase } from '../../lib/supabase';
import { boardRepository } from '../../repositories/BoardRepository';
import { bondRepository } from '../../repositories/BondRepository';
import { caseRepository } from '../../repositories/CaseRepository';
import { dossierRepository } from '../../repositories/DossierRepository';

type PreviewCollection = 'cases' | 'dossiers' | 'bonds' | 'boardEntries';

export type PreviewComparison = {
  localOnly: number;
  cloudOnly: number;
  matching: number;
  potentialConflicts: number;
  duplicateRisk: number;
};

export type FirstSyncPreview = {
  local: {
    caseCount: number;
    dossierCount: number;
    bondCount: number;
    boardEntryCount: number;
    localImageCount: number;
    estimatedUploadBytes: number;
  };
  cloud: {
    isAvailable: boolean;
    caseCount: number;
    dossierCount: number;
    bondCount: number;
    boardEntryCount: number;
  };
  comparison: Record<PreviewCollection, PreviewComparison>;
  message: string;
};

type RecordSnapshot = {
  id: string;
  updatedAt?: string | null;
  payload?: unknown;
};

type CloudSnapshot = {
  id: string;
  updated_at: string | null;
};

const emptyComparison: PreviewComparison = {
  localOnly: 0,
  cloudOnly: 0,
  matching: 0,
  potentialConflicts: 0,
  duplicateRisk: 0,
};

function emptyComparisons(): Record<PreviewCollection, PreviewComparison> {
  return {
    cases: { ...emptyComparison },
    dossiers: { ...emptyComparison },
    bonds: { ...emptyComparison },
    boardEntries: { ...emptyComparison },
  };
}

function estimateStringBytes(value: string) {
  return new Blob([value]).size;
}

function estimateOptionalImageBytes(value?: string) {
  return value ? estimateStringBytes(value) : 0;
}

function hasMeaningfullyDifferentTimestamp(localValue?: string | null, cloudValue?: string | null) {
  if (!localValue || !cloudValue) {
    return false;
  }

  return Math.abs(new Date(localValue).getTime() - new Date(cloudValue).getTime()) > 1000;
}

function compareSnapshots(
  localRecords: RecordSnapshot[],
  cloudRecords: CloudSnapshot[],
): PreviewComparison {
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const cloudById = new Map(cloudRecords.map((record) => [record.id, record]));
  let matching = 0;
  let potentialConflicts = 0;

  localById.forEach((localRecord, id) => {
    const cloudRecord = cloudById.get(id);

    if (!cloudRecord) {
      return;
    }

    matching += 1;

    if (hasMeaningfullyDifferentTimestamp(localRecord.updatedAt, cloudRecord.updated_at)) {
      potentialConflicts += 1;
    }
  });

  return {
    localOnly: localRecords.length - matching,
    cloudOnly: cloudRecords.length - matching,
    matching,
    potentialConflicts,
    duplicateRisk: countDuplicateIds(localRecords) + countDuplicateIds(cloudRecords),
  };
}

function countDuplicateIds(records: Array<{ id: string }>) {
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  records.forEach((record) => {
    if (seenIds.has(record.id)) {
      duplicateCount += 1;
      return;
    }

    seenIds.add(record.id);
  });

  return duplicateCount;
}

async function readCloudSnapshots(tableName: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('id, updated_at')
    .returns<CloudSnapshot[]>();

  if (error) {
    return null;
  }

  return data ?? [];
}

class FirstSyncPreviewService {
  async preview(): Promise<FirstSyncPreview> {
    const cases = await caseRepository.readAll();
    const localSnapshots: Record<PreviewCollection, RecordSnapshot[]> = {
      cases: [],
      dossiers: [],
      bonds: [],
      boardEntries: [],
    };
    let localImageCount = 0;
    let estimatedUploadBytes = 0;

    await Promise.all(
      cases.map(async (loreCase) => {
        const [dossiers, bonds, boardEntries] = await Promise.all([
          dossierRepository.readByCaseId(loreCase.id),
          bondRepository.readByCaseId(loreCase.id),
          boardRepository.readPinsByCaseId(loreCase.id),
        ]);

        localSnapshots.cases.push({
          id: loreCase.id,
          updatedAt: loreCase.dateLastModified,
          payload: loreCase,
        });
        localSnapshots.dossiers.push(
          ...dossiers.map((dossier) => ({
            id: dossier.id,
            updatedAt: dossier.dateModified,
            payload: dossier,
          })),
        );
        localSnapshots.bonds.push(
          ...bonds.map((bond) => ({
            id: bond.id,
            updatedAt: bond.dateModified,
            payload: bond,
          })),
        );
        localSnapshots.boardEntries.push(
          ...boardEntries.map((boardEntry) => ({
            id: boardEntry.id,
            updatedAt: boardEntry.datePinned,
            payload: boardEntry,
          })),
        );

        const caseImageCount = loreCase.coverImage ? 1 : 0;
        const dossierImageCount = dossiers.filter((dossier) => dossier.coverImage).length;
        localImageCount += caseImageCount + dossierImageCount;
        estimatedUploadBytes +=
          estimateStringBytes(JSON.stringify({ loreCase, dossiers, bonds, boardEntries })) +
          estimateOptionalImageBytes(loreCase.coverImage) +
          dossiers.reduce(
            (totalBytes, dossier) => totalBytes + estimateOptionalImageBytes(dossier.coverImage),
            0,
          );
      }),
    );

    const [cloudCases, cloudDossiers, cloudBonds, cloudBoardEntries] = await Promise.all([
      readCloudSnapshots('cases'),
      readCloudSnapshots('dossiers'),
      readCloudSnapshots('bonds'),
      readCloudSnapshots('board_entries'),
    ]);
    const isCloudAvailable = Boolean(
      cloudCases && cloudDossiers && cloudBonds && cloudBoardEntries,
    );

    if (!isCloudAvailable) {
      return {
        local: {
          caseCount: localSnapshots.cases.length,
          dossierCount: localSnapshots.dossiers.length,
          bondCount: localSnapshots.bonds.length,
          boardEntryCount: localSnapshots.boardEntries.length,
          localImageCount,
          estimatedUploadBytes,
        },
        cloud: {
          isAvailable: false,
          caseCount: 0,
          dossierCount: 0,
          bondCount: 0,
          boardEntryCount: 0,
        },
        comparison: emptyComparisons(),
        message: 'LoreBound Online could not be reviewed. Your Local Archive remains unchanged.',
      };
    }

    const availableCloudCases = cloudCases ?? [];
    const availableCloudDossiers = cloudDossiers ?? [];
    const availableCloudBonds = cloudBonds ?? [];
    const availableCloudBoardEntries = cloudBoardEntries ?? [];

    return {
      local: {
        caseCount: localSnapshots.cases.length,
        dossierCount: localSnapshots.dossiers.length,
        bondCount: localSnapshots.bonds.length,
        boardEntryCount: localSnapshots.boardEntries.length,
        localImageCount,
        estimatedUploadBytes,
      },
      cloud: {
        isAvailable: true,
        caseCount: availableCloudCases.length,
        dossierCount: availableCloudDossiers.length,
        bondCount: availableCloudBonds.length,
        boardEntryCount: availableCloudBoardEntries.length,
      },
      comparison: {
        cases: compareSnapshots(localSnapshots.cases, availableCloudCases),
        dossiers: compareSnapshots(localSnapshots.dossiers, availableCloudDossiers),
        bonds: compareSnapshots(localSnapshots.bonds, availableCloudBonds),
        boardEntries: compareSnapshots(localSnapshots.boardEntries, availableCloudBoardEntries),
      },
      message:
        availableCloudCases.length +
          availableCloudDossiers.length +
          availableCloudBonds.length +
          availableCloudBoardEntries.length ===
        0
          ? 'LoreBound Online does not yet contain any archived investigations.'
          : 'LoreBound Online contains archived records. Review the summary before synchronization.',
    };
  }
}

export const firstSyncPreviewService = new FirstSyncPreviewService();
