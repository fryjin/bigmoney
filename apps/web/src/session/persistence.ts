import type { GameState } from '@bigmoney/game-core';
import type { RandomSnapshot } from '@bigmoney/game-random';
import {
  appendEvent,
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from '@bigmoney/game-storage';
import type { DomainEvent } from '@bigmoney/game-core';

const SLOT = 'technical-slice-phase-1.1';
const EVENT_SESSION = 'technical-slice-phase-1.1';

export interface TechnicalSliceSave {
  schemaVersion: 1;
  game: GameState;
  random: RandomSnapshot;
  savedAt: string;
}

export async function loadTechnicalSliceSave(): Promise<TechnicalSliceSave | null> {
  const value = await loadSnapshot<TechnicalSliceSave>(SLOT);
  if (!value || value.schemaVersion !== 1) return null;
  return value;
}

export async function saveTechnicalSliceSave(
  game: GameState,
  random: RandomSnapshot
): Promise<void> {
  await saveSnapshot<TechnicalSliceSave>(SLOT, {
    schemaVersion: 1,
    game,
    random,
    savedAt: new Date().toISOString()
  });
}

export async function logDomainEvents(events: DomainEvent[]): Promise<void> {
  for (const event of events) {
    await appendEvent(EVENT_SESSION, event);
  }
}

export async function clearTechnicalSliceSave(): Promise<void> {
  await deleteSnapshot(SLOT);
}
