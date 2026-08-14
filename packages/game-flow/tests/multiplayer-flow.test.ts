import { describe, expect, it } from 'vitest';
import {
  createTechnicalSliceState,
  type GameState,
  type LocalPlayerCount
} from '@bigmoney/game-core';
import { SeededRandom, SequenceRandom } from '@bigmoney/game-random';
import { TechnicalSliceSession } from '../src/index';

describe('formal multiplayer flow orchestration', () => {
  it.each([2, 3, 4] as const)(
    'hands off every canonical player in order in a %i-player game',
    (playerCount) => {
      const state = createTechnicalSliceState(playerCount);
      const session = new TechnicalSliceSession(new SeededRandom(20260814), state);
      const expectedPlayerIds = state.players.map((player) => player.id);

      for (let turn = 0; turn < playerCount; turn += 1) {
        playToHandoff(session);
        const snapshot = session.getSnapshot();
        expect(snapshot.flow).toBe('awaitingHandoff');
        expect(snapshot.game.players[snapshot.game.activePlayerIndex]!.id).toBe(
          expectedPlayerIds[(turn + 1) % playerCount]
        );
        session.confirmHandoff();
        expect(session.getSnapshot().flow).toBe('turnReady');
      }

      expect(session.getSnapshot().game.round).toBe(2);
    }
  );

  it.each([
    [3, ['P2'], 'P3'],
    [4, ['P2', 'P3'], 'P4']
  ] as const)(
    'uses Core active-player order to skip bankrupt players in a %i-player handoff',
    (playerCount, bankruptPlayerIds, expectedPlayerId) => {
      const state = createTechnicalSliceState(playerCount);
      for (const playerId of bankruptPlayerIds) {
        state.players.find((player) => player.id === playerId)!.bankrupt = true;
      }
      const session = new TechnicalSliceSession(new SeededRandom(20260815), state);

      playToHandoff(session);

      const snapshot = session.getSnapshot();
      expect(snapshot.flow).toBe('awaitingHandoff');
      expect(snapshot.game.players[snapshot.game.activePlayerIndex]!.id).toBe(
        expectedPlayerId
      );
      session.confirmHandoff();
      const readySnapshot = session.getSnapshot();
      expect(readySnapshot.flow).toBe('turnReady');
      expect(
        readySnapshot.game.players[readySnapshot.game.activePlayerIndex]!.bankrupt
      ).toBe(false);
    }
  );

  it('wraps a four-player handoff past a bankrupt P1 to P2', () => {
    const state = createTechnicalSliceState(4);
    state.activePlayerIndex = 3;
    state.players[0]!.bankrupt = true;
    const session = new TechnicalSliceSession(new SeededRandom(20260816), state);

    playToHandoff(session);

    const snapshot = session.getSnapshot();
    expect(snapshot.flow).toBe('awaitingHandoff');
    expect(snapshot.game.players[snapshot.game.activePlayerIndex]!.id).toBe('P2');
  });

  it.each([3, 4] as const)(
    'presents a last-survivor %i-player bankruptcy once before becoming finished',
    (playerCount) => {
      const session = createFinalBankruptcySession(playerCount);

      reachRentDestination(session);
      session.confirmLiquidation('PAYMENT-0001', ['A2']);
      let snapshot = session.getSnapshot();
      expect(snapshot.flow).toBe('presentingFinished');
      expect(snapshot.game).toMatchObject({ status: 'FINISHED', winnerId: 'P1' });
      const cueId = snapshot.cue!.id;

      session.presentationDone(cueId);
      snapshot = session.getSnapshot();
      expect(snapshot.flow).toBe('finished');

      session.roll();
      session.endTurn();
      session.confirmHandoff();
      expect(session.getSnapshot().flow).toBe('finished');
      expect(session.getSnapshot().game).toEqual(snapshot.game);
    }
  );

  it.each([3, 4] as const)(
    'restores all multiplayer stable phases without replaying a cue in a %i-player game',
    (playerCount) => {
      const handoffSource = new TechnicalSliceSession(
        new SeededRandom(20260817),
        createTechnicalSliceState(playerCount)
      );
      playToHandoff(handoffSource);
      assertStableRestore(
        handoffSource.getSnapshot().game,
        'awaitingHandoff',
        playerCount
      );

      const liquidationSource = createRentSession(playerCount, (state) => {
        state.players[1]!.cash = 10;
        state.properties.A2!.ownerId = 'P2';
      });
      reachRentDestination(liquidationSource);
      assertStableRestore(
        liquidationSource.getSnapshot().game,
        'awaitingLiquidation',
        playerCount
      );

      const finishedSource = createFinalBankruptcySession(playerCount);
      reachRentDestination(finishedSource);
      finishedSource.confirmLiquidation('PAYMENT-0001', ['A2']);
      finishedSource.presentationDone(finishedSource.getSnapshot().cue!.id);
      assertStableRestore(finishedSource.getSnapshot().game, 'finished', playerCount);
    }
  );
});

function createRentSession(
  playerCount: LocalPlayerCount,
  configure: (state: GameState) => void
): TechnicalSliceSession {
  const state = createTechnicalSliceState(playerCount);
  state.activePlayerIndex = 1;
  state.players[1]!.position = 0;
  state.properties.A1!.ownerId = 'P1';
  state.properties.A1!.level = 3;
  configure(state);
  return new TechnicalSliceSession(new SequenceRandom([1]), state);
}

function createFinalBankruptcySession(playerCount: LocalPlayerCount): TechnicalSliceSession {
  return createRentSession(playerCount, (state) => {
    state.players[1]!.cash = 10;
    state.properties.A2!.ownerId = 'P2';
    for (const player of state.players.slice(2)) player.bankrupt = true;
  });
}

function reachRentDestination(session: TechnicalSliceSession): void {
  session.roll();
  session.presentationDone(session.getSnapshot().cue!.id);
  session.presentationDone(session.getSnapshot().cue!.id);
}

function playToHandoff(session: TechnicalSliceSession): void {
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
        return;
      default:
        throw new Error(`Unexpected flow while completing a turn: ${snapshot.flow}`);
    }
  }

  throw new Error('Multiplayer turn did not reach handoff within the guard limit.');
}

function assertStableRestore(
  savedGame: GameState,
  flow: 'awaitingHandoff' | 'awaitingLiquidation' | 'finished',
  playerCount: LocalPlayerCount
): void {
  const restored = new TechnicalSliceSession(
    new SeededRandom(20260818),
    savedGame,
    flow
  );
  const snapshot = restored.getSnapshot();

  expect(snapshot.flow).toBe(flow);
  expect(snapshot.cue).toBeNull();
  expect(snapshot.lastEvents).toEqual([]);
  expect(snapshot.game).toEqual(savedGame);
  expect(snapshot.game.players).toHaveLength(playerCount);

  restored.roll();
  expect(restored.getSnapshot().game).toEqual(savedGame);
}
