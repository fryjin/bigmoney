<script setup lang="ts">
defineProps<{
  canRoll: boolean;
  canEndTurn: boolean;
  busy: boolean;
  cardCount: number;
  stockCount: number;
  nextPlayerName: string;
}>();

const emit = defineEmits<{
  roll: [];
  endTurn: [];
  toggleCards: [];
  toggleAssets: [];
}>();
</script>

<template>
  <footer class="control-dock" aria-label="回合操作">
    <button
      class="dock-button secondary"
      type="button"
      :disabled="busy"
      @click="emit('toggleCards')"
    >
      <span class="dock-icon">▤</span>
      <span>手牌</span>
      <b>{{ cardCount }}</b>
    </button>

    <button
      class="dice-button"
      type="button"
      :disabled="!canRoll || busy"
      @click="emit('roll')"
    >
      <span class="dice-symbol">⚄</span>
      <span>投骰</span>
    </button>

    <button
      class="dock-button secondary"
      type="button"
      :disabled="busy"
      @click="emit('toggleAssets')"
    >
      <span class="dock-icon">⌂</span>
      <span>资产</span>
      <b>{{ stockCount }}</b>
    </button>

    <button
      v-if="canEndTurn"
      class="dock-button end-turn end-turn-attention"
      type="button"
      :disabled="busy"
      @click="emit('endTurn')"
    >
      <small>结束回合</small>
      <strong>交给{{ nextPlayerName }}</strong>
    </button>
  </footer>
</template>
