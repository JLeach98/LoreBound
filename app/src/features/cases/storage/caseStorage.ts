import type { CaseFormValues, LoreCase } from '../types/caseTypes';

const databaseName = 'lorebound-local-archive';
const databaseVersion = 1;
const caseStoreName = 'cases';
const metaStoreName = 'meta';
const activeCaseKey = 'activeCaseId';

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

function createCaseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
