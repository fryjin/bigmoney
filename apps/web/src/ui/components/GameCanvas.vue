<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type Phaser from 'phaser';
import { createTownGame } from '../../phaser/createGame';

const host = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;

onMounted(() => {
  if (host.value) game = createTownGame(host.value);
});

onBeforeUnmount(() => {
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div ref="host" class="game-canvas" aria-label="2.5D小镇棋盘"></div>
</template>
