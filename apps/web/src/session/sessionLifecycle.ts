import type { GameState } from '@bigmoney/game-core';
import {
  LocalGameSession,
  type LocalGameContent,
  type LocalGameSessionSnapshot,
  type FlowPhase,
  type StableFlowPhase
} from '@bigmoney/game-flow';
import type { RandomProvider } from '@bigmoney/game-random';

export interface LocalGameSessionSeed {
  random: RandomProvider;
  content: LocalGameContent;
  game: GameState;
  flow: StableFlowPhase;
}

/** @deprecated Historical technical-slice compatibility alias. */
export type TechnicalSliceSessionSeed = LocalGameSessionSeed;

type SnapshotListener = (snapshot: LocalGameSessionSnapshot) => void;
type StorageFailureListener = (error: unknown) => void;

export interface LocalGameSessionLifecycle {
  start(seed: LocalGameSessionSeed): LocalGameSession;
  getSession(): LocalGameSession | null;
  getGeneration(): number;
  enqueueForActiveSession(
    operation: () => Promise<void>,
    onFailure?: StorageFailureListener
  ): void;
  retireAndDrain(clear: () => Promise<void>): Promise<void>;
  drain(): Promise<void>;
  dispose(): void;
}

/** @deprecated Historical technical-slice compatibility alias. */
export type TechnicalSliceSessionLifecycle = LocalGameSessionLifecycle;

export function createLocalGameSessionLifecycle(
  onSnapshot: SnapshotListener
): LocalGameSessionLifecycle {
  let session: LocalGameSession | null = null;
  let unsubscribe: (() => void) | null = null;
  let generation = 0;
  let saveQueue = Promise.resolve();

  function retire(): void {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
    session?.destroy();
    session = null;
  }

  return {
    start(seed) {
      retire();
      const nextSession = new LocalGameSession(
        seed.random,
        seed.content,
        seed.game,
        seed.flow
      );
      const activeGeneration = generation;
      session = nextSession;
      unsubscribe = nextSession.subscribe((snapshot) => {
        if (generation !== activeGeneration || session !== nextSession) return;
        onSnapshot(snapshot);
      });
      return nextSession;
    },
    getSession() {
      return session;
    },
    getGeneration() {
      return generation;
    },
    enqueueForActiveSession(operation, onFailure) {
      const activeGeneration = generation;
      const activeSession = session;
      if (!activeSession) return;

      saveQueue = saveQueue
        .then(async () => {
          if (
            generation !== activeGeneration ||
            session !== activeSession
          ) {
            return;
          }
          await operation();
        })
        .catch((error: unknown) => {
          if (
            generation === activeGeneration &&
            session === activeSession
          ) {
            onFailure?.(error);
          }
        });
    },
    async retireAndDrain(clear) {
      retire();
      await saveQueue;
      await clear();
    },
    drain() {
      return saveQueue;
    },
    dispose() {
      retire();
    }
  };
}

/** @deprecated Historical technical-slice compatibility alias. */
export const createTechnicalSliceSessionLifecycle = createLocalGameSessionLifecycle;

export function isPrivateInfoHidden(
  flow: FlowPhase | null,
  sessionEntryOpen: boolean
): boolean {
  return (
    sessionEntryOpen ||
    flow === 'presentingTurnEnd' ||
    flow === 'awaitingHandoff'
  );
}
