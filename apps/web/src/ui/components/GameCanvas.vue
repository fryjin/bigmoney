<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type Phaser from 'phaser';
import type { GameState } from '@bigmoney/game-core';
import { createTownGame } from '../../phaser/createGame';
import {
  offSceneLoadError,
  offSceneLoadProgress,
  offSceneReady,
  offSceneShutdown,
  onSceneLoadError,
  onSceneLoadProgress,
  onSceneReady,
  onSceneShutdown,
  syncSceneState,
  updateScenePresentationPreferences
} from '../../phaser/bridges/sceneBridge';
import {
  loadPresentationPreferences,
  type PresentationPreferences
} from '../../presentation/preferences';
import PresentationSettings from './PresentationSettings.vue';

const props = defineProps<{
  gameState: GameState;
}>();

const host = ref<HTMLElement | null>(null);
const sceneReady = ref(false);
const loadProgress = ref(0);
const failedAssets = ref<string[]>([]);
const settingsOpen = ref(false);
const preferences = ref<PresentationPreferences>(loadPresentationPreferences());
let game: Phaser.Game | null = null;

function handleSceneReady(): void {
  sceneReady.value = true;
  loadProgress.value = 1;
  void syncSceneState(props.gameState);
}

function handleSceneShutdown(): void {
  sceneReady.value = false;
}

function handleLoadProgress(progress: number): void {
  loadProgress.value = Math.max(loadProgress.value, progress);
}

function handleLoadError(assetKey: string): void {
  if (!failedAssets.value.includes(assetKey)) {
    failedAssets.value = [...failedAssets.value, assetKey];
  }
}

function updatePreferences(next: PresentationPreferences): void {
  preferences.value = { ...next };
  updateScenePresentationPreferences(next);
}

onMounted(() => {
  onSceneReady(handleSceneReady);
  onSceneShutdown(handleSceneShutdown);
  onSceneLoadProgress(handleLoadProgress);
  onSceneLoadError(handleLoadError);

  if (!host.value) return;
  game = createTownGame(host.value);
  void syncSceneState(props.gameState);
});

watch(
  () => props.gameState,
  (state) => {
    void syncSceneState(state);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  offSceneReady(handleSceneReady);
  offSceneShutdown(handleSceneShutdown);
  offSceneLoadProgress(handleLoadProgress);
  offSceneLoadError(handleLoadError);
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div class="game-canvas">
    <div
      ref="host"
      class="game-canvas-host"
      role="img"
      aria-label="Big Money 2.5D 小镇棋盘"
    ></div>

    <section v-if="!sceneReady" class="scene-loading" aria-live="polite">
      <div class="loading-mark">BM</div>
      <div class="loading-copy">
        <span>LOADING MINIATURE TOWN</span>
        <strong>正在装配微缩小镇</strong>
        <div class="loading-track">
          <i :style="{ width: `${Math.round(loadProgress * 100)}%` }"></i>
        </div>
        <small>{{ Math.round(loadProgress * 100) }}%</small>
      </div>
    </section>

    <button
      class="presentation-settings-trigger"
      type="button"
      :aria-expanded="settingsOpen"
      aria-label="打开显示与动效设置"
      @click="settingsOpen = !settingsOpen"
    >
      <span>显示</span>
      <b>{{ preferences.quality === 'economy' ? '省电' : preferences.quality === 'high' ? '高质量' : '标准' }}</b>
    </button>

    <PresentationSettings
      v-if="settingsOpen"
      :preferences="preferences"
      :failed-assets="failedAssets"
      @close="settingsOpen = false"
      @update="updatePreferences"
    />

    <div v-if="failedAssets.length" class="asset-warning" role="status">
      {{ failedAssets.length }}项视觉资源使用降级显示
    </div>

    <div class="phase-badge">PHASE 1.2 · PRESENTATION INTERFACE</div>
  </div>
</template>

<style scoped>
.game-canvas-host {
  position: absolute;
  inset: 0;
}

.scene-loading {
  position: absolute;
  z-index: 80;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.82), transparent 34%),
    rgba(220, 235, 230, 0.94);
  color: #22343a;
}

.loading-mark {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border: 1px solid rgba(34, 52, 58, 0.12);
  border-radius: 24px;
  background: rgba(252, 253, 249, 0.94);
  box-shadow: 0 20px 60px rgba(31, 55, 62, 0.16);
  color: #3e8b7c;
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -0.08em;
}

.loading-copy {
  display: grid;
  width: 260px;
  gap: 5px;
}

.loading-copy > span {
  color: #748488;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.loading-copy > strong {
  font-size: 20px;
  letter-spacing: -0.03em;
}

.loading-copy > small {
  color: #66777b;
  font-size: 11px;
  font-weight: 800;
  text-align: right;
}

.loading-track {
  height: 7px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(34, 52, 58, 0.1);
}

.loading-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4a9a7f, #71b9a0);
  transition: width 160ms ease-out;
}

.presentation-settings-trigger {
  position: absolute;
  z-index: 45;
  top: max(18px, env(safe-area-inset-top));
  right: max(22px, env(safe-area-inset-right));
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid rgba(34, 52, 58, 0.1);
  border-radius: 14px;
  background: rgba(252, 253, 249, 0.9);
  box-shadow: 0 12px 36px rgba(29, 48, 55, 0.13);
  cursor: pointer;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.presentation-settings-trigger span {
  color: #6b7b7f;
  font-size: 11px;
  font-weight: 800;
}

.presentation-settings-trigger b {
  color: #2f7569;
  font-size: 12px;
}

.asset-warning {
  position: absolute;
  z-index: 44;
  top: max(66px, calc(env(safe-area-inset-top) + 48px));
  right: max(22px, env(safe-area-inset-right));
  padding: 8px 11px;
  border: 1px solid rgba(173, 105, 45, 0.22);
  border-radius: 12px;
  background: rgba(248, 229, 200, 0.9);
  color: #8b572e;
  font-size: 11px;
  font-weight: 800;
}

.phase-badge {
  position: absolute;
  z-index: 18;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  color: rgba(34, 52, 58, 0.42);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  pointer-events: none;
}

:global(.build-badge) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .loading-track i {
    transition: none;
  }
}
</style>
