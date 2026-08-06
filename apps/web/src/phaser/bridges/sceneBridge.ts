import type { GameState } from '@bigmoney/game-core';
import type { PresentationCue } from '@bigmoney/game-flow';
import {
  getPresentationProfile,
  loadPresentationPreferences,
  normalizePresentationPreferences,
  savePresentationPreferences,
  type PresentationPreferences
} from '../../presentation/preferences';

type EventHandler = (...args: any[]) => void;

interface EventListener {
  handler: EventHandler;
  context?: unknown;
  once: boolean;
}

class SceneEventBus {
  private readonly listeners = new Map<string, EventListener[]>();

  on(event: string, handler: EventHandler, context?: unknown): void {
    const current = this.listeners.get(event) ?? [];
    current.push({ handler, context, once: false });
    this.listeners.set(event, current);
  }

  once(event: string, handler: EventHandler, context?: unknown): void {
    const current = this.listeners.get(event) ?? [];
    current.push({ handler, context, once: true });
    this.listeners.set(event, current);
  }

  off(event: string, handler: EventHandler, context?: unknown): void {
    const current = this.listeners.get(event);
    if (!current) return;

    const next = current.filter(
      (listener) => listener.handler !== handler || listener.context !== context
    );

    if (next.length > 0) this.listeners.set(event, next);
    else this.listeners.delete(event);
  }

  emit(event: string, ...args: any[]): void {
    const current = [...(this.listeners.get(event) ?? [])];

    for (const listener of current) {
      listener.handler.apply(listener.context, args);
      if (listener.once) this.off(event, listener.handler, listener.context);
    }
  }
}

const emitter = new SceneEventBus();
let ready = false;
let preferences = loadPresentationPreferences();

export const SceneBridgeEvents = {
  ready: 'scene:ready',
  shutdown: 'scene:shutdown',
  loadProgress: 'scene:load-progress',
  loadError: 'scene:load-error',
  preferences: 'scene:preferences',
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

export function notifySceneLoadProgress(progress: number): void {
  emitter.emit(SceneBridgeEvents.loadProgress, Math.min(1, Math.max(0, progress)));
}

export function notifySceneLoadError(assetKey: string): void {
  emitter.emit(SceneBridgeEvents.loadError, assetKey);
}

export function onSceneReady(handler: () => void, context?: unknown): void {
  emitter.on(SceneBridgeEvents.ready, handler, context);
}

export function offSceneReady(handler: () => void, context?: unknown): void {
  emitter.off(SceneBridgeEvents.ready, handler, context);
}

export function onSceneShutdown(handler: () => void, context?: unknown): void {
  emitter.on(SceneBridgeEvents.shutdown, handler, context);
}

export function offSceneShutdown(handler: () => void, context?: unknown): void {
  emitter.off(SceneBridgeEvents.shutdown, handler, context);
}

export function onSceneLoadProgress(
  handler: (progress: number) => void,
  context?: unknown
): void {
  emitter.on(SceneBridgeEvents.loadProgress, handler, context);
}

export function offSceneLoadProgress(
  handler: (progress: number) => void,
  context?: unknown
): void {
  emitter.off(SceneBridgeEvents.loadProgress, handler, context);
}

export function onSceneLoadError(
  handler: (assetKey: string) => void,
  context?: unknown
): void {
  emitter.on(SceneBridgeEvents.loadError, handler, context);
}

export function offSceneLoadError(
  handler: (assetKey: string) => void,
  context?: unknown
): void {
  emitter.off(SceneBridgeEvents.loadError, handler, context);
}

export function getScenePresentationPreferences(): PresentationPreferences {
  return { ...preferences };
}

export function updateScenePresentationPreferences(
  next: PresentationPreferences
): void {
  preferences = normalizePresentationPreferences(next);
  savePresentationPreferences(preferences);
  emitter.emit(SceneBridgeEvents.preferences, { ...preferences });
}

export function onScenePreferences(
  handler: (next: PresentationPreferences) => void,
  context?: unknown
): void {
  emitter.on(SceneBridgeEvents.preferences, handler, context);
}

export function offScenePreferences(
  handler: (next: PresentationPreferences) => void,
  context?: unknown
): void {
  emitter.off(SceneBridgeEvents.preferences, handler, context);
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
    const profile = getPresentationProfile(preferences);
    const timeoutDuration = Math.max(900, Math.round(3600 * profile.durationScale));
    const timeout = window.setTimeout(() => {
      emitter.off(SceneBridgeEvents.presented, onPresented);
      resolve();
    }, timeoutDuration);

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
