import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalGameState,
  createTechnicalSliceState,
  executeCommand,
  type ForcedPayment,
  type GameState,
  type PendingInteraction
} from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import { SeededRandom, SequenceRandom, type RandomSnapshot } from '@bigmoney/game-random';
import {
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from '@bigmoney/game-storage';
import {
  CURRENT_LOCAL_GAME_SAVE_SCHEMA_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  LOCAL_GAME_QUARANTINE_SLOT,
  LOCAL_GAME_SAVE_SLOT,
  TECHNICAL_SLICE_QUARANTINE_SLOT,
  TECHNICAL_SLICE_SAVE_SLOT,
  clearLocalGameSave,
  clearTechnicalSliceSave,
  loadLocalGameSave,
  loadTechnicalSliceSave,
  saveLocalGameSave,
  saveTechnicalSliceSave,
  type LocalGameSave,
  type TechnicalSliceSave
} from './persistence';

beforeEach(async () => {
  await Promise.all([clearTechnicalSliceSave(), clearLocalGameSave()]);
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

describe('local game persistence schema v4', () => {
  it.each([2, 3, 4] as const)(
    'round-trips a full-map %i-player turn-ready save with its canonical roster and random snapshot',
    async (playerCount) => {
      const state = createFullMapState(playerCount);
      state.technicalSliceVersion = 'legacy-marker-is-not-board-identity';
      const random = new SeededRandom(20260826 + playerCount);
      const written = await saveLocalGameSave(
        fullMap36Content,
        state,
        random.getSnapshot(),
        'turnReady'
      );
      const loaded = await loadLocalGameSave(fullMap36Content);

      expect(written.schemaVersion).toBe(CURRENT_LOCAL_GAME_SAVE_SCHEMA_VERSION);
      expect(written.game.boardVersion).toBe(fullMap36Content.boardVersion);
      expect(written.integrity).toMatch(/^fnv1a32:/);
      expect(loaded.status).toBe('ready');
      expect(loaded.save?.game).toEqual(state);
      expect(loaded.save?.random).toEqual(random.getSnapshot());
      expect(loaded.save?.game.players).toHaveLength(playerCount);
      expect(Object.keys(loaded.save?.game.properties ?? {})).toEqual(
        fullMap36Content.properties.map((property) => property.id)
      );
      expect(loaded.save?.game.properties.HARBOR_01).toEqual({
        id: 'HARBOR_01',
        ownerId: 'P1',
        level: 3
      });
      expect(loaded.save?.game.players[0]?.position).toBe(0);
      expect(loaded.save?.game.players[1]?.position).toBe(35);
      expect(loaded.save?.game.players.at(-1)?.position).toBe(
        [0, 35, 17, 34][playerCount - 1]
      );
      expect(loaded.save?.game.players[0]?.cards).toEqual([
        { instanceId: 'CARD-0001', cardId: 'CARD_REROLL' }
      ]);
      expect(loaded.save?.game.players[1]?.stocks).toEqual([
        {
          holdingId: 'STOCK-0001',
          stockId: 'SKYLINE_TECH',
          principal: 50,
          originalPeriod: 2,
          remainingRounds: 1,
          purchasedRound: 1
        }
      ]);
    }
  );

  it('round-trips every other stable flow state without changing its canonical game', async () => {
    const handoff = createFullMapState(3);
    handoff.activePlayerIndex = 1;
    const liquidation = createFullMapLiquidationState();
    const finished = createFullMapFinishedState(4);

    await saveLocalGameSave(
      fullMap36Content,
      handoff,
      new SeededRandom(41).getSnapshot(),
      'awaitingHandoff',
      'P1'
    );
    let loaded = await loadLocalGameSave(fullMap36Content);
    expect(loaded).toMatchObject({ status: 'ready', save: { flow: 'awaitingHandoff', handoffFromPlayerId: 'P1' } });
    expect(loaded.save?.game).toEqual(handoff);

    await clearLocalGameSave();
    await saveLocalGameSave(
      fullMap36Content,
      liquidation,
      new SeededRandom(43).getSnapshot(),
      'awaitingLiquidation'
    );
    loaded = await loadLocalGameSave(fullMap36Content);
    expect(loaded).toMatchObject({ status: 'ready', save: { flow: 'awaitingLiquidation', handoffFromPlayerId: null } });
    expect(loaded.save?.game).toEqual(liquidation);

    await clearLocalGameSave();
    await saveLocalGameSave(
      fullMap36Content,
      finished,
      new SeededRandom(47).getSnapshot(),
      'finished'
    );
    loaded = await loadLocalGameSave(fullMap36Content);
    expect(loaded).toMatchObject({ status: 'ready', save: { flow: 'finished', handoffFromPlayerId: null } });
    expect(loaded.save?.game).toEqual(finished);
  });

  it('returns empty when neither the v4 nor legacy slot exists', async () => {
    await expect(loadLocalGameSave(fullMap36Content)).resolves.toEqual({
      status: 'empty',
      save: null,
      message: null,
      migrated: false
    });
  });

  it('clears only local v4 snapshots and leaves the technical-slice slot untouched', async () => {
    await saveLocalGameSave(
      fullMap36Content,
      createFullMapState(),
      new SeededRandom(53).getSnapshot(),
      'turnReady'
    );
    await saveTechnicalSliceSave(
      createTechnicalSliceState(),
      new SeededRandom(59).getSnapshot(),
      'turnReady'
    );

    await clearLocalGameSave();

    expect(await loadSnapshot(LOCAL_GAME_SAVE_SLOT)).toBeNull();
    expect(await loadSnapshot(LOCAL_GAME_QUARANTINE_SLOT)).toBeNull();
    expect(await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT)).not.toBeNull();
  });

  it.each([
    ['wrong board version', (save: LocalGameSave) => { save.game.boardVersion = 'technical-slice-phase-1.1'; }],
    ['missing canonical property', (save: LocalGameSave) => { delete save.game.properties.HARBOR_01; }],
    ['extra legacy property', (save: LocalGameSave) => {
      save.game.properties.A1 = { id: 'A1', ownerId: null, level: 0 };
    }],
    ['property key and id mismatch', (save: LocalGameSave) => { save.game.properties.HARBOR_01!.id = 'HARBOR_02'; }],
    ['invalid property owner', (save: LocalGameSave) => { save.game.properties.HARBOR_01!.ownerId = 'P9'; }],
    ['invalid property level', (save: LocalGameSave) => { save.game.properties.HARBOR_01!.level = 4 as 0; }],
    ['negative player position', (save: LocalGameSave) => { save.game.players[0]!.position = -1; }],
    ['out-of-range player position', (save: LocalGameSave) => { save.game.players[0]!.position = 36; }],
    ['non-integer player position', (save: LocalGameSave) => { save.game.players[0]!.position = 1.5; }],
    ['unknown player stock', (save: LocalGameSave) => { save.game.players[1]!.stocks[0]!.stockId = 'UNKNOWN_STOCK'; }],
    ['unknown player card', (save: LocalGameSave) => { save.game.players[0]!.cards[0]!.cardId = 'UNKNOWN_CARD'; }],
    ['unknown triggered stock market', (save: LocalGameSave) => { save.game.turn.triggeredStockMarkets = ['UNKNOWN_MARKET']; }]
  ])('quarantines structurally invalid v4 saves with %s', async (_name, mutate) => {
    const invalid = recomputeIntegrityV4(await createLocalTurnReadySave());
    mutate(invalid);
    await saveSnapshot(LOCAL_GAME_SAVE_SLOT, recomputeIntegrityV4(invalid));

    await expectLocalRecoveredAndQuarantined();
  });

  it.each([
    ['unknown rent property', (save: LocalGameSave) => {
      requireLiquidation(save.game).payment = {
        ...requireLiquidation(save.game).payment,
        propertyId: 'A1'
      } as Extract<PendingInteraction, { type: 'LIQUIDATION' }>['payment'];
    }],
    ['unknown expense event', (save: LocalGameSave) => {
      requireLiquidation(save.game).payment = {
        id: 'PAYMENT-0002',
        payerId: 'P2',
        receiverId: null,
        amount: 30,
        reason: 'EVENT_EXPENSE',
        eventId: 'UNKNOWN_EVENT',
        title: 'fee',
        description: 'fee'
      };
    }]
  ])('quarantines liquidation references with %s', async (_name, mutate) => {
    const invalid = recomputeIntegrityV4(await createLocalLiquidationSave());
    mutate(invalid);
    await saveSnapshot(LOCAL_GAME_SAVE_SLOT, recomputeIntegrityV4(invalid));

    await expectLocalRecoveredAndQuarantined();
  });

  it.each([
    ['missing tileId', (payment: Record<string, unknown>) => { delete payment.tileId; }],
    ['unknown tile', (payment: Record<string, unknown>) => { payment.tileId = 'UNKNOWN_TILE'; }],
    ['property tile', (payment: Record<string, unknown>) => {
      payment.tileId = 'PROPERTY_HARBOR_01';
    }],
    ['reserved tile', (payment: Record<string, unknown>) => { payment.tileId = 'RESERVED_JAIL'; }],
    ['event tile', (payment: Record<string, unknown>) => { payment.tileId = 'EVENT_01'; }],
    ['wrong facility fee', (payment: Record<string, unknown>) => { payment.amount = 31; }],
    ['non-null receiver', (payment: Record<string, unknown>) => { payment.receiverId = 'P2'; }]
  ])('quarantines PUBLIC_FEE liquidation with %s', async (_name, mutate) => {
    const invalid = await createPublicFeeLiquidationSave();
    mutate(requirePublicFeeLiquidation(invalid.game).payment as unknown as Record<string, unknown>);
    await saveSnapshot(LOCAL_GAME_SAVE_SLOT, recomputeIntegrityV4(invalid));

    await expectLocalRecoveredAndQuarantined();
  });

  it.each([
    [14, 'RESERVED_FACILITY_01', 30],
    [25, 'RESERVED_FACILITY_02', 50]
  ] as const)(
    'round-trips PUBLIC_FEE liquidation at facility index %i without changing the canonical debt',
    async (facilityIndex, tileId, amount) => {
      const state = createPublicFeeLiquidationState(facilityIndex);
      const payment = requirePublicFeeLiquidation(state).payment;
      const random = new SeededRandom(97 + facilityIndex).getSnapshot();

      await saveLocalGameSave(fullMap36Content, state, random, 'awaitingLiquidation');
      const loaded = await loadLocalGameSave(fullMap36Content);

      expect(loaded).toMatchObject({ status: 'ready', save: { flow: 'awaitingLiquidation' } });
      expect(loaded.save?.game).toEqual(state);
      expect(loaded.save?.random).toEqual(random);
      expect(requirePublicFeeLiquidation(loaded.save!.game).payment).toEqual(payment);
      expect(payment).toEqual({
        id: 'PAYMENT-0001',
        payerId: 'P1',
        receiverId: null,
        amount,
        reason: 'PUBLIC_FEE',
        tileId
      });
    }
  );

  it.each([14, 25] as const)(
    'does not retrospectively charge a v4 turn-ready save already at facility index %i',
    async (facilityIndex) => {
      const state = createLocalGameState(fullMap36Content, 2);
      state.players[0]!.position = facilityIndex;
      state.players[0]!.cash = 321;
      const beforeSave = structuredClone(state);

      await saveLocalGameSave(
        fullMap36Content,
        state,
        new SeededRandom(131 + facilityIndex).getSnapshot(),
        'turnReady'
      );
      const loaded = await loadLocalGameSave(fullMap36Content);

      expect(loaded).toMatchObject({ status: 'ready', save: { flow: 'turnReady' } });
      expect(loaded.save?.game).toEqual(beforeSave);
      expect(loaded.save?.game.players[0]).toMatchObject({
        position: facilityIndex,
        cash: 321
      });
      expect(loaded.save?.game.pendingInteraction).toBeNull();
      expect(loaded.save?.game.turn).toEqual(beforeSave.turn);
      expect(loaded.save?.game.nextInstanceSequence).toBe(beforeSave.nextInstanceSequence);
    }
  );

  it.each([
    ['unknown stock tile', 'tileId', 'UNKNOWN_TILE'],
    ['unknown stock market', 'marketId', 'UNKNOWN_MARKET'],
    ['unknown stock offer', 'offeredStockIds', ['UNKNOWN_STOCK']]
  ] as const)(
    'rejects a saved stock interaction with %s before stable-flow recovery',
    async (_name, field, value) => {
      const invalid = recomputeIntegrityV4(await createLocalTurnReadySave());
      invalid.game.pendingInteraction = {
        type: 'STOCK_MARKET',
        playerId: 'P1',
        tileId: 'STOCK_01',
        marketId: 'MARKET_01',
        offeredStockIds: ['SKYLINE_TECH']
      };
      Object.assign(invalid.game.pendingInteraction, { [field]: value });
      await saveSnapshot(LOCAL_GAME_SAVE_SLOT, recomputeIntegrityV4(invalid));

      const quarantine = await expectLocalRecoveredAndQuarantined();
      expect((quarantine as { reason: string }).reason).toContain('股票');
    }
  );

  it.each([
    ['cash', (save: LocalGameSave) => { save.game.players[0]!.cash += 1; }],
    ['board version', (save: LocalGameSave) => { save.game.boardVersion = 'other-board'; }],
    ['player position', (save: LocalGameSave) => { save.game.players[0]!.position = 1; }],
    ['property owner', (save: LocalGameSave) => { save.game.properties.HARBOR_01!.ownerId = 'P2'; }],
    ['random snapshot', (save: LocalGameSave) => { save.random.state += 1; }],
    ['flow', (save: LocalGameSave) => { save.flow = 'awaitingHandoff'; save.handoffFromPlayerId = 'P1'; }]
  ])('rejects v4 integrity after changing %s', async (_name, mutate) => {
    const invalid = await createLocalTurnReadySave();
    mutate(invalid);
    await saveSnapshot(LOCAL_GAME_SAVE_SLOT, invalid);

    const quarantine = await expectLocalRecoveredAndQuarantined();
    expect((quarantine as { reason: string }).reason).toContain('完整性');
  });

  it.each([
    ['v1', async () => {
      const state = createTechnicalSliceState();
      await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, {
        schemaVersion: 1,
        game: createLegacyGame(state),
        random: new SeededRandom(61).getSnapshot(),
        savedAt: '2026-08-26T00:00:00.000Z'
      });
    }],
    ['v2', async () => {
      await saveSnapshot(
        TECHNICAL_SLICE_SAVE_SLOT,
        createV2Save(
          createTechnicalSliceState(),
          new SeededRandom(67).getSnapshot(),
          'turnReady',
          null
        )
      );
    }],
    ['v3', async () => {
      await saveTechnicalSliceSave(
        createTechnicalSliceState(),
        new SeededRandom(71).getSnapshot(),
        'turnReady'
      );
    }]
  ])('quarantines an incompatible technical-slice %s save without migration', async (_version, writeLegacy) => {
    await writeLegacy();

    const loaded = await loadLocalGameSave(fullMap36Content);
    const quarantine = await loadSnapshot(LOCAL_GAME_QUARANTINE_SLOT);

    expect(loaded).toMatchObject({ status: 'recovered', save: null, migrated: false });
    expect(loaded.message).toContain('地图版本已升级');
    expect(loaded.message).toContain('旧局无法继续');
    expect(await loadSnapshot(LOCAL_GAME_SAVE_SLOT)).toBeNull();
    expect(await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT)).toBeNull();
    expect(quarantine).toMatchObject({
      sourceSlot: TECHNICAL_SLICE_SAVE_SLOT,
      payload: expect.anything()
    });
  });

  it('prefers a valid v4 save and leaves a stale legacy save untouched', async () => {
    const v4 = await createLocalTurnReadySave();
    await saveTechnicalSliceSave(
      createTechnicalSliceState(),
      new SeededRandom(73).getSnapshot(),
      'turnReady'
    );

    const loaded = await loadLocalGameSave(fullMap36Content);

    expect(loaded.status).toBe('ready');
    expect(loaded.save).toEqual(v4);
    expect(await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT)).not.toBeNull();
  });

  it('recovers an invalid v4 save without falling back to a legacy save', async () => {
    const invalid = await createLocalTurnReadySave();
    invalid.game.players[0]!.cash += 1;
    await saveSnapshot(LOCAL_GAME_SAVE_SLOT, invalid);
    await saveTechnicalSliceSave(
      createTechnicalSliceState(),
      new SeededRandom(79).getSnapshot(),
      'turnReady'
    );

    await expectLocalRecoveredAndQuarantined();
    expect(await loadSnapshot(TECHNICAL_SLICE_SAVE_SLOT)).not.toBeNull();
  });
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

function createFullMapState(playerCount: 2 | 3 | 4 = 2): GameState {
  const state = createLocalGameState(fullMap36Content, playerCount);
  const positions = [0, 35, 17, 34];

  state.players.forEach((player, index) => {
    player.position = positions[index]!;
  });
  state.properties.HARBOR_01 = { id: 'HARBOR_01', ownerId: 'P1', level: 3 };
  state.properties.METRO_02 = { id: 'METRO_02', ownerId: 'P2', level: 1 };
  state.players[0]!.cards = [{ instanceId: 'CARD-0001', cardId: 'CARD_REROLL' }];
  state.players[1]!.stocks = [
    {
      holdingId: 'STOCK-0001',
      stockId: 'SKYLINE_TECH',
      principal: 50,
      originalPeriod: 2,
      remainingRounds: 1,
      purchasedRound: 1
    }
  ];

  return state;
}

function createFullMapLiquidationState(): GameState {
  const state = createLocalGameState(fullMap36Content, 2);
  state.activePlayerIndex = 1;
  state.players[1]!.position = 0;
  state.players[1]!.cash = 10;
  state.properties.HARBOR_01 = { id: 'HARBOR_01', ownerId: 'P1', level: 3 };
  state.properties.HARBOR_02 = { id: 'HARBOR_02', ownerId: 'P2', level: 0 };
  const random = new SequenceRandom([1]);
  const rolled = executeCommand(
    state,
    { type: 'ROLL_DICE', playerId: 'P2' },
    random,
    fullMap36Content
  ).nextState;
  const moved = executeCommand(
    rolled,
    { type: 'MOVE_ONE_STEP', playerId: 'P2' },
    random,
    fullMap36Content
  ).nextState;

  return executeCommand(
    moved,
    { type: 'RESOLVE_DESTINATION', playerId: 'P2' },
    random,
    fullMap36Content
  ).nextState;
}

function createFullMapFinishedState(playerCount: 2 | 3 | 4 = 2): GameState {
  const state = createLocalGameState(fullMap36Content, playerCount);
  for (const player of state.players.slice(1)) player.bankrupt = true;
  state.status = 'FINISHED';
  state.winnerId = 'P1';
  return state;
}

async function createLocalTurnReadySave(): Promise<LocalGameSave> {
  return saveLocalGameSave(
    fullMap36Content,
    createFullMapState(),
    new SeededRandom(83).getSnapshot(),
    'turnReady'
  );
}

async function createLocalLiquidationSave(): Promise<LocalGameSave> {
  return saveLocalGameSave(
    fullMap36Content,
    createFullMapLiquidationState(),
    new SeededRandom(89).getSnapshot(),
    'awaitingLiquidation'
  );
}

function createPublicFeeLiquidationState(facilityIndex: 14 | 25): GameState {
  const state = createLocalGameState(fullMap36Content, 2);
  state.players[0]!.position = facilityIndex - 1;
  state.players[0]!.cash = 10;
  state.properties.HARBOR_01 = { id: 'HARBOR_01', ownerId: 'P1', level: 0 };
  const random = new SequenceRandom([1]);
  const rolled = executeCommand(
    state,
    { type: 'ROLL_DICE', playerId: 'P1' },
    random,
    fullMap36Content
  ).nextState;
  const moved = executeCommand(
    rolled,
    { type: 'MOVE_ONE_STEP', playerId: 'P1' },
    random,
    fullMap36Content
  ).nextState;

  return executeCommand(
    moved,
    { type: 'RESOLVE_DESTINATION', playerId: 'P1' },
    random,
    fullMap36Content
  ).nextState;
}

async function createPublicFeeLiquidationSave(): Promise<LocalGameSave> {
  return saveLocalGameSave(
    fullMap36Content,
    createPublicFeeLiquidationState(14),
    new SeededRandom(101).getSnapshot(),
    'awaitingLiquidation'
  );
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

function requirePublicFeeLiquidation(
  game: GameState
): Extract<PendingInteraction, { type: 'LIQUIDATION' }> & {
  payment: Extract<ForcedPayment, { reason: 'PUBLIC_FEE' }>;
} {
  const interaction = requireLiquidation(game);
  if (interaction.payment.reason !== 'PUBLIC_FEE') {
    throw new Error('Expected a public fee liquidation interaction.');
  }
  return interaction as Extract<PendingInteraction, { type: 'LIQUIDATION' }> & {
    payment: Extract<ForcedPayment, { reason: 'PUBLIC_FEE' }>;
  };
}

function recomputeIntegrity<T extends { integrity: string }>(save: T): T {
  const { integrity: _integrity, ...payload } = save;
  return { ...payload, integrity: createIntegrity(payload) } as T;
}

function recomputeIntegrityV4(save: LocalGameSave): LocalGameSave {
  return recomputeIntegrity(save);
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

async function expectLocalRecoveredAndQuarantined(): Promise<unknown> {
  const loaded = await loadLocalGameSave(fullMap36Content);
  expect(loaded.status).toBe('recovered');
  expect(loaded.save).toBeNull();
  expect(await loadSnapshot(LOCAL_GAME_SAVE_SLOT)).toBeNull();
  const quarantine = await loadSnapshot(LOCAL_GAME_QUARANTINE_SLOT);
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
