import { describe, expect, it } from 'vitest';
import { SeededRandom, SequenceRandom } from '@bigmoney/game-random';
import { TechnicalSliceSession } from '../src/index';

describe('TechnicalSliceSession', () => {
  it('orchestrates roll, step movement and property decision', () => {
    const session = new TechnicalSliceSession(new SequenceRandom([1]));
    session.roll();

    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingRoll');
    expect(snapshot.cue?.kind).toBe('ROLL');

    session.presentationDone(snapshot.cue!.id);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingMove');
    expect(snapshot.cue?.kind).toBe('MOVE');

    session.presentationDone(snapshot.cue!.id);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingProperty');
    expect(snapshot.game.pendingInteraction?.type).toBe('PROPERTY_PURCHASE');

    session.buyProperty();
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingDecision');
    expect(snapshot.game.properties.A1?.ownerId).toBe('P1');

    session.presentationDone(snapshot.cue!.id);
    expect(session.getSnapshot().flow).toBe('turnEnd');
  });

  it('pauses and resumes movement around a stock market', () => {
    const session = new TechnicalSliceSession(
      new SequenceRandom([5, 0, 0, 0])
    );
    session.roll();

    while (session.getSnapshot().cue) {
      session.presentationDone(session.getSnapshot().cue!.id);
    }

    const snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingStock');
    expect(snapshot.game.turn.remainingSteps).toBe(2);
  });

  it('requires an explicit private handoff before the next player can roll', () => {
    const session = new TechnicalSliceSession(new SequenceRandom([1]));
    session.roll();
    drainPresentation(session);
    session.skipProperty();
    drainPresentation(session);

    expect(session.getSnapshot().flow).toBe('turnEnd');
    session.endTurn();
    let snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('presentingTurnEnd');
    expect(snapshot.game.activePlayerIndex).toBe(1);

    drainPresentation(session);
    snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingHandoff');

    session.roll();
    expect(session.getSnapshot().flow).toBe('awaitingHandoff');
    expect(session.getSnapshot().error).toContain('期望 turnReady');

    session.clearError();
    session.confirmHandoff();
    expect(session.getSnapshot().flow).toBe('turnReady');
  });

  it('restores an awaiting-handoff stable boundary after refresh', () => {
    const initial = new TechnicalSliceSession(new SequenceRandom([1]));
    initial.roll();
    drainPresentation(initial);
    initial.skipProperty();
    drainPresentation(initial);
    initial.endTurn();
    drainPresentation(initial);

    const restored = new TechnicalSliceSession(
      new SequenceRandom([1]),
      initial.getSnapshot().game,
      'awaitingHandoff'
    );

    expect(restored.getSnapshot().flow).toBe('awaitingHandoff');
    expect(restored.getSnapshot().game.activePlayerIndex).toBe(1);
    restored.confirmHandoff();
    expect(restored.getSnapshot().flow).toBe('turnReady');
  });

  it('runs eight consecutive player turns without a stuck flow', () => {
    const session = new TechnicalSliceSession(new SeededRandom(20260806));

    for (let turn = 0; turn < 8; turn += 1) {
      playCompleteTurn(session);
      const snapshot = session.getSnapshot();
      expect(snapshot.flow).toBe('turnReady');
      expect(snapshot.error).toBeNull();
      expect(snapshot.game.pendingInteraction).toBeNull();
      expect(snapshot.game.turn.rolledValue).toBeNull();
      expect(snapshot.game.turn.remainingSteps).toBe(0);
    }

    expect(session.getSnapshot().game.round).toBe(5);
  });
});

function playCompleteTurn(session: TechnicalSliceSession): void {
  session.roll();

  for (let guard = 0; guard < 120; guard += 1) {
    const snapshot = session.getSnapshot();

    if (snapshot.cue) {
      session.presentationDone(snapshot.cue.id);
      continue;
    }

    switch (snapshot.flow) {
      case 'awaitingStock':
        session.resolveStockMarket(null);
        break;
      case 'awaitingProperty':
        session.skipProperty();
        break;
      case 'awaitingUpgrade':
        session.skipUpgrade();
        break;
      case 'awaitingResult': {
        const pending = snapshot.game.pendingInteraction;
        if (pending?.type === 'CARD_REPLACEMENT') {
          session.chooseCardToDiscard(pending.candidateCards[0]!.instanceId);
        } else {
          session.acknowledgeResult();
        }
        break;
      }
      case 'turnEnd':
        session.endTurn();
        break;
      case 'awaitingHandoff':
        session.confirmHandoff();
        return;
      default:
        break;
    }
  }

  throw new Error('Technical slice turn did not reach handoff within the guard limit.');
}

function drainPresentation(session: TechnicalSliceSession): void {
  for (let guard = 0; guard < 40; guard += 1) {
    const cue = session.getSnapshot().cue;
    if (!cue) return;
    session.presentationDone(cue.id);
  }

  throw new Error('Presentation queue did not drain.');
}
