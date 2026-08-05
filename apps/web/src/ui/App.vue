<script setup lang="ts">
import { computed, ref } from 'vue';
import { createTechnicalSliceState, handleCommand, type DomainEvent, type GameState } from '@town-board/game-core';
import { SeededRandom } from '@town-board/game-random';
import { appendEvent, saveSnapshot } from '@town-board/game-storage';
import GameCanvas from './components/GameCanvas.vue';
import { gameEvents, SceneEvents } from '../phaser/bridges/gameEvents';

const state = ref<GameState>(createTechnicalSliceState());
const random = new SeededRandom(20260805);
const message = ref('技术架构切片：当前仅验证分层与运行骨架');
const busy = ref(false);

const activePlayer = computed(() => state.value.players[state.value.activePlayerIndex]!);
const pendingDecision = computed(() => state.value.pendingPropertyDecision);

async function applyCommand(command: Parameters<typeof handleCommand>[1]): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = handleCommand(state.value, command, random);
    state.value = result.nextState;
    await persistEvents(result.events);
    await playEvents(result.events);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '操作失败';
  } finally {
    busy.value = false;
  }
}

async function persistEvents(events: DomainEvent[]): Promise<void> {
  for (const event of events) await appendEvent('technical-slice', event);
  await saveSnapshot('technical-slice', state.value);
}

async function playEvents(events: DomainEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type === 'DICE_ROLLED') message.value = `掷出 ${event.value} 点`;
    if (event.type === 'PLAYER_MOVED') {
      gameEvents.emit(SceneEvents.pawnMove, event.to);
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    }
    if (event.type === 'LAP_REWARD_GRANTED') message.value = '经过终点，获得800万元';
    if (event.type === 'PROPERTY_DECISION_REQUESTED') message.value = '发现无主地产，请完成决策';
    if (event.type === 'PROPERTY_PURCHASED') message.value = '地产购买成功';
    if (event.type === 'PROPERTY_SKIPPED') message.value = '已放弃购买';
    if (event.type === 'TURN_ENDED') message.value = `轮到 ${event.nextPlayerId}`;
  }
}

function roll(): void {
  void applyCommand({ type: 'ROLL_DICE', playerId: activePlayer.value.id });
}

function buy(): void {
  void applyCommand({ type: 'BUY_PROPERTY', playerId: activePlayer.value.id });
}

function skip(): void {
  void applyCommand({ type: 'SKIP_PROPERTY', playerId: activePlayer.value.id });
}

function endTurn(): void {
  void applyCommand({ type: 'END_TURN', playerId: activePlayer.value.id });
}
</script>

<template>
  <main class="app-shell">
    <GameCanvas />

    <header class="players-bar">
      <article
        v-for="player in state.players"
        :key="player.id"
        class="player-chip"
        :class="{ active: player.id === activePlayer.id }"
      >
        <span class="avatar">{{ player.id }}</span>
        <span><strong>{{ player.name }}</strong><small>{{ player.cash * 10 }}万元</small></span>
      </article>
    </header>

    <aside class="current-player-card">
      <span class="eyebrow">当前玩家</span>
      <strong>{{ activePlayer.name }}</strong>
      <span>余额 {{ activePlayer.cash * 10 }}万元</span>
      <span>第 {{ state.round }} 大轮</span>
    </aside>

    <section class="status-pill">{{ message }}</section>

    <footer class="control-dock">
      <button class="secondary">手牌</button>
      <button class="primary" :disabled="busy || state.phase !== 'AWAITING_ROLL'" @click="roll">投骰</button>
      <button class="secondary">资产</button>
      <button v-if="state.phase === 'TURN_END'" class="secondary" @click="endTurn">结束回合</button>
    </footer>

    <section v-if="pendingDecision" class="modal-backdrop">
      <article class="decision-modal">
        <span class="eyebrow">地产决策</span>
        <h2>{{ pendingDecision.propertyId }}</h2>
        <p>买入价 {{ pendingDecision.price * 10 }}万元</p>
        <p>购买后余额 {{ (activePlayer.cash - pendingDecision.price) * 10 }}万元</p>
        <div class="modal-actions">
          <button class="secondary" @click="skip">暂不购买</button>
          <button class="primary" :disabled="activePlayer.cash < pendingDecision.price" @click="buy">确认购买</button>
        </div>
      </article>
    </section>
  </main>
</template>
