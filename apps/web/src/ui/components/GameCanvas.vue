<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type Phaser from 'phaser';
import type { GameState } from '@bigmoney/game-core';
import { createTownGame } from '../../phaser/createGame';
import { syncSceneState } from '../../phaser/bridges/sceneBridge';

const props = defineProps<{
  gameState: GameState;
}>();

const host = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;

onMounted(() => {
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
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div
    ref="host"
    class="game-canvas"
    role="img"
    aria-label="Big Money 2.5D 小镇棋盘"
  ></div>
</template>
