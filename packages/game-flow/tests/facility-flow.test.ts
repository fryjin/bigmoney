import { describe, expect, it } from 'vitest';
import {
  createLocalGameState,
  type GameState
} from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import { SequenceRandom } from '@bigmoney/game-random';
import { LocalGameSession } from '../src/index';

describe('public facility payment flow orchestration', () => {
  it('presents a direct PUBLIC_FEE payment through the destination cue before turn end', () => {
    const session = createFacilitySession(100);

    reachFacilityDestination(session);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingDestination');
    expect(snapshot.cue).toMatchObject({ kind: 'DESTINATION' });
    expect(snapshot.cue?.events.map((event) => event.type)).toEqual([
      'PAYMENT_REQUESTED',
      'PAYMENT_COMPLETED',
      'TURN_READY_TO_END'
    ]);
    expect(snapshot.cue?.events).toContainEqual({
      type: 'PAYMENT_COMPLETED',
      payment: {
        id: 'PAYMENT-0001',
        payerId: 'P1',
        receiverId: null,
        amount: 30,
        reason: 'PUBLIC_FEE',
        tileId: 'RESERVED_FACILITY_01'
      }
    });

    session.presentationDone(snapshot.cue!.id);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('turnEnd');
    expect(snapshot.game.pendingInteraction).toBeNull();
  });

  it('presents a PUBLIC_FEE payment after liquidation through the existing destination cue', () => {
    const session = createFacilitySession(10, (state) => {
      state.properties.HARBOR_01 = { id: 'HARBOR_01', ownerId: 'P1', level: 0 };
    });

    reachFacilityDestination(session);
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingLiquidation');
    expect(snapshot.game.pendingInteraction).toMatchObject({
      type: 'LIQUIDATION',
      payment: {
        id: 'PAYMENT-0001',
        receiverId: null,
        amount: 30,
        reason: 'PUBLIC_FEE',
        tileId: 'RESERVED_FACILITY_01'
      }
    });

    session.confirmLiquidation('PAYMENT-0001', ['HARBOR_01']);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingLiquidation');
    expect(snapshot.cue).toMatchObject({ kind: 'DESTINATION' });
    expect(snapshot.cue?.events.map((event) => event.type)).toEqual([
      'PROPERTY_LIQUIDATED',
      'PAYMENT_COMPLETED',
      'TURN_READY_TO_END'
    ]);
    expect(snapshot.cue?.events).toContainEqual({
      type: 'PAYMENT_COMPLETED',
      payment: expect.objectContaining({ reason: 'PUBLIC_FEE', receiverId: null })
    });

    session.presentationDone(snapshot.cue!.id);
    expect(session.getSnapshot()).toMatchObject({ flow: 'turnEnd' });
  });

  it('keeps EVENT_EXPENSE on its existing result path instead of creating a destination cue', () => {
    const content = structuredClone(fullMap36Content);
    const expense = content.events.find((event) => event.kind === 'PERSONAL_EXPENSE');
    if (!expense) throw new Error('Expected a personal expense event.');
    content.events = [expense];
    const state = createLocalGameState(content, 2);
    state.players[0]!.position = 1;
    const session = new LocalGameSession(new SequenceRandom([1, 0]), content, state);

    session.roll();
    session.presentationDone(session.getSnapshot().cue!.id);
    session.presentationDone(session.getSnapshot().cue!.id);

    expect(session.getSnapshot()).toMatchObject({
      flow: 'awaitingResult',
      cue: null,
      game: {
        pendingInteraction: {
          type: 'EVENT_RESULT',
          eventId: expense.id
        }
      }
    });
  });
});

function createFacilitySession(
  cash: number,
  configure: (state: GameState) => void = () => undefined
): LocalGameSession {
  const state = createLocalGameState(fullMap36Content, 2);
  state.players[0]!.position = 13;
  state.players[0]!.cash = cash;
  configure(state);
  return new LocalGameSession(new SequenceRandom([1]), fullMap36Content, state);
}

function reachFacilityDestination(session: LocalGameSession): void {
  session.roll();
  session.presentationDone(session.getSnapshot().cue!.id);
  session.presentationDone(session.getSnapshot().cue!.id);
}
