<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch
} from 'vue';
import { animate } from 'animejs';
import { technicalSliceContent } from '@bigmoney/game-content';
import {
  createTechnicalSliceState,
  type DomainEvent,
  type GameState
} from '@bigmoney/game-core';
import {
  TechnicalSliceSession,
  type PresentationCue,
  type TechnicalSliceSessionSnapshot
} from '@bigmoney/game-flow';
import { SeededRandom } from '@bigmoney/game-random';
import GameCanvas from './components/GameCanvas.vue';
import PlayerBar from './components/PlayerBar.vue';
import ControlDock from './components/ControlDock.vue';
import ContextPanel from './components/ContextPanel.vue';
import { presentSceneCue } from '../phaser/bridges/sceneBridge';
import {
  clearTechnicalSliceSave,
  logDomainEvents,
  saveTechnicalSliceSave,
  type TechnicalSliceSave
} from '../session/persistence';

const props = defineProps<{
  initialSave: TechnicalSliceSave | null;
}>();

const random = props.initialSave
  ? SeededRandom.fromSnapshot(props.initialSave.random)
  : new SeededRandom(20260805);

const session = new TechnicalSliceSession(
  random,
  props.initialSave?.game ?? createTechnicalSliceState()
);

const snapshot = shallowRef<TechnicalSliceSessionSnapshot>(session.getSnapshot());
const cardsOpen = ref(false);
const assetsOpen = ref(false);
const selectedStockId = ref('');
const selectedPrincipal = ref(50);
const selectedPeriod = ref<2 | 4 | 6>(2);
let handledCueId = 0;
let lastLoggedDomainRevision = -1;
let lastSavedRoundKey = '';

const game = computed<GameState>(() => snapshot.value.game);
const activePlayer = computed(
  () => game.value.players[game.value.activePlayerIndex]!
);
const pending = computed(() => game.value.pendingInteraction);
const busy = computed(() => snapshot.value.cue !== null);
const canRoll = computed(() => snapshot.value.flow === 'turnReady');
const canEndTurn = computed(() => snapshot.value.flow === 'turnEnd');

const propertyCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const property of Object.values(game.value.properties)) {
    if (!property.ownerId) continue;
    counts[property.ownerId] = (counts[property.ownerId] ?? 0) + 1;
  }
  return counts;
});

const currentPropertyDefinition = computed(() => {
  const interaction = pending.value;
  if (!interaction) return null;
  if (
    interaction.type !== 'PROPERTY_PURCHASE' &&
    interaction.type !== 'PROPERTY_UPGRADE'
  ) return null;
  return technicalSliceContent.properties.find(
    (property) => property.id === interaction.propertyId
  ) ?? null;
});

const statusMessage = computed(() => {
  const interaction = pending.value;
  if (interaction?.type === 'STOCK_MARKET') return '经过金融中心：购买一只股票，或跳过后继续移动';
  if (interaction?.type === 'PROPERTY_PURCHASE') return '无主地产：请决定是否购买';
  if (interaction?.type === 'PROPERTY_UPGRADE') return '你的地产：本次落地可升级一级';
  if (interaction?.type === 'EVENT_RESULT') return interaction.title;
  if (interaction?.type === 'CARD_DRAW') return `获得卡牌：${interaction.title}`;
  if (interaction?.type === 'CARD_REPLACEMENT') return '手牌已满：四选三，弃置一张';

  const last = snapshot.value.lastEvents.at(-1);
  if (last?.type === 'DICE_ROLLED') return `${activePlayer.value.name} 掷出 ${last.value} 点`;
  if (last?.type === 'LAP_REWARD_GRANTED') return '完成一圈，银行奖励800万元';
  if (last?.type === 'PROPERTY_PURCHASED') return '地产购买成功，所有权标记已更新';
  if (last?.type === 'PROPERTY_UPGRADED') return `地产升级至 L${last.level}`;
  if (last?.type === 'RENT_PAID') return `支付租金 ${last.amount * 10}万元`;
  if (last?.type === 'TURN_ENDED') return `轮到 ${last.nextPlayerId}`;
  if (snapshot.value.flow === 'turnEnd') return '本回合结算完成';
  return '点击投骰，开始本回合';
});

const currentTileName = computed(() => {
  const tile = technicalSliceContent.tiles[activePlayer.value.position];
  return tile?.name ?? '未知地格';
});

const unsubscribe = session.subscribe((next) => {
  snapshot.value = next;

  if (next.domainRevision !== lastLoggedDomainRevision) {
    lastLoggedDomainRevision = next.domainRevision;
    if (next.lastEvents.length > 0) void logDomainEvents(next.lastEvents);
  }

  if (next.flow === 'turnReady') {
    const saveKey = `${next.game.round}:${next.game.activePlayerIndex}:${next.domainRevision}`;
    if (saveKey !== lastSavedRoundKey) {
      lastSavedRoundKey = saveKey;
      void saveTechnicalSliceSave(next.game, random.getSnapshot());
    }
  }

  if (next.cue && next.cue.id !== handledCueId) {
    handledCueId = next.cue.id;
    void runPresentation(next.cue);
  }
});

watch(
  pending,
  (interaction) => {
    if (interaction?.type !== 'STOCK_MARKET') return;
    selectedStockId.value = interaction.offeredStockIds[0] ?? '';
    selectedPrincipal.value = technicalSliceContent.stockMarket.investmentTiers[0] ?? 50;
    selectedPeriod.value = technicalSliceContent.stockMarket.periods[0] ?? 2;
  },
  { immediate: true }
);

watch(statusMessage, () => {
  window.requestAnimationFrame(() => {
    animate('.status-pill', {
      opacity: [0.45, 1],
      y: [6, 0],
      duration: 280,
      ease: 'outQuad'
    });
  });
});

onBeforeUnmount(() => {
  unsubscribe();
  session.destroy();
});

async function runPresentation(cue: PresentationCue): Promise<void> {
  await presentSceneCue(cue);
  session.presentationDone(cue.id);
}

function roll(): void {
  session.roll();
}

function endTurn(): void {
  session.endTurn();
}

function buyProperty(): void {
  session.buyProperty();
}

function skipProperty(): void {
  session.skipProperty();
}

function upgradeProperty(): void {
  session.upgradeProperty();
}

function skipUpgrade(): void {
  session.skipUpgrade();
}

function skipStock(): void {
  session.resolveStockMarket(null);
}

function buyStock(): void {
  if (!selectedStockId.value) return;
  session.resolveStockMarket({
    stockId: selectedStockId.value,
    principal: selectedPrincipal.value,
    period: selectedPeriod.value
  });
}

function acknowledgeResult(): void {
  session.acknowledgeResult();
}

function discardCard(cardInstanceId: string): void {
  session.chooseCardToDiscard(cardInstanceId);
}

function stockName(stockId: string): string {
  return technicalSliceContent.stocks.find((stock) => stock.id === stockId)?.name ?? stockId;
}

function cardName(cardInstanceId: string): string {
  const interaction = pending.value;
  if (interaction?.type !== 'CARD_REPLACEMENT') return cardInstanceId;
  const instance = interaction.candidateCards.find((card) => card.instanceId === cardInstanceId);
  return technicalSliceContent.cards.find((card) => card.id === instance?.cardId)?.name ?? cardInstanceId;
}

function eventAmount(event: DomainEvent): string | null {
  if (event.type !== 'EVENT_RESOLVED') return null;
  const change = event.changes.find((item) => item.playerId === activePlayer.value.id);
  if (!change) return null;
  return `${change.amount > 0 ? '+' : ''}${change.amount * 10}万元`;
}

async function resetTechnicalSlice(): Promise<void> {
  await clearTechnicalSliceSave();
  window.location.reload();
}
</script>

<template>
  <main class="app-shell">
    <GameCanvas :game-state="game" />

    <PlayerBar
      :players="game.players"
      :active-player-id="activePlayer.id"
      :property-counts="propertyCounts"
    />

    <aside class="current-player-card" :style="{ '--player-color': activePlayer.color }">
      <div class="current-player-heading">
        <span class="current-player-avatar">{{ activePlayer.id }}</span>
        <div>
          <span class="eyebrow">当前玩家</span>
          <strong>{{ activePlayer.name }}</strong>
        </div>
      </div>
      <dl>
        <div><dt>余额</dt><dd>{{ activePlayer.cash * 10 }}万元</dd></div>
        <div><dt>位置</dt><dd>{{ currentTileName }}</dd></div>
        <div><dt>进度</dt><dd>第 {{ game.round }} 大轮</dd></div>
      </dl>
      <button class="text-button" type="button" @click="resetTechnicalSlice">重置技术切片</button>
    </aside>

    <section class="status-pill" aria-live="polite">
      <span class="status-dot"></span>
      {{ statusMessage }}
    </section>

    <ControlDock
      :can-roll="canRoll"
      :can-end-turn="canEndTurn"
      :busy="busy"
      :card-count="activePlayer.cards.length"
      :stock-count="activePlayer.stocks.length"
      @roll="roll"
      @end-turn="endTurn"
      @toggle-cards="cardsOpen = !cardsOpen; assetsOpen = false"
      @toggle-assets="assetsOpen = !assetsOpen; cardsOpen = false"
    />

    <ContextPanel
      v-if="cardsOpen"
      title="我的手牌"
      eyebrow="Cards"
      @close="cardsOpen = false"
    >
      <div v-if="activePlayer.cards.length" class="collection-grid">
        <article v-for="card in activePlayer.cards" :key="card.instanceId" class="collection-card">
          <span class="card-rarity">CARD</span>
          <strong>{{ technicalSliceContent.cards.find((item) => item.id === card.cardId)?.name }}</strong>
          <small>{{ technicalSliceContent.cards.find((item) => item.id === card.cardId)?.description }}</small>
        </article>
      </div>
      <p v-else class="empty-state">尚未获得卡牌。</p>
    </ContextPanel>

    <ContextPanel
      v-if="assetsOpen"
      title="资产概览"
      eyebrow="Assets"
      @close="assetsOpen = false"
    >
      <div class="asset-summary">
        <h3>地产</h3>
        <article
          v-for="property in Object.values(game.properties).filter((item) => item.ownerId === activePlayer.id)"
          :key="property.id"
          class="asset-row"
        >
          <span>{{ technicalSliceContent.properties.find((item) => item.id === property.id)?.name }}</span>
          <b>L{{ property.level }}</b>
        </article>
        <p v-if="!Object.values(game.properties).some((item) => item.ownerId === activePlayer.id)" class="empty-state">
          暂无地产。
        </p>

        <h3>股票</h3>
        <article v-for="holding in activePlayer.stocks" :key="holding.holdingId" class="asset-row">
          <span>{{ stockName(holding.stockId) }}</span>
          <b>{{ holding.principal * 10 }}万 · {{ holding.remainingRounds }}轮</b>
        </article>
        <p v-if="!activePlayer.stocks.length" class="empty-state">暂无持仓。</p>
      </div>
    </ContextPanel>

    <section
      v-if="pending"
      class="modal-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <article v-if="pending.type === 'STOCK_MARKET'" class="decision-modal stock-modal">
        <span class="eyebrow">路径触发 · Stock Market</span>
        <h2>Big Money 交易所</h2>
        <p class="modal-lead">本次市场展示3只股票。可购买1只，也可以跳过并继续剩余移动。</p>

        <div class="option-label">选择股票</div>
        <div class="stock-options">
          <button
            v-for="stockId in pending.offeredStockIds"
            :key="stockId"
            class="choice-card"
            :class="{ selected: selectedStockId === stockId }"
            type="button"
            @click="selectedStockId = stockId"
          >
            <strong>{{ stockName(stockId) }}</strong>
            <small>{{ technicalSliceContent.stocks.find((item) => item.id === stockId)?.sector }}</small>
          </button>
        </div>

        <div class="option-label">投资金额</div>
        <div class="segmented">
          <button
            v-for="tier in technicalSliceContent.stockMarket.investmentTiers"
            :key="tier"
            :class="{ selected: selectedPrincipal === tier }"
            type="button"
            @click="selectedPrincipal = tier"
          >
            {{ tier * 10 }}万
          </button>
        </div>

        <div class="option-label">持有周期</div>
        <div class="segmented">
          <button
            v-for="period in technicalSliceContent.stockMarket.periods"
            :key="period"
            :class="{ selected: selectedPeriod === period }"
            type="button"
            @click="selectedPeriod = period"
          >
            {{ period }}大轮
          </button>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="skipStock">跳过</button>
          <button
            class="primary-action"
            type="button"
            :disabled="activePlayer.cash < selectedPrincipal"
            @click="buyStock"
          >
            投资 {{ selectedPrincipal * 10 }}万元
          </button>
        </div>
      </article>

      <article v-else-if="pending.type === 'PROPERTY_PURCHASE'" class="decision-modal property-modal">
        <span class="eyebrow">最终落点 · Property</span>
        <div class="property-hero">
          <div class="property-miniature">🏙️</div>
          <div>
            <h2>{{ currentPropertyDefinition?.name }}</h2>
            <p>无主地产 · 当前等级 L0</p>
          </div>
        </div>
        <div class="property-numbers">
          <div><span>买入价</span><strong>{{ pending.price * 10 }}万元</strong></div>
          <div><span>基础租金</span><strong>{{ Math.round(pending.price * 0.1) * 10 }}万元</strong></div>
          <div><span>购买后余额</span><strong>{{ (activePlayer.cash - pending.price) * 10 }}万元</strong></div>
        </div>
        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="skipProperty">暂不购买</button>
          <button
            class="primary-action"
            type="button"
            :disabled="activePlayer.cash < pending.price"
            @click="buyProperty"
          >
            确认购买
          </button>
        </div>
      </article>

      <article v-else-if="pending.type === 'PROPERTY_UPGRADE'" class="decision-modal property-modal">
        <span class="eyebrow">自己的地产 · Upgrade</span>
        <div class="property-hero">
          <div class="property-miniature">🏗️</div>
          <div>
            <h2>{{ currentPropertyDefinition?.name }}</h2>
            <p>L{{ pending.currentLevel }} → L{{ pending.nextLevel }}</p>
          </div>
        </div>
        <div class="property-numbers">
          <div><span>升级费用</span><strong>{{ pending.cost * 10 }}万元</strong></div>
          <div><span>升级后余额</span><strong>{{ (activePlayer.cash - pending.cost) * 10 }}万元</strong></div>
        </div>
        <div class="modal-actions">
          <button class="secondary-action" type="button" @click="skipUpgrade">保持现状</button>
          <button
            class="primary-action"
            type="button"
            :disabled="activePlayer.cash < pending.cost"
            @click="upgradeProperty"
          >
            升级一级
          </button>
        </div>
      </article>

      <article v-else-if="pending.type === 'EVENT_RESULT'" class="decision-modal result-modal">
        <span class="eyebrow">城市事件</span>
        <div class="result-icon">✦</div>
        <h2>{{ pending.title }}</h2>
        <p>{{ pending.description }}</p>
        <strong class="result-amount">
          {{ snapshot.lastEvents.map(eventAmount).find(Boolean) }}
        </strong>
        <button class="primary-action full" type="button" @click="acknowledgeResult">知道了</button>
      </article>

      <article v-else-if="pending.type === 'CARD_DRAW'" class="decision-modal result-modal">
        <span class="eyebrow">幸运卡片</span>
        <div class="result-icon card">▤</div>
        <h2>{{ pending.title }}</h2>
        <p>{{ pending.description }}</p>
        <button class="primary-action full" type="button" @click="acknowledgeResult">收入手牌</button>
      </article>

      <article v-else-if="pending.type === 'CARD_REPLACEMENT'" class="decision-modal replacement-modal">
        <span class="eyebrow">手牌上限 · 3张</span>
        <h2>选择一张弃置</h2>
        <p class="modal-lead">本技术切片采用当前临时配置：抽牌后四选三。</p>
        <div class="replacement-grid">
          <button
            v-for="card in pending.candidateCards"
            :key="card.instanceId"
            type="button"
            class="replacement-card"
            @click="discardCard(card.instanceId)"
          >
            <strong>{{ cardName(card.instanceId) }}</strong>
            <small>{{ card.instanceId === pending.drawnCardInstanceId ? '本次新抽取' : '原有手牌' }}</small>
            <span>弃置此牌</span>
          </button>
        </div>
      </article>
    </section>

    <div v-if="snapshot.error" class="error-toast" role="alert">
      {{ snapshot.error }}
      <button type="button" @click="session.clearError()">×</button>
    </div>

    <div class="build-badge">PHASE 1.1 · 8 NODE TECHNICAL SLICE</div>
  </main>
</template>
