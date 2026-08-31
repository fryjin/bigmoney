import { describe, expect, it } from 'vitest';
import { fullMap36Content } from '@bigmoney/game-content';
import { SequenceRandom } from '@bigmoney/game-random';
import {
  createLocalGameState,
  executeCommand,
  type CommandResult,
  type GameState,
  type LocalPlayerCount
} from '../src/index';

const contentForEngine = fullMap36Content;

function createFullMapState(playerCount: LocalPlayerCount = 2): GameState {
  return createLocalGameState(fullMap36Content, playerCount);
}

function landOnFacility(state: GameState, facilityIndex: 14 | 25): CommandResult {
  const playerId = state.players[state.activePlayerIndex]!.id;
  state.players[state.activePlayerIndex]!.position = facilityIndex - 1;
  const random = new SequenceRandom([1]);
  const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId }, random, contentForEngine).nextState;
  const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId }, random, contentForEngine).nextState;

  return executeCommand(moved, { type: 'RESOLVE_DESTINATION', playerId }, random, contentForEngine);
}

function getLiquidationPayment(result: CommandResult) {
  const pending = result.nextState.pendingInteraction;
  if (!pending || pending.type !== 'LIQUIDATION') {
    throw new Error('Expected a pending liquidation payment.');
  }
  return pending.payment;
}

describe('full-map public facilities', () => {
  it.each([
    [14, 30, 'RESERVED_FACILITY_01'],
    [25, 50, 'RESERVED_FACILITY_02']
  ] as const)('charges facility %i directly from its canonical fee', (index, fee, tileId) => {
    const result = landOnFacility(createFullMapState(), index);

    expect(result.nextState.players[0]!.cash).toBe(500 - fee);
    expect(result.nextState.pendingInteraction).toBeNull();
    expect(result.nextState.turn.readyToEnd).toBe(true);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'PAYMENT_REQUESTED',
      payment: expect.objectContaining({
        payerId: 'P1',
        receiverId: null,
        amount: fee,
        reason: 'PUBLIC_FEE',
        tileId
      })
    }));
    expect(result.events.map((event) => event.type)).toEqual([
      'PAYMENT_REQUESTED',
      'PAYMENT_COMPLETED',
      'TURN_READY_TO_END'
    ]);
  });

  it.each([
    [14, 30],
    [25, 50]
  ] as const)('does not bankrupt a player whose cash exactly matches facility %i fee', (index, fee) => {
    const state = createFullMapState();
    state.players[0]!.cash = fee;

    const result = landOnFacility(state, index);

    expect(result.nextState.players[0]).toMatchObject({ cash: 0, bankrupt: false });
    expect(result.nextState.pendingInteraction).toBeNull();
    expect(result.nextState.turn.readyToEnd).toBe(true);
  });

  it('does not charge while moving through a facility', () => {
    const state = createFullMapState();
    state.players[0]!.position = 13;
    const random = new SequenceRandom([2]);
    const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P1' }, random, contentForEngine).nextState;
    const firstMove = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P1' }, random, contentForEngine);
    const secondMove = executeCommand(firstMove.nextState, { type: 'MOVE_ONE_STEP', playerId: 'P1' }, random, contentForEngine);

    expect(firstMove.nextState.players[0]!.position).toBe(14);
    expect(secondMove.nextState.players[0]!.position).toBe(15);
    expect(secondMove.nextState.players[0]!.cash).toBe(500);
    expect(secondMove.nextState.pendingInteraction).toBeNull();
    expect([...firstMove.events, ...secondMove.events].map((event) => event.type)).toEqual([
      'PLAYER_MOVED',
      'PLAYER_MOVED'
    ]);
  });

  it('enters the existing liquidation interaction without deducting available cash', () => {
    const state = createFullMapState();
    state.players[0]!.cash = 10;
    state.properties.HARBOR_01!.ownerId = 'P1';

    const result = landOnFacility(state, 14);
    const payment = getLiquidationPayment(result);

    expect(result.nextState.players[0]!.cash).toBe(10);
    expect(payment).toMatchObject({
      payerId: 'P1',
      receiverId: null,
      amount: 30,
      reason: 'PUBLIC_FEE',
      tileId: 'RESERVED_FACILITY_01'
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'PAYMENT_REQUESTED',
      'LIQUIDATION_REQUIRED'
    ]);
  });

  it('completes a public fee after liquidating an eligible property', () => {
    const state = createFullMapState();
    state.players[0]!.cash = 10;
    state.properties.HARBOR_01!.ownerId = 'P1';
    const started = landOnFacility(state, 14);
    const payment = getLiquidationPayment(started);

    const result = executeCommand(
      started.nextState,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P1', paymentId: payment.id, propertyIds: ['HARBOR_01'] },
      new SequenceRandom([1]),
      contentForEngine
    );

    expect(result.nextState.properties.HARBOR_01).toMatchObject({ ownerId: null, level: 0 });
    expect(result.nextState.players[0]!.cash).toBe(5);
    expect(result.nextState.pendingInteraction).toBeNull();
    expect(result.nextState.turn.readyToEnd).toBe(true);
    expect(result.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PAYMENT_COMPLETED',
      'TURN_READY_TO_END'
    ]);
  });

  it('bankrupts a facility payer after liquidating every asset still leaves the fee underfunded', () => {
    const state = createFullMapState();
    state.players[0]!.cash = 4;
    state.properties.HARBOR_01!.ownerId = 'P1';
    const started = landOnFacility(state, 14);
    const payment = getLiquidationPayment(started);

    const result = executeCommand(
      started.nextState,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P1', paymentId: payment.id, propertyIds: ['HARBOR_01'] },
      new SequenceRandom([1]),
      contentForEngine
    );

    expect(result.nextState.players[0]).toMatchObject({ cash: 0, bankrupt: true });
    expect(result.nextState.status).toBe('FINISHED');
    expect(result.nextState.winnerId).toBe('P2');
    expect(result.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PLAYER_BANKRUPT',
      'GAME_FINISHED'
    ]);
  });

  it('preserves the existing multiplayer bankruptcy handoff path', () => {
    const state = createFullMapState(3);
    state.players[0]!.cash = 10;

    const bankrupt = landOnFacility(state, 14);
    const advanced = executeCommand(
      bankrupt.nextState,
      { type: 'ADVANCE_AFTER_BANKRUPTCY', playerId: 'P1' },
      new SequenceRandom([1]),
      contentForEngine
    );

    expect(bankrupt.nextState.status).toBe('IN_PROGRESS');
    expect(bankrupt.nextState.winnerId).toBeNull();
    expect(advanced.nextState.activePlayerIndex).toBe(1);
    expect(advanced.nextState.players[1]!.id).toBe('P2');
    expect(advanced.nextState.turn).toEqual({
      rolledValue: null,
      remainingSteps: 0,
      triggeredStockMarkets: [],
      readyToEnd: false
    });
  });
});
