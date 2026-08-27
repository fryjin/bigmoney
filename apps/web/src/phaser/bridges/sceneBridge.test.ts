import { describe, expect, it, afterEach } from 'vitest';
import { createLocalGameState } from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import {
  notifySceneReady,
  notifyScenePresentationReady,
  offScenePresentationReady,
  offSceneSync,
  onScenePresentationReady,
  onSceneSync,
  resetSceneBridge,
  syncSceneState
} from './sceneBridge';

describe('scene bridge sync lifecycle', () => {
  afterEach(() => {
    resetSceneBridge();
  });

  it('replays the latest canonical snapshot to a scene that subscribes after initial dispatch', async () => {
    const state = createLocalGameState(fullMap36Content, 2);
    let received: typeof state | null = null;
    const handleSync = (next: typeof state): void => {
      received = next;
    };

    notifySceneReady();
    await syncSceneState(state);
    onSceneSync(handleSync);

    expect(received).toEqual(state);
    expect(received).not.toBe(state);

    offSceneSync(handleSync);
  });

  it('preserves the subscriber context when replaying the latest snapshot', async () => {
    const state = createLocalGameState(fullMap36Content, 2);
    const subscriber = {
      received: null as typeof state | null,
      handleSync(next: typeof state): void {
        this.received = next;
      }
    };

    notifySceneReady();
    await syncSceneState(state);
    onSceneSync(subscriber.handleSync, subscriber);

    expect(subscriber.received).toEqual(state);
    offSceneSync(subscriber.handleSync, subscriber);
  });

  it('replays presentation readiness only after the scene reports an initial layout', () => {
    let readySignals = 0;
    const handlePresentationReady = (): void => {
      readySignals += 1;
    };

    notifySceneReady();
    onScenePresentationReady(handlePresentationReady);
    expect(readySignals).toBe(0);

    notifyScenePresentationReady();
    expect(readySignals).toBe(1);

    offScenePresentationReady(handlePresentationReady);
  });
});
