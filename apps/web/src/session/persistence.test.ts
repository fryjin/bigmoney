import { beforeEach, describe, expect, it } from 'vitest';
import { createTechnicalSliceState } from '@bigmoney/game-core';
import { SeededRandom } from '@bigmoney/game-random';
import {
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from '@bigmoney/game-storage';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  TECHNICAL_SLICE_QUARANTINE_SLOT,
  TECHNICAL_SLICE_SAVE_SLOT,
  clearTechnicalSliceSave,
  loadTechnicalSliceSave,
  saveTechnicalSliceSave
} from './persistence';

beforeEach(async () => {
  await clearTechnicalSliceSave();
});

describe('technical slice persistence', () => {
  it('writes and validates a stable schema v2 save', async () => {
    const random = new SeededRandom(20260805);
    const state = createTechnicalSliceState();

    const written = await saveTechnicalSliceSave(
      state,
      random.getSnapshot(),
      'turnReady'
    );
    const loaded = await loadTechnicalSliceSave();

    expect(written.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(written.integrity).toMatch(/^fnv1a32:/);
    expect(loaded.status).toBe('ready');
    expect(loaded.save?.game).toEqual(state);
    expect(loaded.save?.flow).toBe('turnReady');
  });

  it('migrates the existing schema v1 stable save', async () => {
    const random = new SeededRandom(7);
    const state = createTechnicalSliceState();

    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, {
      schemaVersion: 1,
      game: state,
      random: random.getSnapshot(),
      savedAt: '2026-08-06T00:00:00.000Z'
    });

    const loaded = await loadTechnicalSliceSave();

    expect(loaded.status).toBe('ready');
    expect(loaded.migrated).toBe(true);
    expect(loaded.save?.schemaVersion).toBe(2);
    expect(loaded.save?.flow).toBe('turnReady');
  });

  it('quarantines a corrupted save and clears the active slot', async () => {
    const random = new SeededRandom(11);
    const state = createTechnicalSliceState();
    const valid = await saveTechnicalSliceSave(
      state,
      random.getSnapshot(),
      'turnReady'
    );

    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, {
      ...valid,
      game: {
        ...valid.game,
        round: 0
      }
    });

    const loaded = await loadTechnicalSliceSave();
    const active = await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT);
    const quarantine = await loadSnapshot(TECHNICAL_SLICE_QUARANTINE_SLOT);

    expect(loaded.status).toBe('recovered');
    expect(active).toBeNull();
    expect(quarantine).not.toBeNull();

    await deleteSnapshot(TECHNICAL_SLICE_QUARANTINE_SLOT);
  });

  it('preserves the awaiting-handoff recovery boundary', async () => {
    const random = new SeededRandom(13);
    const state = createTechnicalSliceState();
    state.activePlayerIndex = 1;

    await saveTechnicalSliceSave(
      state,
      random.getSnapshot(),
      'awaitingHandoff',
      'P1'
    );

    const loaded = await loadTechnicalSliceSave();

    expect(loaded.status).toBe('ready');
    expect(loaded.save?.flow).toBe('awaitingHandoff');
    expect(loaded.save?.handoffFromPlayerId).toBe('P1');
  });
});
