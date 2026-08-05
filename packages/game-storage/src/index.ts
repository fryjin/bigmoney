import { openDB, type DBSchema } from 'idb';

interface TownBoardDatabase extends DBSchema {
  snapshots: {
    key: string;
    value: {
      id: string;
      schemaVersion: number;
      savedAt: number;
      payload: unknown;
    };
  };
  eventLog: {
    key: number;
    value: {
      id?: number;
      matchId: string;
      createdAt: number;
      event: unknown;
    };
    indexes: { byMatch: string };
  };
}

const databasePromise = openDB<TownBoardDatabase>('town-board-game', 1, {
  upgrade(db) {
    db.createObjectStore('snapshots', { keyPath: 'id' });
    const log = db.createObjectStore('eventLog', { keyPath: 'id', autoIncrement: true });
    log.createIndex('byMatch', 'matchId');
  }
});

export async function saveSnapshot(id: string, payload: unknown): Promise<void> {
  const db = await databasePromise;
  await db.put('snapshots', { id, schemaVersion: 1, savedAt: Date.now(), payload });
}

export async function loadSnapshot<T>(id: string): Promise<T | null> {
  const db = await databasePromise;
  const snapshot = await db.get('snapshots', id);
  return (snapshot?.payload as T | undefined) ?? null;
}

export async function appendEvent(matchId: string, event: unknown): Promise<void> {
  const db = await databasePromise;
  await db.add('eventLog', { matchId, createdAt: Date.now(), event });
}
