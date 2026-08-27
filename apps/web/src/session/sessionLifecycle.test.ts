import { describe, expect, it } from 'vitest';
import {
  createLocalGameState,
  getNextActivePlayerIndex
} from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import { SeededRandom } from '@bigmoney/game-random';
import {
  createLocalGameSessionLifecycle,
  isPrivateInfoHidden,
  type LocalGameSessionSeed
} from './sessionLifecycle';

describe('local game session lifecycle', () => {
  it.each([2, 3, 4] as const)(
    'starts a canonical %i-player session from the supplied Core state',
    (playerCount) => {
      const lifecycle = createLocalGameSessionLifecycle(() => {});
      const session = lifecycle.start(createSeed(playerCount));

      const game = session.getSnapshot().game;
      expect(game.boardVersion).toBe(fullMap36Content.boardVersion);
      expect(game.players).toHaveLength(playerCount);
      expect(game.players.every((player) => player.position === 0)).toBe(true);
      expect(Object.keys(game.properties)).toHaveLength(20);
      expect(lifecycle.getSession()).toBe(session);

      lifecycle.dispose();
    }
  );

  it('continues a restored save without changing its canonical roster', () => {
    const state = createLocalGameState(fullMap36Content, 4);
    state.activePlayerIndex = 2;
    const lifecycle = createLocalGameSessionLifecycle(() => {});

    const session = lifecycle.start({
      random: new SeededRandom(20260821),
      content: fullMap36Content,
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
    const lifecycle = createLocalGameSessionLifecycle((snapshot) => {
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
      const lifecycle = createLocalGameSessionLifecycle(() => {});
      lifecycle.start(createSeed(firstPlayerCount));
      lifecycle.start(createSeed(replacementPlayerCount));

      expect(lifecycle.getSession()?.getSnapshot().game.players).toHaveLength(
        replacementPlayerCount
      );

      lifecycle.dispose();
    }
  );

  it('uses the Core next-active-player query when a player is bankrupt', () => {
    const game = createLocalGameState(fullMap36Content, 4);
    game.activePlayerIndex = 0;
    game.players[1]!.bankrupt = true;

    expect(getNextActivePlayerIndex(game, game.activePlayerIndex)).toBe(2);
  });

  it('drains an old save before clearing it and writing the replacement session', async () => {
    const writes: string[] = [];
    const oldWrite = createDeferred<void>();
    const lifecycle = createLocalGameSessionLifecycle(() => {});

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

  it('uses the supplied full-map content for Core commands', () => {
    const game = createLocalGameState(fullMap36Content, 2);
    game.players[0]!.position = 7;
    const lifecycle = createLocalGameSessionLifecycle(() => {});
    const session = lifecycle.start({
      random: new SeededRandom(20260826),
      content: fullMap36Content,
      game,
      flow: 'turnReady'
    });

    session.roll();
    const rollCue = session.getSnapshot().cue;
    expect(rollCue?.kind).toBe('ROLL');
    session.presentationDone(rollCue!.id);

    expect(session.getSnapshot().game.players[0]!.position).toBe(8);
    lifecycle.dispose();
  });
});

function createSeed(playerCount: 2 | 3 | 4): LocalGameSessionSeed {
  return {
    random: new SeededRandom(20260820 + playerCount),
    content: fullMap36Content,
    game: createLocalGameState(fullMap36Content, playerCount),
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
