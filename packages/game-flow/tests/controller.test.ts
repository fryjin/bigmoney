import { describe, expect, it } from 'vitest';
import { SequenceRandom } from '@bigmoney/game-random';
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
});
