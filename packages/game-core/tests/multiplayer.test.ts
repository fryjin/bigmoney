import { describe, expect, it } from 'vitest';
import { SequenceRandom } from '@bigmoney/game-random';
import {
  createTechnicalSliceState,
  executeCommand,
  getActivePlayers,
  getNextActivePlayerIndex,
  getWinnerId,
  type DomainEvent,
  type GameState,
  type StockHolding
} from '../src/index';

const EXPECTED_ROSTER = [
  { id: 'P1', name: '玩家一', color: '#E87868' },
  { id: 'P2', name: '玩家二', color: '#4F8FB8' },
  { id: 'P3', name: '玩家三', color: '#7E68B8' },
  { id: 'P4', name: '玩家四', color: '#5E9B72' }
] as const;

describe('formal local player setup', () => {
  it('creates the default two-player state from the canonical roster', () => {
    const state = createTechnicalSliceState();

    expect(state.players.map(playerIdentity)).toEqual(EXPECTED_ROSTER.slice(0, 2));
    expectInitialGameState(state);
  });

  it.each([2, 3, 4] as const)(
    'creates a canonical %i-player state',
    (playerCount) => {
      const state = createTechnicalSliceState(playerCount);

      expect(state.players.map(playerIdentity)).toEqual(EXPECTED_ROSTER.slice(0, playerCount));
      expectInitialGameState(state);
    }
  );

  it.each([1, 5, 0, -1, 2.5])(
    'rejects invalid local player count %s at the runtime Core boundary',
    (playerCount) => {
      expect(() => createTechnicalSliceState(playerCount as 2 | 3 | 4)).toThrow(
        'Local player count must be 2, 3, or 4.'
      );
    }
  );
});

describe('formal multi-player turn order', () => {
  it('rotates four active players P1 to P2 to P3 to P4 and then wraps to P1', () => {
    let state = createTechnicalSliceState(4);

    const first = endTurn(state);
    expectTurnEnded(first.events, 'P1', 'P2', null, 1);
    state = first.nextState;

    const second = endTurn(state);
    expectTurnEnded(second.events, 'P2', 'P3', null, 1);
    state = second.nextState;

    const third = endTurn(state);
    expectTurnEnded(third.events, 'P3', 'P4', null, 1);
    state = third.nextState;

    const fourth = endTurn(state);
    expectTurnEnded(fourth.events, 'P4', 'P1', 1, 2);
  });

  it('skips P2 when P1 ends a four-player turn', () => {
    const state = createTechnicalSliceState(4);
    state.players[1]!.bankrupt = true;

    const result = endTurn(state);

    expect(getActivePlayers(result.nextState).map((player) => player.id)).toEqual(['P1', 'P3', 'P4']);
    expect(getNextActivePlayerIndex(result.nextState, 0)).toBe(2);
    expectTurnEnded(result.events, 'P1', 'P3', null, 1);
  });

  it('skips consecutive bankrupt players when P1 ends a four-player turn', () => {
    const state = createTechnicalSliceState(4);
    state.players[1]!.bankrupt = true;
    state.players[2]!.bankrupt = true;

    const result = endTurn(state);

    expect(getNextActivePlayerIndex(result.nextState, 0)).toBe(3);
    expectTurnEnded(result.events, 'P1', 'P4', null, 1);
  });

  it('advances a bankrupt player to the next live player from the formal roster', () => {
    const state = createTechnicalSliceState(4);
    state.activePlayerIndex = 1;
    state.players[1]!.bankrupt = true;
    state.players[2]!.bankrupt = true;
    state.turn.rolledValue = 6;

    const result = executeCommand(
      state,
      { type: 'ADVANCE_AFTER_BANKRUPTCY', playerId: 'P2' },
      new SequenceRandom([20])
    );

    expect(result.nextState.activePlayerIndex).toBe(3);
    expect(result.nextState.turn).toEqual({
      rolledValue: null,
      remainingSteps: 0,
      triggeredStockMarkets: [],
      readyToEnd: false
    });
    expectTurnEnded(result.events, 'P2', 'P4', null, 1);
  });

  it('increments the round and settles stocks only when the next active player wraps', () => {
    const state = createTechnicalSliceState(4);
    state.players[0]!.stocks = [createHolding()];
    state.activePlayerIndex = 2;

    const noWrap = endTurn(state);
    expectTurnEnded(noWrap.events, 'P3', 'P4', null, 1);
    expect(noWrap.events.some((event) => event.type === 'STOCK_SETTLED')).toBe(false);
    expect(noWrap.nextState.players[0]!.stocks).toEqual([createHolding()]);

    const wrapped = endTurn(noWrap.nextState);
    expectTurnEnded(wrapped.events, 'P4', 'P1', 1, 2);
    expect(wrapped.events).toContainEqual(expect.objectContaining({
      type: 'STOCK_SETTLED',
      playerId: 'P1',
      holdingId: 'STOCK-0001'
    }));
    expect(wrapped.nextState.players[0]!.stocks).toEqual([]);
  });

  it('detects the only survivor as the winner in three-player and four-player states', () => {
    const threePlayers = createTechnicalSliceState(3);
    threePlayers.players[1]!.bankrupt = true;
    threePlayers.players[2]!.bankrupt = true;

    const fourPlayers = createTechnicalSliceState(4);
    fourPlayers.players[0]!.bankrupt = true;
    fourPlayers.players[1]!.bankrupt = true;
    fourPlayers.players[3]!.bankrupt = true;

    expect(getWinnerId(threePlayers)).toBe('P1');
    expect(getWinnerId(fourPlayers)).toBe('P3');
  });
});

describe('PLAYER_TRANSFER', () => {
  it('keeps the two-player transfer behavior', () => {
    const result = resolvePlayerTransfer(createTechnicalSliceState());

    expect(result.nextState.players.map((player) => player.cash)).toEqual([520, 480]);
    expectTransferChanges(result.events, 'P2', 'P1', 20);
  });

  it('uses the next active player in a three-player game', () => {
    const state = createTechnicalSliceState(3);
    state.activePlayerIndex = 1;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players.map((player) => player.cash)).toEqual([500, 520, 480]);
    expectTransferChanges(result.events, 'P3', 'P2', 20);
  });

  it('uses the next active player in a four-player game', () => {
    const state = createTechnicalSliceState(4);
    state.activePlayerIndex = 1;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players.map((player) => player.cash)).toEqual([500, 520, 480, 500]);
    expectTransferChanges(result.events, 'P3', 'P2', 20);
  });

  it('skips a bankrupt next player when choosing the transfer payer', () => {
    const state = createTechnicalSliceState(4);
    state.players[1]!.bankrupt = true;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players.map((player) => player.cash)).toEqual([520, 500, 480, 500]);
    expectTransferChanges(result.events, 'P3', 'P1', 20);
  });

  it('wraps from P4 to P1 when choosing the transfer payer', () => {
    const state = createTechnicalSliceState(4);
    state.activePlayerIndex = 3;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players.map((player) => player.cash)).toEqual([480, 500, 500, 520]);
    expectTransferChanges(result.events, 'P1', 'P4', 20);
  });

  it('transfers only the next active payer cash without entering payment, liquidation, or bankruptcy', () => {
    const state = createTechnicalSliceState(3);
    state.players[1]!.cash = 5;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players.map((player) => player.cash)).toEqual([505, 0, 500]);
    expect(result.nextState.players.some((player) => player.bankrupt)).toBe(false);
    expect(result.nextState.pendingInteraction).toMatchObject({ type: 'EVENT_RESULT' });
    expect(result.events.map((event) => event.type)).toEqual(['EVENT_RESOLVED']);
    expectTransferChanges(result.events, 'P2', 'P1', 5);
  });

  it('keeps an impossible one-survivor in-progress state cash-neutral', () => {
    const state = createTechnicalSliceState(3);
    state.players[1]!.bankrupt = true;
    state.players[2]!.bankrupt = true;

    const result = resolvePlayerTransfer(state);

    expect(result.nextState.players[0]!.cash).toBe(500);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'EVENT_RESOLVED',
      changes: []
    }));
  });
});

function playerIdentity(player: GameState['players'][number]) {
  return { id: player.id, name: player.name, color: player.color };
}

function expectInitialGameState(state: GameState): void {
  expect(state).toMatchObject({
    status: 'IN_PROGRESS',
    winnerId: null,
    round: 1,
    activePlayerIndex: 0,
    turn: {
      rolledValue: null,
      remainingSteps: 0,
      triggeredStockMarkets: [],
      readyToEnd: false
    },
    pendingInteraction: null,
    nextInstanceSequence: 1
  });
  expect(state.players.every((player) => (
    player.cash === 500 &&
    player.position === 0 &&
    !player.bankrupt &&
    player.cards.length === 0 &&
    player.stocks.length === 0
  ))).toBe(true);
  expect(Object.values(state.properties)).toEqual(expect.arrayContaining([
    expect.objectContaining({ ownerId: null, level: 0 })
  ]));
  expect(Object.values(state.properties).every((property) => property.ownerId === null)).toBe(true);
}

function endTurn(state: GameState) {
  state.turn.readyToEnd = true;
  const playerId = state.players[state.activePlayerIndex]!.id;
  return executeCommand(state, { type: 'END_TURN', playerId }, new SequenceRandom([20]));
}

function expectTurnEnded(
  events: DomainEvent[],
  playerId: string,
  nextPlayerId: string,
  completedRound: number | null,
  nextRound: number
): void {
  expect(events).toContainEqual({
    type: 'TURN_ENDED',
    playerId,
    nextPlayerId,
    completedRound,
    nextRound
  });
}

function createHolding(): StockHolding {
  return {
    holdingId: 'STOCK-0001',
    stockId: 'SKYLINE_TECH',
    principal: 50,
    originalPeriod: 2,
    remainingRounds: 1,
    purchasedRound: 0
  };
}

function resolvePlayerTransfer(state: GameState) {
  const activePlayer = state.players[state.activePlayerIndex]!;
  activePlayer.position = 1;
  const random = new SequenceRandom([1, 2]);
  const rolled = executeCommand(
    state,
    { type: 'ROLL_DICE', playerId: activePlayer.id },
    random
  ).nextState;
  const moved = executeCommand(
    rolled,
    { type: 'MOVE_ONE_STEP', playerId: activePlayer.id },
    random
  ).nextState;

  return executeCommand(
    moved,
    { type: 'RESOLVE_DESTINATION', playerId: activePlayer.id },
    random
  );
}

function expectTransferChanges(
  events: DomainEvent[],
  payerId: string,
  recipientId: string,
  amount: number
): void {
  expect(events).toContainEqual(expect.objectContaining({
    type: 'EVENT_RESOLVED',
    eventId: 'EVENT_NEIGHBOR_SUPPORT',
    changes: [
      { playerId: payerId, amount: -amount },
      { playerId: recipientId, amount }
    ]
  }));
}
