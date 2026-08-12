import { describe, expect, it } from 'vitest';
import { SequenceRandom } from '@bigmoney/game-random';
import {
  createTechnicalSliceState,
  executeCommand,
  getActivePlayers,
  getLiquidationCandidates,
  getLiquidationValue,
  getNextActivePlayerIndex,
  getWinnerId,
  quoteLiquidation,
  type GameState,
  type StockHolding
} from '../src/index';

function startRentPayment(
  configure: (state: GameState) => void
): { state: GameState; paymentId: string } {
  const state = createTechnicalSliceState();
  state.activePlayerIndex = 1;
  state.players[1]!.position = 0;
  state.properties.A1!.ownerId = 'P1';
  state.properties.A1!.level = 3;
  configure(state);

  const random = new SequenceRandom([1]);
  const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P2' }, random).nextState;
  const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P2' }, random).nextState;
  const result = executeCommand(moved, { type: 'RESOLVE_DESTINATION', playerId: 'P2' }, random);
  const payment = result.nextState.pendingInteraction;

  if (!payment || payment.type !== 'LIQUIDATION') {
    throw new Error('Expected a pending liquidation payment.');
  }

  return { state: result.nextState, paymentId: payment.payment.id };
}

function startExpensePayment(
  configure: (state: GameState) => void
): { state: GameState; paymentId: string } {
  const state = createTechnicalSliceState();
  state.players[0]!.position = 1;
  configure(state);

  const random = new SequenceRandom([1, 1]);
  const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P1' }, random).nextState;
  const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P1' }, random).nextState;
  const result = executeCommand(moved, { type: 'RESOLVE_DESTINATION', playerId: 'P1' }, random);
  const payment = result.nextState.pendingInteraction;

  if (!payment || payment.type !== 'LIQUIDATION') {
    throw new Error('Expected a pending liquidation payment.');
  }

  return { state: result.nextState, paymentId: payment.payment.id };
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

describe('forced payment, liquidation, and bankruptcy', () => {
  it('uses exactly half of the base purchase price as liquidation value', () => {
    expect(getLiquidationValue(50)).toBe(25);
    expect(getLiquidationValue(60)).toBe(30);
    expect(getLiquidationValue(70)).toBe(35);
  });

  it('settles a solvent rent payment through the unified payment events once', () => {
    const state = createTechnicalSliceState();
    state.activePlayerIndex = 1;
    state.players[1]!.position = 0;
    state.properties.A1!.ownerId = 'P1';
    const random = new SequenceRandom([1]);

    const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P2' }, random).nextState;
    const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P2' }, random).nextState;
    const result = executeCommand(moved, { type: 'RESOLVE_DESTINATION', playerId: 'P2' }, random);

    expect(result.nextState.players[1]!.cash).toBe(495);
    expect(result.nextState.players[0]!.cash).toBe(505);
    expect(result.events.map((event) => event.type)).toEqual([
      'PAYMENT_REQUESTED',
      'PAYMENT_COMPLETED',
      'RENT_PAID',
      'TURN_READY_TO_END'
    ]);
  });

  it('provides property-only candidates and a deterministic quote for an insufficient payment', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 10;
      nextState.players[1]!.stocks = [createHolding()];
      nextState.properties.A2!.ownerId = 'P2';
      nextState.properties.A2!.level = 3;
      nextState.properties.A3!.ownerId = 'P2';
    });

    expect(paymentId).toBe('PAYMENT-0001');
    expect(getLiquidationCandidates(state, 'P2').map((candidate) => candidate.propertyId)).toEqual([
      'A2',
      'A3'
    ]);
    expect(quoteLiquidation(state, paymentId, ['A2'])).toMatchObject({
      paymentId,
      amountDue: 75,
      availableCash: 10,
      liquidationValue: 30,
      cashAfterLiquidation: 40,
      remainingAmount: 35,
      canCompletePayment: false
    });
  });

  it('liquidates the selected property, resets its level, and retains excess cash after paying', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 50;
      nextState.properties.A2!.ownerId = 'P2';
      nextState.properties.A2!.level = 3;
    });
    const result = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2'] },
      new SequenceRandom([1])
    );

    expect(result.nextState.properties.A2).toMatchObject({ ownerId: null, level: 0 });
    expect(result.nextState.players[1]!.cash).toBe(5);
    expect(result.nextState.players[0]!.cash).toBe(575);
    expect(result.nextState.pendingInteraction).toBeNull();
    expect(result.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PAYMENT_COMPLETED',
      'RENT_PAID',
      'TURN_READY_TO_END'
    ]);
  });

  it('liquidates every confirmed property, including an over-complete selection', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 20;
      nextState.properties.A2!.ownerId = 'P2';
      nextState.properties.A3!.ownerId = 'P2';
    });
    const result = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2', 'A3'] },
      new SequenceRandom([1])
    );

    expect(result.nextState.properties.A2).toMatchObject({ ownerId: null, level: 0 });
    expect(result.nextState.properties.A3).toMatchObject({ ownerId: null, level: 0 });
    expect(result.nextState.players[1]!.cash).toBe(10);
    expect(result.nextState.players[0]!.cash).toBe(575);
  });

  it('keeps the same payment pending after a partial liquidation until it can be paid', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 10;
      nextState.properties.A2!.ownerId = 'P2';
      nextState.properties.A3!.ownerId = 'P2';
    });
    const partial = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2'] },
      new SequenceRandom([1])
    );

    expect(partial.nextState.pendingInteraction).toMatchObject({
      type: 'LIQUIDATION',
      payment: { id: paymentId }
    });
    expect(partial.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'LIQUIDATION_REQUIRED'
    ]);

    const completed = executeCommand(
      partial.nextState,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A3'] },
      new SequenceRandom([1])
    );

    expect(completed.nextState.pendingInteraction).toBeNull();
    expect(completed.nextState.players[1]!.cash).toBe(0);
  });

  it('rejects empty, duplicate, and non-owned liquidation selections', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 10;
      nextState.properties.A2!.ownerId = 'P2';
    });
    const random = new SequenceRandom([1]);

    expect(() =>
      executeCommand(
        state,
        { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: [] },
        random
      )
    ).toThrow();
    expect(() =>
      executeCommand(
        state,
        { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2', 'A2'] },
        random
      )
    ).toThrow();
    expect(() =>
      executeCommand(
        state,
        { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A1'] },
        random
      )
    ).toThrow();
  });

  it('bankrupts a payer after all property value is exhausted, pays the receiver what remains, and keeps stocks', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 10;
      nextState.players[1]!.stocks = [createHolding()];
      nextState.players[1]!.cards = [{ instanceId: 'CARD-0001', cardId: 'CARD_REROLL' }];
      nextState.properties.A2!.ownerId = 'P2';
      nextState.properties.A2!.level = 2;
    });
    const result = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2'] },
      new SequenceRandom([1])
    );

    expect(result.nextState.players[1]).toMatchObject({ cash: 0, bankrupt: true });
    expect(result.nextState.players[1]!.stocks).toEqual([createHolding()]);
    expect(result.nextState.players[1]!.cards).toEqual([
      { instanceId: 'CARD-0001', cardId: 'CARD_REROLL' }
    ]);
    expect(result.nextState.players[0]!.cash).toBe(540);
    expect(result.nextState.status).toBe('FINISHED');
    expect(result.nextState.winnerId).toBe('P1');
    expect(result.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PLAYER_BANKRUPT',
      'GAME_FINISHED'
    ]);
  });

  it('supports a receiver-less payment by writing off the unpaid amount and never crediting another player', () => {
    const { state, paymentId } = startExpensePayment((nextState) => {
      nextState.players[0]!.cash = 2;
      nextState.properties.A1!.ownerId = 'P1';
    });
    const result = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P1', paymentId, propertyIds: ['A1'] },
      new SequenceRandom([1])
    );

    expect(result.nextState.players[0]).toMatchObject({ cash: 0, bankrupt: true });
    expect(result.nextState.players[1]!.cash).toBe(500);
    expect(result.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PLAYER_BANKRUPT',
      'GAME_FINISHED'
    ]);
  });

  it('rejects an old confirmation after the payment has already completed', () => {
    const { state, paymentId } = startRentPayment((nextState) => {
      nextState.players[1]!.cash = 50;
      nextState.properties.A2!.ownerId = 'P2';
    });
    const completed = executeCommand(
      state,
      { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2'] },
      new SequenceRandom([1])
    ).nextState;

    expect(() =>
      executeCommand(
        completed,
        { type: 'CONFIRM_LIQUIDATION', playerId: 'P2', paymentId, propertyIds: ['A2'] },
        new SequenceRandom([1])
      )
    ).toThrow();
  });

  it('rejects an underfunded property purchase without entering liquidation', () => {
    const state = createTechnicalSliceState();
    state.players[0]!.cash = 40;
    const random = new SequenceRandom([1]);
    const rolled = executeCommand(state, { type: 'ROLL_DICE', playerId: 'P1' }, random).nextState;
    const moved = executeCommand(rolled, { type: 'MOVE_ONE_STEP', playerId: 'P1' }, random).nextState;
    const offered = executeCommand(
      moved,
      { type: 'RESOLVE_DESTINATION', playerId: 'P1' },
      random
    ).nextState;

    expect(() => executeCommand(offered, { type: 'BUY_PROPERTY', playerId: 'P1' }, random)).toThrow();
    expect(offered.pendingInteraction?.type).toBe('PROPERTY_PURCHASE');
  });

  it('skips bankrupt players for stock settlement and active-player selection', () => {
    const state = createTechnicalSliceState();
    state.activePlayerIndex = 1;
    state.players[0]!.bankrupt = true;
    state.players[0]!.stocks = [createHolding()];
    state.turn.readyToEnd = true;

    const result = executeCommand(
      state,
      { type: 'END_TURN', playerId: 'P2' },
      new SequenceRandom([20])
    );

    expect(result.nextState.players[0]!.stocks).toEqual([createHolding()]);
    expect(result.events.some((event) => event.type === 'STOCK_SETTLED')).toBe(false);
    expect(getActivePlayers(result.nextState).map((player) => player.id)).toEqual(['P2']);
    expect(getNextActivePlayerIndex(result.nextState, 1)).toBe(1);
    expect(getWinnerId(result.nextState)).toBe('P2');
    expect(() =>
      executeCommand(
        { ...result.nextState, activePlayerIndex: 0 },
        { type: 'ROLL_DICE', playerId: 'P1' },
        new SequenceRandom([1])
      )
    ).toThrow();
  });
});
