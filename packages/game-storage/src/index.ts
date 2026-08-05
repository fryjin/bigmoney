import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface BigMoneyDatabase extends DBSchema {
  snapshots: {
    key: string;
    value: {
      slot: string;
      savedAt: string;
      payload: unknown;
    };
  };
  events: {
    key: number;
    value: {
      id?: number;
      sessionId: string;
      createdAt: string;
      payload: unknown;
    };
    indexes: {
      'by-session': string;
    };
  };
}

let databasePromise: Promise<IDBPDatabase<BigMoneyDatabase>> | null = null;
const memorySnapshots = new Map<string, unknown>();
const memoryEvents: unknown[] = [];

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDatabase(): Promise<IDBPDatabase<BigMoneyDatabase>> {
  if (!databasePromise) {
    databasePromise = openDB<BigMoneyDatabase>('bigmoney-local-v1', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('snapshots')) {
          database.createObjectStore('snapshots', { keyPath: 'slot' });
        }
        if (!database.objectStoreNames.contains('events')) {
          const store = database.createObjectStore('events', {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('by-session', 'sessionId');
        }
      }
    });
  }
  return databasePromise;
}

export async function saveSnapshot<T>(slot: string, payload: T): Promise<void> {
  if (!canUseIndexedDb()) {
    memorySnapshots.set(slot, structuredClone(payload));
    return;
  }

  const database = await getDatabase();
  await database.put('snapshots', {
    slot,
    savedAt: new Date().toISOString(),
    payload
  });
}

export async function loadSnapshot<T>(slot: string): Promise<T | null> {
  if (!canUseIndexedDb()) {
    const payload = memorySnapshots.get(slot);
    return payload === undefined ? null : structuredClone(payload as T);
  }

  const database = await getDatabase();
  const record = await database.get('snapshots', slot);
  return record ? (record.payload as T) : null;
}

export async function deleteSnapshot(slot: string): Promise<void> {
  if (!canUseIndexedDb()) {
    memorySnapshots.delete(slot);
    return;
  }

  const database = await getDatabase();
  await database.delete('snapshots', slot);
}

export async function appendEvent<T>(
  sessionId: string,
  payload: T
): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryEvents.push(structuredClone(payload));
    return;
  }

  const database = await getDatabase();
  await database.add('events', {
    sessionId,
    createdAt: new Date().toISOString(),
    payload
  });
}

export async function loadEvents<T>(sessionId: string): Promise<T[]> {
  if (!canUseIndexedDb()) return structuredClone(memoryEvents as T[]);

  const database = await getDatabase();
  const records = await database.getAllFromIndex('events', 'by-session', sessionId);
  return records.map((record) => record.payload as T);
}
