import type { GameState } from '@bigmoney/game-core';
import {
  TechnicalSliceSession,
  type FlowPhase,
  type StableFlowPhase,
  type TechnicalSliceSessionSnapshot
} from '@bigmoney/game-flow';
import type { RandomProvider } from '@bigmoney/game-random';

export interface TechnicalSliceSessionSeed {
  random: RandomProvider;
  game: GameState;
  flow: StableFlowPhase;
}

type SnapshotListener = (snapshot: TechnicalSliceSessionSnapshot) => void;
type StorageFailureListener = (error: unknown) => void;

export interface TechnicalSliceSessionLifecycle {
  start(seed: TechnicalSliceSessionSeed): TechnicalSliceSession;
  getSession(): TechnicalSliceSession | null;
  getGeneration(): number;
  enqueueForActiveSession(
    operation: () => Promise<void>,
    onFailure?: StorageFailureListener
  ): void;
  retireAndDrain(clear: () => Promise<void>): Promise<void>;
  drain(): Promise<void>;
  dispose(): void;
}

export function createTechnicalSliceSessionLifecycle(
  onSnapshot: SnapshotListener
): TechnicalSliceSessionLifecycle {
  let session: TechnicalSliceSession | null = null;
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
      const nextSession = new TechnicalSliceSession(
        seed.random,
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
