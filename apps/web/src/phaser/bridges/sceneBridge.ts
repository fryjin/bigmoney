import Phaser from 'phaser';
import type { GameState } from '@bigmoney/game-core';
import type { PresentationCue } from '@bigmoney/game-flow';

const emitter = new Phaser.Events.EventEmitter();
let ready = false;

export const SceneBridgeEvents = {
  ready: 'scene:ready',
  shutdown: 'scene:shutdown',
  present: 'scene:present',
  presented: 'scene:presented',
  sync: 'scene:sync'
} as const;

export function notifySceneReady(): void {
  ready = true;
  emitter.emit(SceneBridgeEvents.ready);
}

export function notifySceneShutdown(): void {
  ready = false;
  emitter.emit(SceneBridgeEvents.shutdown);
}

export function onScenePresentation(
  handler: (cue: PresentationCue) => void,
  context?: unknown
): void {
  emitter.on(SceneBridgeEvents.present, handler, context);
}

export function offScenePresentation(
  handler: (cue: PresentationCue) => void,
  context?: unknown
): void {
  emitter.off(SceneBridgeEvents.present, handler, context);
}

export function onSceneSync(
  handler: (state: GameState) => void,
  context?: unknown
): void {
  emitter.on(SceneBridgeEvents.sync, handler, context);
}

export function offSceneSync(
  handler: (state: GameState) => void,
  context?: unknown
): void {
  emitter.off(SceneBridgeEvents.sync, handler, context);
}

export function completeScenePresentation(cueId: number): void {
  emitter.emit(SceneBridgeEvents.presented, cueId);
}

export async function presentSceneCue(cue: PresentationCue): Promise<void> {
  await waitForSceneReady();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      emitter.off(SceneBridgeEvents.presented, onPresented);
      resolve();
    }, 2400);

    const onPresented = (presentedCueId: number): void => {
      if (presentedCueId !== cue.id) return;
      window.clearTimeout(timeout);
      emitter.off(SceneBridgeEvents.presented, onPresented);
      resolve();
    };

    emitter.on(SceneBridgeEvents.presented, onPresented);
    emitter.emit(SceneBridgeEvents.present, cue);
  });
}

export async function syncSceneState(state: GameState): Promise<void> {
  await waitForSceneReady();
  emitter.emit(SceneBridgeEvents.sync, structuredClone(state));
}

function waitForSceneReady(): Promise<void> {
  if (ready) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      emitter.off(SceneBridgeEvents.ready, onReady);
      resolve();
    }, 1800);

    const onReady = (): void => {
      window.clearTimeout(timeout);
      emitter.off(SceneBridgeEvents.ready, onReady);
      resolve();
    };

    emitter.once(SceneBridgeEvents.ready, onReady);
  });
}
