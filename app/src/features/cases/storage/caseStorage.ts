import type { CaseFormValues, LoreCase } from '../types/caseTypes';
import type { Bond, BondEvidence, BondFormValues } from '../types/bondTypes';
import type { BoardPin, BoardPinPosition } from '../types/boardTypes';
import type { Dossier, DossierFormValues } from '../types/dossierTypes';

const databaseName = 'lorebound-local-archive';
const databaseVersion = 4;
const caseStoreName = 'cases';
const dossierStoreName = 'dossiers';
const boardPinStoreName = 'boardPins';
const bondStoreName = 'bonds';
const metaStoreName = 'meta';
const activeCaseKey = 'activeCaseId';
const syncStateKey = 'syncState';

export const localArchiveStorageInfo = {
  source: 'caseStorage IndexedDB Local Archive',
  databaseName,
  databaseVersion,
  objectStores: [
    caseStoreName,
    dossierStoreName,
    boardPinStoreName,
    bondStoreName,
    metaStoreName,
  ],
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => {
      reject(request.error ?? new Error('Unable to open the local archive.'));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(caseStoreName)) {
        database.createObjectStore(caseStoreName, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(dossierStoreName)) {
        database.createObjectStore(dossierStoreName, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(boardPinStoreName)) {
        database.createObjectStore(boardPinStoreName, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(bondStoreName)) {
        database.createObjectStore(bondStoreName, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(metaStoreName)) {
        database.createObjectStore(metaStoreName);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });

  return databasePromise;
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error ?? new Error('The local archive request failed.'));
        };

        transaction.onerror = () => {
          reject(transaction.error ?? new Error('The local archive transaction failed.'));
        };
      }),
  );
}

function runMultiStoreTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (stores: Record<string, IDBObjectStore>) => Promise<T> | T,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeNames, mode);
        const stores = storeNames.reduce<Record<string, IDBObjectStore>>((storeMap, storeName) => {
          storeMap[storeName] = transaction.objectStore(storeName);
          return storeMap;
        }, {});

        Promise.resolve(operation(stores)).then(resolve).catch(reject);

        transaction.onerror = () => {
          reject(transaction.error ?? new Error('The local archive transaction failed.'));
        };
      }),
  );
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The local archive request failed.'));
  });
}

function createCaseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDossierId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `dossier-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBoardPinId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `pin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBondId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `bond-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createBoardPinPosition(order: number): BoardPinPosition {
  const columns = 4;
  const column = order % columns;
  const row = Math.floor(order / columns);

  return {
    x: 6 + column * 18,
    y: 8 + row * 22,
  };
}

function clampBoardPosition(position: BoardPinPosition): BoardPinPosition {
  return {
    x: Math.min(84, Math.max(0, position.x)),
    y: Math.min(82, Math.max(0, position.y)),
  };
}

function cleanDossierValues(values: DossierFormValues) {
  const commonValues = {
    coverImage: values.coverImage,
    summary: cleanOptional(values.summary),
    notes: cleanOptional(values.notes),
  };

  if (values.dossierType === 'Character') {
    return {
      ...commonValues,
      alias: cleanOptional(values.alias),
      characterStatus: values.characterStatus,
      affiliation: cleanOptional(values.affiliation),
    };
  }

  if (values.dossierType === 'Location') {
    return {
      ...commonValues,
      region: cleanOptional(values.region),
      world: cleanOptional(values.world),
    };
  }

  if (values.dossierType === 'Event') {
    return {
      ...commonValues,
      eventDate: cleanOptional(values.eventDate),
      era: cleanOptional(values.era),
    };
  }

  if (values.dossierType === 'Organization') {
    return {
      ...commonValues,
      leader: cleanOptional(values.leader),
      organizationType: cleanOptional(values.organizationType),
    };
  }

  return {
    ...commonValues,
    theoryConfidence: values.theoryConfidence,
    theoryStatus: values.theoryStatus,
  };
}

function cleanBondEvidence(evidence?: BondEvidence) {
  if (!evidence) {
    return undefined;
  }

  const cleanedEvidence = {
    sourceTitle: cleanOptional(evidence.sourceTitle),
    sourceType: cleanOptional(evidence.sourceType),
    reference: cleanOptional(evidence.reference),
    evidenceNotes: cleanOptional(evidence.evidenceNotes),
  };

  return Object.values(cleanedEvidence).some(Boolean) ? cleanedEvidence : undefined;
}

function cleanBondValues(values: BondFormValues) {
  return {
    sourceDossierId: values.sourceDossierId,
    targetDossierId: values.targetDossierId,
    bondType: values.bondType.trim(),
    bondBehavior: values.bondBehavior,
    sourceLabel: cleanOptional(values.sourceLabel),
    targetLabel: cleanOptional(values.targetLabel),
    status: values.status,
    notes: cleanOptional(values.notes),
    evidence: cleanBondEvidence(values.evidence),
  };
}

export async function createCase(values: CaseFormValues) {
  const now = new Date().toISOString();
  const loreCase: LoreCase = {
    id: createCaseId(),
    caseName: values.caseName.trim(),
    universeType: values.universeType,
    dateCreated: now,
    dateLastModified: now,
    dateLastOpened: null,
    coverImage: values.coverImage,
    authorOrCreator: cleanOptional(values.authorOrCreator),
    description: cleanOptional(values.description),
  };

  await runTransaction(caseStoreName, 'readwrite', (store) => store.add(loreCase));
  return loreCase;
}

export function readAllCases() {
  return runTransaction<LoreCase[]>(caseStoreName, 'readonly', (store) => store.getAll());
}

export async function readFullLocalArchive() {
  const cases = await readAllCases();
  const [caseRecordGroups, activeCaseId] = await Promise.all([
    Promise.all(
      cases.map(async (loreCase) => {
        const [dossiers, bonds, boardPins] = await Promise.all([
          readDossiersByCaseId(loreCase.id),
          readBondsByCaseId(loreCase.id),
          readBoardPinsByCaseId(loreCase.id),
        ]);

        return { dossiers, bonds, boardPins };
      }),
    ),
    readActiveCaseId(),
  ]);

  return {
    cases,
    dossiers: caseRecordGroups.flatMap((group) => group.dossiers),
    bonds: caseRecordGroups.flatMap((group) => group.bonds),
    boardPins: caseRecordGroups.flatMap((group) => group.boardPins),
    activeCaseId,
  };
}

export type LocalSyncState = {
  investigatorId: string;
  lastSuccessfulSynchronizationAt: string;
  synchronizedRecordIds: {
    cases: string[];
    dossiers: string[];
    bonds: string[];
    boardPins: string[];
  };
  synchronizedUpdatedAt: Record<string, string>;
  synchronizedFingerprints?: Record<string, string>;
  cloudImagePaths?: {
    cases: Record<string, string>;
    dossiers: Record<string, string>;
  };
  synchronizationVersion: number;
};

export async function readLocalSyncState() {
  const result = await runTransaction<LocalSyncState | undefined>(metaStoreName, 'readonly', (store) =>
    store.get(syncStateKey),
  );

  return result ?? null;
}

export async function recordLocalSyncState(syncState: LocalSyncState) {
  await runTransaction<IDBValidKey>(metaStoreName, 'readwrite', (store) =>
    store.put(syncState, syncStateKey),
  );
}

export async function importFullLocalArchive(records: {
  cases: LoreCase[];
  dossiers: Dossier[];
  bonds: Bond[];
  boardPins: BoardPin[];
  activeCaseId?: string | null;
}) {
  await runMultiStoreTransaction(
    [caseStoreName, dossierStoreName, bondStoreName, boardPinStoreName, metaStoreName],
    'readwrite',
    async (stores) => {
      for (const loreCase of records.cases) {
        await requestToPromise(stores[caseStoreName].put(loreCase));
      }

      for (const dossier of records.dossiers) {
        await requestToPromise(stores[dossierStoreName].put(dossier));
      }

      for (const bond of records.bonds) {
        await requestToPromise(stores[bondStoreName].put(bond));
      }

      for (const boardPin of records.boardPins) {
        await requestToPromise(stores[boardPinStoreName].put(boardPin));
      }

      const activeCaseId = records.activeCaseId ?? records.cases[0]?.id;

      if (activeCaseId) {
        await requestToPromise(stores[metaStoreName].put(activeCaseId, activeCaseKey));
      }
    },
  );
}

export function readCaseById(id: string) {
  return runTransaction<LoreCase | undefined>(caseStoreName, 'readonly', (store) =>
    store.get(id),
  );
}

export async function updateCase(id: string, values: CaseFormValues) {
  const existingCase = await readCaseById(id);

  if (!existingCase) {
    throw new Error('The selected Case could not be found.');
  }

  const updatedCase: LoreCase = {
    ...existingCase,
    caseName: values.caseName.trim(),
    universeType: values.universeType,
    coverImage: values.coverImage,
    authorOrCreator: cleanOptional(values.authorOrCreator),
    description: cleanOptional(values.description),
    dateLastModified: new Date().toISOString(),
  };

  await runTransaction(caseStoreName, 'readwrite', (store) => store.put(updatedCase));
  return updatedCase;
}

export function deleteCase(id: string) {
  return runTransaction<undefined>(caseStoreName, 'readwrite', (store) => store.delete(id));
}

export async function readActiveCaseId() {
  const result = await runTransaction<string | undefined>(metaStoreName, 'readonly', (store) =>
    store.get(activeCaseKey),
  );

  return result ?? null;
}

export async function recordActiveCase(id: string) {
  await runTransaction<IDBValidKey>(metaStoreName, 'readwrite', (store) =>
    store.put(id, activeCaseKey),
  );
}

export function clearActiveCase() {
  return runTransaction<undefined>(metaStoreName, 'readwrite', (store) =>
    store.delete(activeCaseKey),
  );
}

export async function openCase(id: string) {
  const existingCase = await readCaseById(id);

  if (!existingCase) {
    throw new Error('The selected Case could not be found.');
  }

  const openedCase: LoreCase = {
    ...existingCase,
    dateLastOpened: new Date().toISOString(),
    dateLastModified: new Date().toISOString(),
  };

  await runTransaction(caseStoreName, 'readwrite', (store) => store.put(openedCase));
  await recordActiveCase(id);
  return openedCase;
}

export async function createDossier(caseId: string, values: DossierFormValues) {
  const now = new Date().toISOString();
  const dossier: Dossier = {
    id: createDossierId(),
    caseId,
    dossierType: values.dossierType,
    name: values.name.trim(),
    dateCreated: now,
    dateModified: now,
    ...cleanDossierValues(values),
  };

  await runTransaction(dossierStoreName, 'readwrite', (store) => store.add(dossier));
  return dossier;
}

export async function readDossiersByCaseId(caseId: string) {
  const dossiers = await runTransaction<Dossier[]>(dossierStoreName, 'readonly', (store) =>
    store.getAll(),
  );

  return dossiers.filter((dossier) => dossier.caseId === caseId);
}

export function readDossierById(id: string) {
  return runTransaction<Dossier | undefined>(dossierStoreName, 'readonly', (store) =>
    store.get(id),
  );
}

export async function updateDossier(id: string, values: DossierFormValues) {
  const existingDossier = await readDossierById(id);

  if (!existingDossier) {
    throw new Error('The selected Dossier could not be found.');
  }

  const updatedDossier: Dossier = {
    ...existingDossier,
    dossierType: values.dossierType,
    name: values.name.trim(),
    dateModified: new Date().toISOString(),
    ...cleanDossierValues(values),
  };

  await runTransaction(dossierStoreName, 'readwrite', (store) => store.put(updatedDossier));
  return updatedDossier;
}

export async function deleteDossier(id: string) {
  await deleteBondsByDossierId(id);
  await deleteBoardPinsByDossierId(id);
  return runTransaction<undefined>(dossierStoreName, 'readwrite', (store) =>
    store.delete(id),
  );
}

export async function deleteDossiersByCaseId(caseId: string) {
  const dossiers = await readDossiersByCaseId(caseId);
  await Promise.all(dossiers.map((dossier) => deleteDossier(dossier.id)));
}

export async function readBoardPinsByCaseId(caseId: string) {
  const pins = await runTransaction<BoardPin[]>(boardPinStoreName, 'readonly', (store) =>
    store.getAll(),
  );
  const casePins = pins.filter((pin) => pin.caseId === caseId);
  const migratedPins = await Promise.all(
    casePins.map(async (pin, index) => {
      if (pin.position) {
        return pin;
      }

      const migratedPin: BoardPin = {
        ...pin,
        position: createBoardPinPosition(pin.order ?? index),
      };

      await runTransaction(boardPinStoreName, 'readwrite', (store) =>
        store.put(migratedPin),
      );
      return migratedPin;
    }),
  );

  return migratedPins.sort((left, right) => left.order - right.order);
}

export async function pinDossierToBoard(
  caseId: string,
  dossierId: string,
  position?: BoardPinPosition,
) {
  const existingPins = await readBoardPinsByCaseId(caseId);
  const existingPin = existingPins.find((pin) => pin.dossierId === dossierId);

  if (existingPin) {
    if (position) {
      return updateBoardPinPosition(existingPin.id, position);
    }

    return existingPin;
  }

  const order = existingPins.length;
  const pin: BoardPin = {
    id: createBoardPinId(),
    caseId,
    dossierId,
    order,
    position: clampBoardPosition(position ?? createBoardPinPosition(order)),
    datePinned: new Date().toISOString(),
  };

  await runTransaction(boardPinStoreName, 'readwrite', (store) => store.add(pin));
  return pin;
}

export function removeBoardPin(id: string) {
  return runTransaction<undefined>(boardPinStoreName, 'readwrite', (store) =>
    store.delete(id),
  );
}

export async function updateBoardPinPosition(id: string, position: BoardPinPosition) {
  const existingPin = await runTransaction<BoardPin | undefined>(
    boardPinStoreName,
    'readonly',
    (store) => store.get(id),
  );

  if (!existingPin) {
    throw new Error('The selected Board card could not be found.');
  }

  const updatedPin: BoardPin = {
    ...existingPin,
    position: clampBoardPosition(position),
  };

  await runTransaction(boardPinStoreName, 'readwrite', (store) => store.put(updatedPin));
  return updatedPin;
}

export async function deleteBoardPinsByDossierId(dossierId: string) {
  const pins = await runTransaction<BoardPin[]>(boardPinStoreName, 'readonly', (store) =>
    store.getAll(),
  );
  const matchingPins = pins.filter((pin) => pin.dossierId === dossierId);

  await Promise.all(matchingPins.map((pin) => removeBoardPin(pin.id)));
}

export async function deleteBoardPinsByCaseId(caseId: string) {
  const pins = await readBoardPinsByCaseId(caseId);
  await Promise.all(pins.map((pin) => removeBoardPin(pin.id)));
}

export async function readBondsByCaseId(caseId: string) {
  const bonds = await runTransaction<Bond[]>(bondStoreName, 'readonly', (store) =>
    store.getAll(),
  );

  return bonds
    .filter((bond) => bond.caseId === caseId)
    .sort(
      (left, right) =>
        new Date(right.dateModified).getTime() - new Date(left.dateModified).getTime(),
    );
}

export function readBondById(id: string) {
  return runTransaction<Bond | undefined>(bondStoreName, 'readonly', (store) =>
    store.get(id),
  );
}

export async function readBondsByDossierId(dossierId: string) {
  const bonds = await runTransaction<Bond[]>(bondStoreName, 'readonly', (store) =>
    store.getAll(),
  );

  return bonds.filter(
    (bond) => bond.sourceDossierId === dossierId || bond.targetDossierId === dossierId,
  );
}

async function validateBond(caseId: string, values: BondFormValues, currentBondId?: string) {
  if (values.sourceDossierId === values.targetDossierId) {
    throw new Error('A Dossier cannot be Bonded to itself.');
  }

  const [sourceDossier, targetDossier, existingBonds] = await Promise.all([
    readDossierById(values.sourceDossierId),
    readDossierById(values.targetDossierId),
    readBondsByCaseId(caseId),
  ]);

  if (!sourceDossier || !targetDossier) {
    throw new Error('Both connected Dossiers must exist before creating a Bond.');
  }

  if (sourceDossier.caseId !== caseId || targetDossier.caseId !== caseId) {
    throw new Error('Bonds cannot connect Dossiers from different Cases.');
  }

  const labels = [
    cleanOptional(values.sourceLabel) ?? '',
    cleanOptional(values.targetLabel) ?? '',
  ].join('|');
  const duplicate = existingBonds.find((bond) => {
    const samePair =
      (bond.sourceDossierId === values.sourceDossierId &&
        bond.targetDossierId === values.targetDossierId) ||
      (bond.sourceDossierId === values.targetDossierId &&
        bond.targetDossierId === values.sourceDossierId);
    const bondLabels = [bond.sourceLabel ?? '', bond.targetLabel ?? ''].join('|');

    return (
      bond.id !== currentBondId &&
      samePair &&
      bond.bondType === values.bondType &&
      bondLabels === labels
    );
  });

  if (duplicate) {
    throw new Error('This Bond already exists for these Dossiers.');
  }
}

export async function createBond(caseId: string, values: BondFormValues) {
  await validateBond(caseId, values);
  const now = new Date().toISOString();
  const bond: Bond = {
    id: createBondId(),
    caseId,
    dateCreated: now,
    dateModified: now,
    ...cleanBondValues(values),
  };

  await runTransaction(bondStoreName, 'readwrite', (store) => store.add(bond));
  return bond;
}

export async function updateBond(id: string, values: BondFormValues) {
  const existingBond = await readBondById(id);

  if (!existingBond) {
    throw new Error('The selected Bond could not be found.');
  }

  await validateBond(existingBond.caseId, values, id);
  const updatedBond: Bond = {
    ...existingBond,
    ...cleanBondValues(values),
    dateModified: new Date().toISOString(),
  };

  await runTransaction(bondStoreName, 'readwrite', (store) => store.put(updatedBond));
  return updatedBond;
}

export function deleteBond(id: string) {
  return runTransaction<undefined>(bondStoreName, 'readwrite', (store) =>
    store.delete(id),
  );
}

export async function deleteBondsByDossierId(dossierId: string) {
  const bonds = await readBondsByDossierId(dossierId);
  await Promise.all(bonds.map((bond) => deleteBond(bond.id)));
}

export async function deleteBondsByCaseId(caseId: string) {
  const bonds = await readBondsByCaseId(caseId);
  await Promise.all(bonds.map((bond) => deleteBond(bond.id)));
}
