<script setup lang="ts">
import type { PlayerState } from '@bigmoney/game-core';

defineProps<{
  players: PlayerState[];
  activePlayerId: string;
  propertyCounts: Record<string, number>;
}>();

function formatMoney(value: number): string {
  return `${value * 10}万元`;
}
</script>

<template>
  <header class="players-bar" aria-label="玩家状态">
    <article
      v-for="player in players"
      :key="player.id"
      class="player-chip"
      :class="{ active: player.id === activePlayerId }"
      :style="{ '--player-color': player.color }"
    >
      <span class="player-avatar">{{ player.id }}</span>
      <span class="player-chip-copy">
        <strong>{{ player.name }}</strong>
        <small>{{ formatMoney(player.cash) }}</small>
      </span>
      <span class="player-mini-stat">
        {{ propertyCounts[player.id] ?? 0 }}地 · {{ player.stocks.length }}股
      </span>
    </article>
  </header>
</template>
