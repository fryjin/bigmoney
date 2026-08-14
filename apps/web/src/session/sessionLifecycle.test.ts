import { describe, expect, it } from 'vitest';
import {
  createTechnicalSliceState,
  getNextActivePlayerIndex
} from '@bigmoney/game-core';
import { SeededRandom } from '@bigmoney/game-random';
import {
  createTechnicalSliceSessionLifecycle,
  isPrivateInfoHidden,
  type TechnicalSliceSessionSeed
} from './sessionLifecycle';

describe('technical slice session lifecycle', () => {
  it.each([2, 3, 4] as const)(
    'starts a canonical %i-player session from the supplied Core state',
    (playerCount) => {
      const lifecycle = createTechnicalSliceSessionLifecycle(() => {});
      const session = lifecycle.start(createSeed(playerCount));

      expect(session.getSnapshot().game.players).toHaveLength(playerCount);
      expect(lifecycle.getSession()).toBe(session);

      lifecycle.dispose();
    }
  );

  it('continues a restored save without changing its canonical roster', () => {
    const state = createTechnicalSliceState(4);
    state.activePlayerIndex = 2;
    const lifecycle = createTechnicalSliceSessionLifecycle(() => {});

    const session = lifecycle.start({
      random: new SeededRandom(20260821),
      game: state,
      flow: 'awaitingHandoff'
    });

    expect(session.getSnapshot().flow).toBe('awaitingHandoff');
    expect(session.getSnapshot().game).toEqual(state);
    expect(session.getSnapshot().game.players.map((player) => player.id)).toEqual([
      'P1',
      'P2',
      'P3',
      'P4'
    ]);

    lifecycle.dispose();
  });

  it('removes the old subscription before a replacement session becomes active', () => {
    const observedPlayerCounts: number[] = [];
    const lifecycle = createTechnicalSliceSessionLifecycle((snapshot) => {
      observedPlayerCounts.push(snapshot.game.players.length);
    });
    const oldSession = lifecycle.start(createSeed(2));
    lifecycle.start(createSeed(4));
    const callbackCountAfterReplacement = observedPlayerCounts.length;

    oldSession.roll();

    expect(observedPlayerCounts).toHaveLength(callbackCountAfterReplacement);
    expect(lifecycle.getSession()?.getSnapshot().game.players).toHaveLength(4);

    lifecycle.dispose();
  });

  it.each([
    [2, 4],
    [4, 2]
  ] as const)(
    'replaces a %i-player session with the selected canonical %i-player session',
    (firstPlayerCount, replacementPlayerCount) => {
      const lifecycle = createTechnicalSliceSessionLifecycle(() => {});
      lifecycle.start(createSeed(firstPlayerCount));
      lifecycle.start(createSeed(replacementPlayerCount));

      expect(lifecycle.getSession()?.getSnapshot().game.players).toHaveLength(
        replacementPlayerCount
      );

      lifecycle.dispose();
    }
  );

  it('uses the Core next-active-player query when a player is bankrupt', () => {
    const game = createTechnicalSliceState(4);
    game.activePlayerIndex = 0;
    game.players[1]!.bankrupt = true;

    expect(getNextActivePlayerIndex(game, game.activePlayerIndex)).toBe(2);
  });

  it('drains an old save before clearing it and writing the replacement session', async () => {
    const writes: string[] = [];
    const oldWrite = createDeferred<void>();
    const lifecycle = createTechnicalSliceSessionLifecycle(() => {});

    lifecycle.start(createSeed(2));
    lifecycle.enqueueForActiveSession(async () => {
      await oldWrite.promise;
      writes.push('old-save');
    });
    await Promise.resolve();

    const retired = lifecycle.retireAndDrain(async () => {
      writes.push('clear-save');
    });
    oldWrite.resolve();
    await retired;

    lifecycle.start(createSeed(4));
    lifecycle.enqueueForActiveSession(async () => {
      writes.push(`new-save:${lifecycle.getSession()!.getSnapshot().game.players.length}`);
    });
    await lifecycle.drain();

    expect(writes).toEqual(['old-save', 'clear-save', 'new-save:4']);

    lifecycle.dispose();
  });

  it('keeps private information hidden during session entry and handoff', () => {
    expect(isPrivateInfoHidden('turnReady', true)).toBe(true);
    expect(isPrivateInfoHidden('presentingTurnEnd', false)).toBe(true);
    expect(isPrivateInfoHidden('awaitingHandoff', false)).toBe(true);
    expect(isPrivateInfoHidden('turnReady', false)).toBe(false);
  });
});

function createSeed(playerCount: 2 | 3 | 4): TechnicalSliceSessionSeed {
  return {
    random: new SeededRandom(20260820 + playerCount),
    game: createTechnicalSliceState(playerCount),
    flow: 'turnReady'
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: ((value: T) => void) | null = null;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: (value) => resolve!(value)
  };
}
