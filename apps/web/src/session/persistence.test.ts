import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTechnicalSliceState,
  executeCommand,
  type GameState,
  type PendingInteraction
} from '@bigmoney/game-core';
import { SeededRandom, SequenceRandom, type RandomSnapshot } from '@bigmoney/game-random';
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
  saveTechnicalSliceSave,
  type TechnicalSliceSave
} from './persistence';

beforeEach(async () => {
  await clearTechnicalSliceSave();
});

describe('technical slice persistence', () => {
  it.each([2, 3, 4] as const)(
    'writes and validates a stable schema v3 %i-player turn-ready save',
    async (playerCount) => {
      const random = new SeededRandom(20260805);
      const state = createTechnicalSliceState(playerCount);

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
      expect(loaded.save?.game.players).toHaveLength(playerCount);
      expect(loaded.save?.flow).toBe('turnReady');
    }
  );

  it('migrates the existing schema v1 stable save', async () => {
    const random = new SeededRandom(7);
    const state = createTechnicalSliceState();

    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, {
      schemaVersion: 1,
      game: createLegacyGame(state),
      random: random.getSnapshot(),
      savedAt: '2026-08-06T00:00:00.000Z'
    });

    const loaded = await loadTechnicalSliceSave();

    expect(loaded.status).toBe('ready');
    expect(loaded.migrated).toBe(true);
    expect(loaded.save?.schemaVersion).toBe(3);
    expect(loaded.save?.flow).toBe('turnReady');
    expect(loaded.save?.game.status).toBe('IN_PROGRESS');
    expect(loaded.save?.game.winnerId).toBeNull();
    expect(loaded.save?.game.players).toHaveLength(2);
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

  it.each([2, 3, 4] as const)(
    'preserves the %i-player awaiting-handoff recovery boundary',
    async (playerCount) => {
      const random = new SeededRandom(13);
      const state = createTechnicalSliceState(playerCount);
      state.activePlayerIndex = playerCount - 1;

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
      expect(loaded.save?.game).toEqual(state);
    }
  );

  it.each([3, 4] as const)(
    'round-trips %i-player awaiting liquidation with its canonical debt and completed liquidation mutations',
    async (playerCount) => {
      const random = new SeededRandom(17);
      const state = createAwaitingLiquidationState(playerCount);

      const written = await saveTechnicalSliceSave(
        state,
        random.getSnapshot(),
        'awaitingLiquidation'
      );
      const loaded = await loadTechnicalSliceSave();
      const pending = loaded.save?.game.pendingInteraction;

      expect(written.flow).toBe('awaitingLiquidation');
      expect(written.handoffFromPlayerId).toBeNull();
      expect(loaded.status).toBe('ready');
      expect(loaded.save?.game).toEqual(state);
      expect(loaded.save?.game.players).toHaveLength(playerCount);
      expect(loaded.save?.random).toEqual(random.getSnapshot());
      expect(pending).toMatchObject({
        type: 'LIQUIDATION',
        payment: {
          id: 'PAYMENT-0001',
          amount: 75,
          payerId: 'P2',
          receiverId: 'P1',
          reason: 'RENT'
        }
      });
      expect(loaded.save?.game.properties.A2).toMatchObject({ ownerId: null, level: 0 });
      expect('selectedPropertyIds' in written).toBe(false);
      expect('selectedPropertyIds' in written.game).toBe(false);
    }
  );

  it.each([3, 4] as const)(
    'round-trips finished %i-player games with the final GameState untouched',
    async (playerCount) => {
      const random = new SeededRandom(19);
      const state = createFinishedState(playerCount);
      state.turn.rolledValue = 6;

      await saveTechnicalSliceSave(state, random.getSnapshot(), 'finished');
      const loaded = await loadTechnicalSliceSave();

      expect(loaded.status).toBe('ready');
      expect(loaded.save?.flow).toBe('finished');
      expect(loaded.save?.handoffFromPlayerId).toBeNull();
      expect(loaded.save?.game).toEqual(state);
      expect(loaded.save?.game.players).toHaveLength(playerCount);
      expect(loaded.save?.game.winnerId).toBe('P1');
    }
  );

  it.each([0, 1, 5, 6])(
    'quarantines v3 saves with an out-of-range player count of %i without truncating them',
    async (playerCount) => {
      const valid = await saveTechnicalSliceSave(
        createTechnicalSliceState(4),
        new SeededRandom(20260820).getSnapshot(),
        'turnReady'
      );
      const canonicalPlayers = valid.game.players;
      valid.game.players = Array.from(
        { length: playerCount },
        (_, index) =>
          index < canonicalPlayers.length
            ? structuredClone(canonicalPlayers[index]!)
            : {
                ...structuredClone(canonicalPlayers[canonicalPlayers.length - 1]!),
                id: `INVALID-P${index + 1}`
              }
      );
      await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, recomputeIntegrity(valid));

      const quarantine = await expectRecoveredAndQuarantined();
      expect(
        (quarantine as { payload: { game: { players: unknown[] } } }).payload.game.players
      ).toHaveLength(playerCount);
    }
  );

  it.each([
    ['missing liquidation interaction', (save: TechnicalSliceSave) => {
      save.game.pendingInteraction = null;
    }],
    ['wrong pending interaction type', (save: TechnicalSliceSave) => {
      save.game.pendingInteraction = {
        type: 'EVENT_RESULT',
        playerId: 'P2',
        eventId: 'EVENT_REPAIR_FEE',
        title: 'fee',
        description: 'fee'
      };
    }],
    ['missing payer', (save: TechnicalSliceSave) => {
      const interaction = requireLiquidation(save.game);
      interaction.playerId = 'P9';
      (interaction.payment as { payerId: string }).payerId = 'P9';
    }],
    ['bankrupt payer', (save: TechnicalSliceSave) => {
      save.game.players[1]!.bankrupt = true;
    }],
    ['payer that is not active', (save: TechnicalSliceSave) => {
      save.game.activePlayerIndex = 0;
    }],
    ['missing receiver', (save: TechnicalSliceSave) => {
      const interaction = requireLiquidation(save.game);
      (interaction.payment as { receiverId: string | null }).receiverId = 'P9';
    }],
    ['payer as receiver', (save: TechnicalSliceSave) => {
      const interaction = requireLiquidation(save.game);
      (interaction.payment as { receiverId: string | null }).receiverId = 'P2';
    }],
    ['non-positive payment amount', (save: TechnicalSliceSave) => {
      const interaction = requireLiquidation(save.game);
      (interaction.payment as { amount: number }).amount = 0;
    }]
  ])('quarantines awaiting-liquidation saves with %s', async (_name, mutate) => {
    const invalid = recomputeIntegrity(await createLiquidationSave());
    mutate(invalid);
    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, recomputeIntegrity(invalid));

    await expectRecoveredAndQuarantined();
  });

  it.each(['turnReady', 'awaitingHandoff'] as const)(
    'quarantines a liquidation interaction outside %s',
    async (flow) => {
      const invalid = recomputeIntegrity(await createLiquidationSave());
      invalid.flow = flow;
      invalid.handoffFromPlayerId = flow === 'awaitingHandoff' ? 'P1' : null;
      await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, recomputeIntegrity(invalid));

      await expectRecoveredAndQuarantined();
    }
  );

  it.each([
    ['unfinished game status', (save: TechnicalSliceSave) => {
      save.game.status = 'IN_PROGRESS';
    }],
    ['missing winner', (save: TechnicalSliceSave) => {
      save.game.winnerId = null;
    }],
    ['unknown winner', (save: TechnicalSliceSave) => {
      save.game.winnerId = 'P9';
    }],
    ['bankrupt winner', (save: TechnicalSliceSave) => {
      save.game.players[0]!.bankrupt = true;
    }],
    ['multiple active players', (save: TechnicalSliceSave) => {
      save.game.players[1]!.bankrupt = false;
    }],
    ['winner different from the only active player', (save: TechnicalSliceSave) => {
      save.game.players[0]!.bankrupt = true;
      save.game.players[1]!.bankrupt = false;
    }],
    ['pending interaction', (save: TechnicalSliceSave) => {
      save.game.pendingInteraction = {
        type: 'EVENT_RESULT',
        playerId: 'P1',
        eventId: 'EVENT_REPAIR_FEE',
        title: 'fee',
        description: 'fee'
      };
    }]
  ])('quarantines finished saves with %s', async (_name, mutate) => {
    const random = new SeededRandom(23);
    const valid = await saveTechnicalSliceSave(
      createFinishedState(),
      random.getSnapshot(),
      'finished'
    );
    mutate(valid);
    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, recomputeIntegrity(valid));

    await expectRecoveredAndQuarantined();
  });

  it('migrates valid schema v2 turn-ready and awaiting-handoff saves directly to v3', async () => {
    const random = new SeededRandom(29);
    const state = createTechnicalSliceState();
    const turnReady = createV2Save(state, random.getSnapshot(), 'turnReady', null);

    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, turnReady);
    const migratedTurnReady = await loadTechnicalSliceSave();

    expect(migratedTurnReady.status).toBe('ready');
    expect(migratedTurnReady.migrated).toBe(true);
    expect(migratedTurnReady.save).toMatchObject({
      schemaVersion: 3,
      flow: 'turnReady',
      handoffFromPlayerId: null,
      game: { status: 'IN_PROGRESS', winnerId: null }
    });
    expect(migratedTurnReady.save?.game.players).toHaveLength(2);

    const handoffState = createTechnicalSliceState();
    handoffState.activePlayerIndex = 1;
    await saveSnapshot(
      TECHNICAL_SLICE_SAVE_SLOT,
      createV2Save(handoffState, random.getSnapshot(), 'awaitingHandoff', 'P1')
    );
    const migratedHandoff = await loadTechnicalSliceSave();

    expect(migratedHandoff.status).toBe('ready');
    expect(migratedHandoff.save).toMatchObject({
      schemaVersion: 3,
      flow: 'awaitingHandoff',
      handoffFromPlayerId: 'P1',
      game: { status: 'IN_PROGRESS', winnerId: null }
    });
    expect(migratedHandoff.save?.game.players).toHaveLength(2);
  });

  it('quarantines invalid v2 before migration and unknown schemas', async () => {
    const random = new SeededRandom(31);
    const corrupt = createV2Save(
      createTechnicalSliceState(),
      random.getSnapshot(),
      'turnReady',
      null
    );
    corrupt.game.round = 0;
    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, corrupt);
    await expectRecoveredAndQuarantined();

    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, { schemaVersion: 99 });
    await expectRecoveredAndQuarantined();
  });

  it.each([
    ['status', (save: TechnicalSliceSave) => { save.game.status = 'FINISHED'; }],
    ['winnerId', (save: TechnicalSliceSave) => { save.game.winnerId = 'P1'; }],
    ['pending liquidation', (save: TechnicalSliceSave) => {
      const interaction = requireLiquidation(save.game);
      interaction.payment = { ...interaction.payment, amount: interaction.payment.amount + 1 };
    }]
  ])('rejects v3 integrity after changing %s', async (_name, mutate) => {
    const valid = await createLiquidationSave();
    mutate(valid);
    await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, valid);

    await expectRecoveredAndQuarantined();
  });

  it.each(['presentingLiquidation', 'presentingBankruptcy', 'presentingFinished'])(
    'quarantines transient flow %s',
    async (flow) => {
      const valid = await createLiquidationSave();
      const raw = structuredClone(valid) as Omit<TechnicalSliceSave, 'flow'> & {
        flow: string;
      };
      raw.flow = flow;
      await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, recomputeIntegrity(raw));

      await expectRecoveredAndQuarantined();
    }
  );
});

function createAwaitingLiquidationState(playerCount: 2 | 3 | 4 = 2): GameState {
  const state = createTechnicalSliceState(playerCount);
  state.activePlayerIndex = 1;
  state.players[1]!.position = 0;
  state.players[1]!.cash = 10;
  state.properties.A1!.ownerId = 'P1';
  state.properties.A1!.level = 3;
  state.properties.A2!.ownerId = 'P2';
  state.properties.A3!.ownerId = 'P2';
  const random = new SequenceRandom([1]);
  const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P2' }, random).nextState;
  const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P2' }, random).nextState;
  const pending = executeCommand(
    moved,
    { type: 'RESOLVE_DESTINATION', playerId: 'P2' },
    random
  ).nextState;
  const payment = requireLiquidation(pending).payment;

  return executeCommand(
    pending,
    { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId: payment.id, propertyIds: ['A2'] },
    random
  ).nextState;
}

function createFinishedState(playerCount: 2 | 3 | 4 = 2): GameState {
  const state = createTechnicalSliceState(playerCount);
  for (const player of state.players.slice(1)) player.bankrupt = true;
  state.status = 'FINISHED';
  state.winnerId = 'P1';
  return state;
}

function createLegacyGame(state: GameState): Record<string, unknown> {
  const { status: _status, winnerId: _winnerId, ...legacy } = state;
  return structuredClone(legacy) as Record<string, unknown>;
}

function createV2Save(
  game: GameState,
  random: RandomSnapshot,
  flow: 'turnReady' | 'awaitingHandoff',
  handoffFromPlayerId: string | null
): Record<string, unknown> & { game: GameState } {
  const payload = {
    schemaVersion: 2,
    game: createLegacyGame(game),
    random: structuredClone(random),
    flow,
    handoffFromPlayerId,
    savedAt: '2026-08-12T00:00:00.000Z'
  };
  return {
    ...payload,
    game: payload.game as unknown as GameState,
    integrity: createIntegrity(payload)
  };
}

async function createLiquidationSave(): Promise<TechnicalSliceSave> {
  return saveTechnicalSliceSave(
    createAwaitingLiquidationState(),
    new SeededRandom(37).getSnapshot(),
    'awaitingLiquidation'
  );
}

function requireLiquidation(game: GameState): Extract<PendingInteraction, { type: 'LIQUIDATION' }> {
  const interaction = game.pendingInteraction;
  if (!interaction || interaction.type !== 'LIQUIDATION') {
    throw new Error('Expected a liquidation interaction.');
  }
  return interaction;
}

function recomputeIntegrity<T extends { integrity: string }>(save: T): T {
  const { integrity: _integrity, ...payload } = save;
  return { ...payload, integrity: createIntegrity(payload) } as T;
}

async function expectRecoveredAndQuarantined(): Promise<unknown> {
  const loaded = await loadTechnicalSliceSave();
  expect(loaded.status).toBe('recovered');
  expect(loaded.save).toBeNull();
  expect(await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT)).toBeNull();
  const quarantine = await loadSnapshot(TECHNICAL_SLICE_QUARANTINE_SLOT);
  expect(quarantine).not.toBeNull();
  return quarantine;
}

function createIntegrity(payload: unknown): string {
  const text = JSON.stringify(payload);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
