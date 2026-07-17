import type { CaseFormValues, LoreCase } from '../types/caseTypes';
import type { Bond, BondEvidence, BondFormValues } from '../types/bondTypes';
import type { BoardPin, BoardPinPosition } from '../types/boardTypes';
import type { Dossier, DossierFormValues } from '../types/dossierTypes';
import { createStableId } from '../../../lib/stableId';
import { createDefaultDossierSections } from '../utils/dossierSections';

const databaseName = 'lorebound-local-archive';
const databaseVersion = 4;
const caseStoreName = 'cases';
const dossierStoreName = 'dossiers';
const boardPinStoreName = 'boardPins';
const bondStoreName = 'bonds';
const metaStoreName = 'meta';
const activeCaseKey = 'activeCaseId';
const syncStateKey = 'syncState';
const deletionTombstonesKey = 'deletionTombstones';
const localClientIdKey = 'localClientId';

export const DELETION_SYNC_VERSION = 1;

export type DeletionEntityType = 'cases' | 'dossiers' | 'bonds' | 'boardEntries';

export type DeletionTombstone = {
  id: string;
  caseId: string | null;
  entityType: DeletionEntityType;
  entityId: string;
  deletedAt: string;
  sourceClientId: string;
  synchronizationStatus: 'pending' | 'verified' | 'failed';
  baselineFingerprint?: string;
  deletionVersion: typeof DELETION_SYNC_VERSION;
  verifiedAt?: string;
  lastFailedStage?: string;
};

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
  return createStableId('case');
}

function createDossierId() {
  return createStableId('dossier');
}

function createBoardPinId() {
  return createStableId('pin');
}

function createBondId() {
  return createStableId('bond');
}

function createDeletionTombstoneId() {
  return createStableId('delete');
}

function createLocalClientId() {
  return createStableId('client');
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
    sections: values.sections ?? createDefaultDossierSections(values),
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

  if (values.dossierType === 'Theory') {
    return {
      ...commonValues,
      theoryConfidence: values.theoryConfidence,
      theoryStatus: values.theoryStatus,
    };
  }

  return commonValues;
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
    origin: values.origin,
    threadmark: values.threadmark,
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
  const [caseRecordGroups, activeCaseId, deletionTombstones] = await Promise.all([
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
    readDeletionTombstones(),
  ]);

  return {
    cases,
    dossiers: caseRecordGroups.flatMap((group) => group.dossiers),
    bonds: caseRecordGroups.flatMap((group) => group.bonds),
    boardPins: caseRecordGroups.flatMap((group) => group.boardPins),
    deletionTombstones,
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
  deletionBaselines?: Record<string, {
    entityType: DeletionEntityType;
    entityId: string;
    deletedAt: string;
    deletionFingerprint: string;
    deletionVersion: typeof DELETION_SYNC_VERSION;
  }>;
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

export async function readDeletionTombstones() {
  const result = await runTransaction<DeletionTombstone[] | undefined>(metaStoreName, 'readonly', (store) =>
    store.get(deletionTombstonesKey),
  );

  return result ?? [];
}

async function writeDeletionTombstones(tombstones: DeletionTombstone[]) {
  await runTransaction<IDBValidKey>(metaStoreName, 'readwrite', (store) =>
    store.put(tombstones, deletionTombstonesKey),
  );
}

export async function readOrCreateLocalClientId() {
  const existingClientId = await runTransaction<string | undefined>(metaStoreName, 'readonly', (store) =>
    store.get(localClientIdKey),
  );

  if (existingClientId) {
    return existingClientId;
  }

  const clientId = createLocalClientId();
  await runTransaction<IDBValidKey>(metaStoreName, 'readwrite', (store) =>
    store.put(clientId, localClientIdKey),
  );

  return clientId;
}

function getDeletionFingerprint(tombstone: Pick<DeletionTombstone, 'entityType' | 'entityId' | 'deletedAt' | 'deletionVersion'>) {
  return JSON.stringify({
    state: 'deleted',
    entityType: tombstone.entityType,
    entityId: tombstone.entityId,
    deletedAt: tombstone.deletedAt,
    deletionVersion: tombstone.deletionVersion,
  });
}

async function hasDeletionAuthorityForRecord(entityType: DeletionEntityType, entityId: string) {
  const [tombstones, syncState] = await Promise.all([
    readDeletionTombstones(),
    readLocalSyncState(),
  ]);

  return (
    tombstones.some((tombstone) => tombstone.entityType === entityType && tombstone.entityId === entityId) ||
    Boolean(syncState?.deletionBaselines?.[`${entityType}:${entityId}`])
  );
}

async function deleteRecordWithTombstone<TRecord extends { id: string }>(
  storeName: string,
  entityType: DeletionEntityType,
  entityId: string,
  getCaseId: (record: TRecord) => string | null,
) {
  const sourceClientId = await readOrCreateLocalClientId();
  const syncState = await readLocalSyncState();

  await runMultiStoreTransaction([storeName, metaStoreName], 'readwrite', async (stores) => {
    const record = await requestToPromise(stores[storeName].get(entityId)) as TRecord | undefined;

    if (!record) {
      return;
    }

    const existingTombstones =
      ((await requestToPromise(stores[metaStoreName].get(deletionTombstonesKey))) as DeletionTombstone[] | undefined) ??
      [];
    const existingTombstone = existingTombstones.find(
      (tombstone) => tombstone.entityType === entityType && tombstone.entityId === entityId,
    );
    const deletedAt = existingTombstone?.deletedAt ?? new Date().toISOString();
    const tombstone: DeletionTombstone = {
      id: existingTombstone?.id ?? createDeletionTombstoneId(),
      caseId: getCaseId(record),
      entityType,
      entityId,
      deletedAt,
      sourceClientId: existingTombstone?.sourceClientId ?? sourceClientId,
      synchronizationStatus: existingTombstone?.synchronizationStatus ?? 'pending',
      baselineFingerprint:
        existingTombstone?.baselineFingerprint ??
        syncState?.synchronizedFingerprints?.[`${entityType}:${entityId}`],
      deletionVersion: DELETION_SYNC_VERSION,
      verifiedAt: existingTombstone?.verifiedAt,
      lastFailedStage: existingTombstone?.lastFailedStage,
    };

    await requestToPromise(
      stores[metaStoreName].put(
        [
          ...existingTombstones.filter(
            (candidate) => !(candidate.entityType === entityType && candidate.entityId === entityId),
          ),
          tombstone,
        ],
        deletionTombstonesKey,
      ),
    );
    await requestToPromise(stores[storeName].delete(entityId));
  });
}

export async function markDeletionTombstonesVerified(tombstonesToVerify: DeletionTombstone[]) {
  if (tombstonesToVerify.length === 0) {
    return;
  }

  const tombstones = await readDeletionTombstones();
  const verifiedIds = new Set(tombstonesToVerify.map((tombstone) => tombstone.id));
  const verifiedAt = new Date().toISOString();

  await writeDeletionTombstones(
    tombstones.map((tombstone) =>
      verifiedIds.has(tombstone.id)
        ? {
            ...tombstone,
            synchronizationStatus: 'verified',
            verifiedAt,
            lastFailedStage: undefined,
          }
        : tombstone,
    ),
  );
}

export async function markDeletionTombstoneFailed(tombstone: DeletionTombstone, failedStage: string) {
  const tombstones = await readDeletionTombstones();

  await writeDeletionTombstones(
    tombstones.map((candidate) =>
      candidate.id === tombstone.id
        ? {
            ...candidate,
            synchronizationStatus: 'failed',
            lastFailedStage: failedStage,
          }
        : candidate,
    ),
  );
}

export type DeletionBaselineEntries = Record<string, {
  entityType: DeletionEntityType;
  entityId: string;
  deletedAt: string;
  deletionFingerprint: string;
  deletionVersion: typeof DELETION_SYNC_VERSION;
}>;

export function createDeletionBaselineEntries(tombstones: DeletionTombstone[]): DeletionBaselineEntries {
  return Object.fromEntries(
    tombstones
      .filter((tombstone) => tombstone.synchronizationStatus === 'verified')
      .map((tombstone) => [
        `${tombstone.entityType}:${tombstone.entityId}`,
        {
          entityType: tombstone.entityType,
          entityId: tombstone.entityId,
          deletedAt: tombstone.deletedAt,
          deletionFingerprint: getDeletionFingerprint(tombstone),
          deletionVersion: DELETION_SYNC_VERSION,
        },
      ]),
  ) as DeletionBaselineEntries;
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
      const caseIds = new Set(records.cases.map((record) => record.id));
      const dossierIds = new Set(records.dossiers.map((record) => record.id));
      const bondIds = new Set(records.bonds.map((record) => record.id));
      const boardPinIds = new Set(records.boardPins.map((record) => record.id));

      for (const key of await requestToPromise(stores[caseStoreName].getAllKeys())) {
        if (!caseIds.has(String(key))) {
          await requestToPromise(stores[caseStoreName].delete(key));
        }
      }

      for (const key of await requestToPromise(stores[dossierStoreName].getAllKeys())) {
        if (!dossierIds.has(String(key))) {
          await requestToPromise(stores[dossierStoreName].delete(key));
        }
      }

      for (const key of await requestToPromise(stores[bondStoreName].getAllKeys())) {
        if (!bondIds.has(String(key))) {
          await requestToPromise(stores[bondStoreName].delete(key));
        }
      }

      for (const key of await requestToPromise(stores[boardPinStoreName].getAllKeys())) {
        if (!boardPinIds.has(String(key))) {
          await requestToPromise(stores[boardPinStoreName].delete(key));
        }
      }

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

export async function replaceEmptyCaseShellWithCloudArchive(
  shellCaseId: string,
  records: {
    cases: LoreCase[];
    dossiers: Dossier[];
    bonds: Bond[];
    boardPins: BoardPin[];
    activeCaseId?: string | null;
  },
) {
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

      if (!records.cases.some((loreCase) => loreCase.id === shellCaseId)) {
        await requestToPromise(stores[caseStoreName].delete(shellCaseId));
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

export async function deleteCase(id: string) {
  await deleteDossiersByCaseId(id);
  await deleteBondsByCaseId(id);
  await deleteBoardPinsByCaseId(id);
  return deleteRecordWithTombstone<LoreCase>(
    caseStoreName,
    'cases',
    id,
    (record) => record.id,
  );
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
  };

  await runTransaction(caseStoreName, 'readwrite', (store) => store.put(openedCase));
  await recordActiveCase(id);
  return openedCase;
}

export async function createDossier(caseId: string, values: DossierFormValues) {
  const now = new Date().toISOString();
  const name = values.name.trim();

  if (!caseId) {
    throw new Error('Open a Case before creating a Dossier.');
  }

  if (!name) {
    throw new Error('Add a Name before saving this Dossier.');
  }

  let dossierId: string;
  let cleanedValues: ReturnType<typeof cleanDossierValues>;

  try {
    dossierId = createDossierId();
  } catch {
    throw new Error('LoreBound could not create a stable Dossier ID.');
  }

  try {
    cleanedValues = cleanDossierValues(values);
  } catch {
    throw new Error('LoreBound could not initialize the Dossier sections.');
  }

  const dossier: Dossier = {
    id: dossierId,
    caseId,
    dossierType: values.dossierType,
    name,
    dateCreated: now,
    dateModified: now,
    ...cleanedValues,
  };

  try {
    await runTransaction(dossierStoreName, 'readwrite', (store) => store.add(dossier));
  } catch {
    throw new Error('LoreBound could not save this Dossier to the Local Archive.');
  }

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
  return deleteRecordWithTombstone<Dossier>(
    dossierStoreName,
    'dossiers',
    id,
    (record) => record.caseId,
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
  return deleteRecordWithTombstone<BoardPin>(
    boardPinStoreName,
    'boardEntries',
    id,
    (record) => record.caseId,
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

  const incomingThreadmark = values.threadmark;
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
    const isThreadmarkPairMember =
      incomingThreadmark?.origin === 'threadmark' &&
      bond.threadmark?.origin === 'threadmark' &&
      incomingThreadmark.ownerId === bond.threadmark.ownerId &&
      incomingThreadmark.pairId === bond.threadmark.pairId &&
      incomingThreadmark.role !== bond.threadmark.role;

    return (
      bond.id !== currentBondId &&
      samePair &&
      bond.bondType === values.bondType &&
      bondLabels === labels &&
      !isThreadmarkPairMember
    );
  });

  if (duplicate) {
    throw new Error('This Bond already exists for these Dossiers.');
  }
}

export async function createBond(caseId: string, values: BondFormValues) {
  await validateBond(caseId, values);

  if (values.id && await hasDeletionAuthorityForRecord('bonds', values.id)) {
    throw new Error('This Bond was deleted from the synchronized Investigation and cannot be recreated automatically.');
  }

  const now = new Date().toISOString();
  const bond: Bond = {
    id: values.id ?? createBondId(),
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
  const cleanedValues = cleanBondValues(values);
  const updatedBond: Bond = {
    ...existingBond,
    ...cleanedValues,
    origin: cleanedValues.origin ?? existingBond.origin,
    threadmark: cleanedValues.threadmark ?? existingBond.threadmark,
    dateModified: new Date().toISOString(),
  };

  await runTransaction(bondStoreName, 'readwrite', (store) => store.put(updatedBond));
  return updatedBond;
}

export function deleteBond(id: string) {
  return deleteRecordWithTombstone<Bond>(
    bondStoreName,
    'bonds',
    id,
    (record) => record.caseId,
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
