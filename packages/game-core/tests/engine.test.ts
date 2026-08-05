import { describe, expect, it } from 'vitest';
import { SequenceRandom } from '@bigmoney/game-random';
import {
  createTechnicalSliceState,
  executeCommand,
  getRent,
  getUpgradeCost,
  type GameState
} from '../src/index';

function runRollAndSteps(
  state: GameState,
  dice: number,
  extraRandomValues: number[] = []
): GameState {
  const playerId = state.players[state.activePlayerIndex]!.id;
  const random = new SequenceRandom([dice, ...extraRandomValues, 0]);
  let current = executeCommand(state, { type: 'ROLL_DICE', playerId }, random).nextState;

  while (current.turn.remainingSteps > 0 && !current.pendingInteraction) {
    current = executeCommand(current, { type: 'MOVE_ONE_STEP', playerId }, random).nextState;
  }

  return current;
}

describe('Big Money technical slice engine', () => {
  it('grants the lap reward only when moving from Finish to Start', () => {
    const state = createTechnicalSliceState();
    state.players[0]!.position = 7;
    const before = state.players[0]!.cash;

    const moved = runRollAndSteps(state, 1);

    expect(moved.players[0]!.position).toBe(0);
    expect(moved.players[0]!.cash).toBe(before + 80);
  });

  it('pauses movement when passing the stock market', () => {
    const state = createTechnicalSliceState();
    const playerId = state.players[0]!.id;
    const random = new SequenceRandom([5, 0, 0, 0]);
    let current = executeCommand(state, { type: 'ROLL_DICE', playerId }, random).nextState;

    while (!current.pendingInteraction) {
      current = executeCommand(current, { type: 'MOVE_ONE_STEP', playerId }, random).nextState;
    }

    expect(current.players[0]!.position).toBe(3);
    expect(current.turn.remainingSteps).toBe(2);
    expect(current.pendingInteraction?.type).toBe('STOCK_MARKET');
  });

  it('allows purchase of an unowned property', () => {
    const state = runRollAndSteps(createTechnicalSliceState(), 1);
    const playerId = state.players[0]!.id;
    const random = new SequenceRandom([1]);

    const resolved = executeCommand(
      state,
      { type: 'RESOLVE_DESTINATION', playerId },
      random
    ).nextState;

    expect(resolved.pendingInteraction?.type).toBe('PROPERTY_PURCHASE');

    const purchased = executeCommand(
      resolved,
      { type: 'BUY_PROPERTY', playerId },
      random
    ).nextState;

    expect(purchased.properties.A1?.ownerId).toBe(playerId);
    expect(purchased.players[0]!.cash).toBe(450);
    expect(purchased.turn.readyToEnd).toBe(true);
  });

  it('uses the frozen property upgrade and rent ratios', () => {
    expect(getUpgradeCost(50, 1)).toBe(30);
    expect(getUpgradeCost(50, 2)).toBe(40);
    expect(getUpgradeCost(50, 3)).toBe(50);

    expect(getRent(50, 0)).toBe(5);
    expect(getRent(50, 1)).toBe(15);
    expect(getRent(50, 2)).toBe(35);
    expect(getRent(50, 3)).toBe(75);
  });

  it('offers an upgrade when the owner lands on their property', () => {
    const state = createTechnicalSliceState();
    state.properties.A1!.ownerId = 'P1';
    const moved = runRollAndSteps(state, 1);
    const random = new SequenceRandom([1]);

    const resolved = executeCommand(
      moved,
      { type: 'RESOLVE_DESTINATION', playerId: 'P1' },
      random
    ).nextState;

    expect(resolved.pendingInteraction?.type).toBe('PROPERTY_UPGRADE');

    const upgraded = executeCommand(
      resolved,
      { type: 'UPGRADE_PROPERTY', playerId: 'P1' },
      random
    ).nextState;

    expect(upgraded.properties.A1?.level).toBe(1);
    expect(upgraded.players[0]!.cash).toBe(470);
  });

  it('pays rent directly to the owner', () => {
    const state = createTechnicalSliceState();
    state.activePlayerIndex = 1;
    state.properties.A1!.ownerId = 'P1';
    const moved = runRollAndSteps(state, 1);
    const random = new SequenceRandom([1]);

    const resolved = executeCommand(
      moved,
      { type: 'RESOLVE_DESTINATION', playerId: 'P2' },
      random
    ).nextState;

    expect(resolved.players[1]!.cash).toBe(495);
    expect(resolved.players[0]!.cash).toBe(505);
    expect(resolved.turn.readyToEnd).toBe(true);
  });

  it('draws a card only on final landing', () => {
    const state = createTechnicalSliceState();
    state.players[0]!.position = 4;
    const moved = runRollAndSteps(state, 1);
    const random = new SequenceRandom([0]);

    const resolved = executeCommand(
      moved,
      { type: 'RESOLVE_DESTINATION', playerId: 'P1' },
      random
    ).nextState;

    expect(resolved.pendingInteraction?.type).toBe('CARD_DRAW');
    expect(resolved.players[0]!.cards).toHaveLength(1);
  });
});
