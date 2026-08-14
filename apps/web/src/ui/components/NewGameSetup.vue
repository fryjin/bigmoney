<script setup lang="ts">
import type { LocalPlayerCount } from '@bigmoney/game-core';

const props = defineProps<{
  selectedPlayerCount: LocalPlayerCount;
  overwritesExistingSave: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  selectPlayerCount: [playerCount: LocalPlayerCount];
  start: [];
}>();

const playerCounts: readonly LocalPlayerCount[] = [2, 3, 4];
</script>

<template>
  <section class="session-entry-backdrop" aria-modal="true" role="dialog">
    <article class="session-entry-card new-game-setup">
      <span class="eyebrow">New Game</span>
      <h1>开始新游戏</h1>
      <p>选择玩家人数。所有玩家将在同一设备上轮流操作。</p>

      <div class="new-game-counts" aria-label="选择玩家人数">
        <button
          v-for="playerCount in playerCounts"
          :key="playerCount"
          class="new-game-count"
          :class="{ selected: props.selectedPlayerCount === playerCount }"
          type="button"
          :aria-pressed="props.selectedPlayerCount === playerCount"
          :disabled="props.busy"
          @click="emit('selectPlayerCount', playerCount)"
        >
          <strong>{{ playerCount }} 人</strong>
          <small>{{ playerCount === 2 ? '双人对局' : `${playerCount} 人本地对局` }}</small>
        </button>
      </div>

      <p v-if="props.overwritesExistingSave" class="new-game-overwrite-warning">
        开始新游戏将覆盖当前存档
      </p>

      <div class="session-entry-actions new-game-actions">
        <button
          class="primary-action"
          type="button"
          :disabled="props.busy"
          @click="emit('start')"
        >
          {{ props.overwritesExistingSave ? '覆盖存档并开始' : '开始游戏' }}
        </button>
      </div>
    </article>
  </section>
</template>
