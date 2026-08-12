import { describe, expect, it } from 'vitest';
import {
  createTechnicalSliceState,
  type GameState,
  type PlayerState
} from '@bigmoney/game-core';
import { SequenceRandom } from '@bigmoney/game-random';
import { TechnicalSliceSession } from '../src/index';

describe('forced payment flow orchestration', () => {
  it('presents a solvent forced payment and then reaches turn end without liquidation', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 100;
    });

    reachDestination(session);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingDestination');
    expect(snapshot.cue?.kind).toBe('DESTINATION');
    expect(snapshot.cue?.events.map((event) => event.type)).toContain('PAYMENT_COMPLETED');

    session.presentationDone(snapshot.cue!.id);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('turnEnd');
    expect(snapshot.game.pendingInteraction).toBeNull();
  });

  it('enters awaiting liquidation and rejects normal turn commands', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 10;
      state.properties.A2!.ownerId = 'P2';
    });

    reachDestination(session);
    const before = session.getSnapshot();
    expect(before.flow).toBe('awaitingLiquidation');
    expect(before.game.pendingInteraction).toMatchObject({
      type: 'LIQUIDATION',
      playerId: 'P2',
      payment: { id: 'PAYMENT-0001' }
    });

    session.roll();
    session.endTurn();
    session.buyProperty();
    session.upgradeProperty();

    const after = session.getSnapshot();
    expect(after.flow).toBe('awaitingLiquidation');
    expect(after.domainRevision).toBe(before.domainRevision);
    expect(after.game).toEqual(before.game);
  });

  it('keeps the canonical payment pending after a partial liquidation', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 10;
      state.properties.A2!.ownerId = 'P2';
      state.properties.A3!.ownerId = 'P2';
    });

    reachDestination(session);
    const beforeConfirmation = session.getSnapshot();
    session.confirmLiquidation('PAYMENT-9999', ['A2']);
    expect(session.getSnapshot().flow).toBe('awaitingLiquidation');
    expect(session.getSnapshot().domainRevision).toBe(beforeConfirmation.domainRevision);

    session.confirmLiquidation('PAYMENT-0001', ['A2']);

    const snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingLiquidation');
    expect(snapshot.cue).toBeNull();
    expect(snapshot.game.pendingInteraction).toMatchObject({
      type: 'LIQUIDATION',
      payment: { id: 'PAYMENT-0001' }
    });
    expect(snapshot.game.properties.A2).toMatchObject({ ownerId: null, level: 0 });
    expect(snapshot.lastEvents.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'LIQUIDATION_REQUIRED'
    ]);
  });

  it('presents a completed liquidation once and rejects duplicate or stale confirmations', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 50;
      state.properties.A2!.ownerId = 'P2';
    });

    reachDestination(session);
    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingLiquidation');
    expect(snapshot.cue?.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PAYMENT_COMPLETED',
      'RENT_PAID',
      'TURN_READY_TO_END'
    ]);

    const domainRevision = snapshot.domainRevision;
    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    snapshot = session.getSnapshot();
    expect(snapshot.domainRevision).toBe(domainRevision);
    expect(snapshot.game.properties.A2).toMatchObject({ ownerId: null, level: 0 });

    session.presentationDone(snapshot.cue!.id);
    expect(session.getSnapshot().flow).toBe('turnEnd');

    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    expect(session.getSnapshot().flow).toBe('turnEnd');
  });

  it('presents bankruptcy, uses Core to skip consecutive bankrupt players, and then requires handoff', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 10;
      state.properties.A2!.ownerId = 'P2';
      state.players.push(createPlayerLike(state.players[0]!, 'P3', true));
      state.players.push(createPlayerLike(state.players[0]!, 'P4', false));
    });

    reachDestination(session);
    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingBankruptcy');
    expect(snapshot.cue?.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PLAYER_BANKRUPT'
    ]);

    session.presentationDone(snapshot.cue!.id);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingHandoff');
    expect(snapshot.game.activePlayerIndex).toBe(3);
    expect(snapshot.game.players[3]!.id).toBe('P4');
    expect(snapshot.game.turn.rolledValue).toBeNull();
    expect(snapshot.lastEvents.map((event) => event.type)).toContain('TURN_ENDED');

    session.confirmHandoff();
    expect(session.getSnapshot().flow).toBe('turnReady');
  });

  it('uses the Core turn operation to skip multiple bankrupt players after a normal turn', () => {
    const state = createTechnicalSliceState();
    state.players.push(
      createPlayerLike(state.players[0]!, 'P3', true),
      createPlayerLike(state.players[0]!, 'P4', false)
    );
    state.players[1]!.bankrupt = true;
    const session = new TechnicalSliceSession(new SequenceRandom([1]), state);

    session.roll();
    session.presentationDone(session.getSnapshot().cue!.id);
    session.presentationDone(session.getSnapshot().cue!.id);
    session.skipProperty();
    session.presentationDone(session.getSnapshot().cue!.id);
    session.endTurn();
    session.presentationDone(session.getSnapshot().cue!.id);

    const snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingHandoff');
    expect(snapshot.game.activePlayerIndex).toBe(3);
    expect(snapshot.game.players[3]!.id).toBe('P4');
  });

  it('reaches the terminal finished state and rejects later commands and stale presentations', () => {
    const session = createRentSession((state) => {
      state.players[1]!.cash = 10;
      state.properties.A2!.ownerId = 'P2';
    });

    reachDestination(session);
    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingFinished');
    expect(snapshot.game).toMatchObject({ status: 'FINISHED', winnerId: 'P1' });
    const finishedCueId = snapshot.cue!.id;

    session.presentationDone(finishedCueId);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('finished');

    session.roll();
    session.endTurn();
    session.buyProperty();
    session.upgradeProperty();
    session.confirmLiquidation('PAYMENT-0001', ['A2']);
    session.confirmHandoff();
    session.presentationDone(finishedCueId);

    expect(session.getSnapshot().flow).toBe('finished');
    expect(session.getSnapshot().game).toEqual(snapshot.game);
  });

  it('restores awaiting liquidation without a cue or changing the canonical payment', () => {
    const source = createRentSession((state) => {
      state.players[1]!.cash = 10;
      state.properties.A2!.ownerId = 'P2';
    });
    reachDestination(source);
    const savedGame = source.getSnapshot().game;

    const restored = new TechnicalSliceSession(
      new SequenceRandom([1]),
      savedGame,
      'awaitingLiquidation'
    );
    const snapshot = restored.getSnapshot();

    expect(snapshot.flow).toBe('awaitingLiquidation');
    expect(snapshot.cue).toBeNull();
    expect(snapshot.lastEvents).toEqual([]);
    expect(snapshot.game).toEqual(savedGame);
    expect(snapshot.game.pendingInteraction).toMatchObject({
      type: 'LIQUIDATION',
      payment: { id: 'PAYMENT-0001' }
    });

    restored.roll();
    restored.endTurn();
    expect(restored.getSnapshot().flow).toBe('awaitingLiquidation');
    expect(restored.getSnapshot().game).toEqual(savedGame);
  });

  it('restores finished without a cue or changing the winner state', () => {
    const savedGame = createTechnicalSliceState();
    savedGame.players[1]!.bankrupt = true;
    savedGame.status = 'FINISHED';
    savedGame.winnerId = 'P1';

    const restored = new TechnicalSliceSession(
      new SequenceRandom([1]),
      savedGame,
      'finished'
    );
    const snapshot = restored.getSnapshot();

    expect(snapshot.flow).toBe('finished');
    expect(snapshot.cue).toBeNull();
    expect(snapshot.lastEvents).toEqual([]);
    expect(snapshot.game).toEqual(savedGame);
    expect(snapshot.game.winnerId).toBe('P1');

    restored.roll();
    restored.endTurn();
    expect(restored.getSnapshot().flow).toBe('finished');
    expect(restored.getSnapshot().game).toEqual(savedGame);
  });
});

function createRentSession(configure: (state: GameState) => void): TechnicalSliceSession {
  const state = createTechnicalSliceState();
  state.activePlayerIndex = 1;
  state.players[1]!.position = 0;
  state.properties.A1!.ownerId = 'P1';
  state.properties.A1!.level = 3;
  configure(state);
  return new TechnicalSliceSession(new SequenceRandom([1]), state);
}

function reachDestination(session: TechnicalSliceSession): void {
  session.roll();
  session.presentationDone(session.getSnapshot().cue!.id);
  session.presentationDone(session.getSnapshot().cue!.id);
}

function createPlayerLike(
  player: PlayerState,
  id: string,
  bankrupt: boolean
): PlayerState {
  return {
    ...structuredClone(player),
    id,
    name: id,
    cash: 500,
    position: 0,
    bankrupt,
    cards: [],
    stocks: []
  };
}
