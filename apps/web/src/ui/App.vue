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
  getLiquidationCandidates,
  getNextActivePlayerIndex,
  quoteLiquidation,
  type DomainEvent,
  type GameState,
  type LocalPlayerCount,
  type PlayerId
} from '@bigmoney/game-core';
import {
  type PresentationCue,
  type TechnicalSliceSession,
  type TechnicalSliceSessionSnapshot,
  type StableFlowPhase
} from '@bigmoney/game-flow';
import { SeededRandom } from '@bigmoney/game-random';
import GameCanvas from './components/GameCanvas.vue';
import PlayerBar from './components/PlayerBar.vue';
import ControlDock from './components/ControlDock.vue';
import ContextPanel from './components/ContextPanel.vue';
import LiquidationModal from './components/LiquidationModal.vue';
import NewGameSetup from './components/NewGameSetup.vue';
import {
  getScenePresentationPreferences,
  presentSceneCue
} from '../phaser/bridges/sceneBridge';
import {
  clearTechnicalSliceSave,
  logDomainEvents,
  saveTechnicalSliceSave,
  type TechnicalSliceLoadResult
} from '../session/persistence';
import {
  createTechnicalSliceSessionLifecycle,
  isPrivateInfoHidden
} from '../session/sessionLifecycle';
import type { BrowserTestFixture } from '../session/browserTestFixtures';
import { renderBrowserTestGameText } from '../session/browserTestProjection';

const props = defineProps<{
  initialLoad: TechnicalSliceLoadResult;
  browserTestFixture: BrowserTestFixture | null;
}>();

const initialSave = props.initialLoad.save;
const initialSession = initialSave ?? props.browserTestFixture;
const snapshot = shallowRef<TechnicalSliceSessionSnapshot | null>(null);
const cardsOpen = ref(false);
const assetsOpen = ref(false);
const selectedStockId = ref('');
const selectedPrincipal = ref(50);
const selectedPeriod = ref<2 | 4 | 6>(2);
const selectedLiquidationPropertyIds = ref<string[]>([]);
const liquidationSubmitting = ref(false);
const actionLocked = ref(false);
const sessionAccepted = ref(false);
const resumePromptOpen = ref(props.initialLoad.status === 'ready');
const newGameSetupOpen = ref(initialSession === null);
const newGameWillOverwrite = ref(initialSession !== null);
const selectedPlayerCount = ref<LocalPlayerCount>(2);
const recoveryNotice = ref(
  props.initialLoad.status === 'recovered' ? props.initialLoad.message : null
);
const storageError = ref('');
const presentationError = ref('');
const presentationReadyCueId = ref<number | null>(null);
const handoffActivationPending = ref(false);
const restoredHandoffFromPlayerId = ref<PlayerId | null>(
  initialSave?.handoffFromPlayerId ?? null
);
let handledCueId = 0;
let lastLoggedDomainRevision = -1;
let lastSavedRoundKey = '';
let random: SeededRandom | null = null;

const lifecycle = createTechnicalSliceSessionLifecycle(handleSessionSnapshot);

const game = computed<GameState | null>(() => snapshot.value?.game ?? null);
const activePlayer = computed(
  () => game.value?.players[game.value.activePlayerIndex] ?? null
);
const nextPlayer = computed(() => {
  if (!game.value) return null;
  const nextPlayerIndex = getNextActivePlayerIndex(
    game.value,
    game.value.activePlayerIndex
  );
  return nextPlayerIndex === null
    ? null
    : game.value.players[nextPlayerIndex] ?? null;
});
const pending = computed(() => game.value?.pendingInteraction ?? null);
const handoffPending = computed(() => snapshot.value?.flow === 'awaitingHandoff');
const liquidationInteraction = computed(() => {
  const interaction = pending.value;
  if (
    snapshot.value?.flow !== 'awaitingLiquidation' ||
    interaction?.type !== 'LIQUIDATION'
  ) {
    return null;
  }
  return interaction;
});
const liquidationCandidates = computed(() => {
  const interaction = liquidationInteraction.value;
  const currentGame = game.value;
  if (!interaction || !currentGame) return [];

  return getLiquidationCandidates(currentGame, interaction.playerId).map((candidate) => ({
    ...candidate,
    name:
      technicalSliceContent.properties.find(
        (property) => property.id === candidate.propertyId
      )?.name ?? candidate.propertyId,
    level: currentGame.properties[candidate.propertyId]?.level ?? 0
  }));
});
const liquidationQuote = computed(() => {
  const interaction = liquidationInteraction.value;
  if (!interaction || !game.value) return null;
  return quoteLiquidation(
    game.value,
    interaction.payment.id,
    selectedLiquidationPropertyIds.value
  );
});
const liquidationReceiver = computed(() => {
  const receiverId = liquidationInteraction.value?.payment.receiverId;
  if (!receiverId || !game.value) return null;
  return game.value.players.find((player) => player.id === receiverId) ?? null;
});
const activePlayerId = computed<string | null>(() =>
  activePlayer.value?.bankrupt ? null : activePlayer.value?.id ?? null
);
const presentingBankruptcy = computed(
  () => snapshot.value?.flow === 'presentingBankruptcy'
);
const presentingFinished = computed(
  () => snapshot.value?.flow === 'presentingFinished'
);
const isFinishedFlow = computed(
  () => presentingFinished.value || snapshot.value?.flow === 'finished'
);
const bankruptcyEvent = computed(() =>
  [...(snapshot.value?.lastEvents ?? [])]
    .reverse()
    .find((event): event is Extract<DomainEvent, { type: 'PLAYER_BANKRUPT' }> =>
      event.type === 'PLAYER_BANKRUPT'
    ) ?? null
);
const bankruptPlayer = computed(() => {
  const playerId = bankruptcyEvent.value?.playerId;
  return game.value?.players.find((player) => player.id === playerId) ?? null;
});
const bankruptcyHandoffPlayer = computed(() => {
  if (!bankruptPlayer.value || !game.value) return null;
  const nextIndex = getNextActivePlayerIndex(
    game.value,
    game.value.activePlayerIndex
  );
  return nextIndex === null ? null : game.value.players[nextIndex] ?? null;
});
const winner = computed(() => {
  const currentGame = game.value;
  return currentGame?.players.find((player) => player.id === currentGame.winnerId) ?? null;
});
const privateInfoHidden = computed(
  () =>
    isPrivateInfoHidden(
      snapshot.value?.flow ?? null,
      resumePromptOpen.value || newGameSetupOpen.value
    )
);
const renderBrowserTestSnapshot = () => {
  const session = lifecycle.getSession();
  return session
    ? renderBrowserTestGameText(session.getSnapshot(), privateInfoHidden.value)
    : 'NO_ACTIVE_SESSION';
};

if (import.meta.env.MODE === 'browser-test') {
  window.render_game_to_text = renderBrowserTestSnapshot;
}
const busy = computed(
  () => snapshot.value?.cue != null || actionLocked.value || privateInfoHidden.value
);
const canRoll = computed(
  () => snapshot.value?.flow === 'turnReady' && !resumePromptOpen.value && !newGameSetupOpen.value
);
const canEndTurn = computed(
  () => snapshot.value?.flow === 'turnEnd' && !resumePromptOpen.value && !newGameSetupOpen.value
);

const lastTurnEndedEvent = computed(() =>
  [...(snapshot.value?.lastEvents ?? [])]
    .reverse()
    .find((event): event is Extract<DomainEvent, { type: 'TURN_ENDED' }> =>
      event.type === 'TURN_ENDED'
    ) ?? null
);

const handoffFromPlayerId = computed<PlayerId | null>(
  () => lastTurnEndedEvent.value?.playerId ?? restoredHandoffFromPlayerId.value
);
const handoffFromPlayer = computed(() =>
  game.value?.players.find((player) => player.id === handoffFromPlayerId.value) ?? null
);

const propertyCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  if (!game.value) return counts;
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
  if (newGameSetupOpen.value) return '请选择玩家人数后开始新游戏';
  if (resumePromptOpen.value) return '检测到稳定存档，请选择继续或重新开始';
  if (snapshot.value?.flow === 'presentingTurnEnd') return '正在完成本回合并隐藏私有信息';
  if (handoffPending.value && activePlayer.value) {
    return `请将设备交给 ${activePlayer.value.name}`;
  }

  const interaction = pending.value;
  if (interaction?.type === 'STOCK_MARKET') return '经过金融中心：购买一只股票，或跳过后继续移动';
  if (interaction?.type === 'PROPERTY_PURCHASE') return '无主地产：请决定是否购买';
  if (interaction?.type === 'PROPERTY_UPGRADE') return '你的地产：本次落地可升级一级';
  if (interaction?.type === 'EVENT_RESULT') return interaction.title;
  if (interaction?.type === 'CARD_DRAW') return `获得卡牌：${interaction.title}`;
  if (interaction?.type === 'CARD_REPLACEMENT') return '手牌已满：四选三，弃置一张';

  if (liquidationInteraction.value) return '资金不足：请选择要清算的地产';
  if (presentingBankruptcy.value) return '正在呈现破产结果';
  if (presentingFinished.value) return '正在呈现最终结果';
  if (snapshot.value?.flow === 'finished') return '游戏已结束';

  const last = snapshot.value?.lastEvents.at(-1);
  if (last?.type === 'DICE_ROLLED' && activePlayer.value) {
    return `${activePlayer.value.name} 掷出 ${last.value} 点`;
  }
  if (last?.type === 'LAP_REWARD_GRANTED') return '完成一圈，银行奖励800万元';
  if (last?.type === 'PROPERTY_PURCHASED') return '地产购买成功，所有权标记已更新';
  if (last?.type === 'PROPERTY_UPGRADED') return `地产升级至 L${last.level}`;
  if (last?.type === 'RENT_PAID') return `支付租金 ${last.amount * 10}万元`;
  if (last?.type === 'TURN_ENDED') {
    const player = game.value?.players.find((candidate) => candidate.id === last.nextPlayerId);
    return `轮到 ${player?.name ?? last.nextPlayerId}`;
  }
  if (snapshot.value?.flow === 'turnEnd' && nextPlayer.value) {
    return `本回合结算完成，请点击“结束并交给 ${nextPlayer.value.name}”`;
  }
  return '点击投骰，开始本回合';
});

const currentTileName = computed(() => {
  const tile = activePlayer.value
    ? technicalSliceContent.tiles[activePlayer.value.position]
    : null;
  return tile?.name ?? '未知地格';
});

const savedAtText = computed(() => {
  if (!initialSave) return '';
  const date = new Date(initialSave.savedAt);
  return Number.isNaN(date.getTime()) ? initialSave.savedAt : date.toLocaleString('zh-CN');
});

function handleSessionSnapshot(next: TechnicalSliceSessionSnapshot): void {
  snapshot.value = next;
  const generation = lifecycle.getGeneration();

  if (
    next.flow === 'presentingTurnEnd' ||
    next.flow === 'awaitingHandoff' ||
    next.flow === 'awaitingLiquidation' ||
    next.flow === 'presentingBankruptcy' ||
    next.flow === 'presentingFinished' ||
    next.flow === 'finished'
  ) {
    cardsOpen.value = false;
    assetsOpen.value = false;
  }

  if (
    next.flow !== 'presentingBankruptcy' &&
    next.flow !== 'presentingFinished'
  ) {
    presentationReadyCueId.value = null;
  }

  if (next.domainRevision !== lastLoggedDomainRevision) {
    lastLoggedDomainRevision = next.domainRevision;
    if (next.lastEvents.length > 0) {
      void logDomainEvents(next.lastEvents).catch((error: unknown) => {
        if (lifecycle.getGeneration() !== generation) return;
        storageError.value = `事件日志写入失败：${errorMessage(error)}`;
      });
    }
  }

  if (sessionAccepted.value && isStableFlowPhase(next.flow)) {
    queueStableSave(next, generation);
  }

  if (next.cue && next.cue.id !== handledCueId) {
    handledCueId = next.cue.id;
    const session = lifecycle.getSession();
    if (session) void runPresentation(next.cue, session, generation);
  }
}

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

watch(
  () => {
    const interaction = liquidationInteraction.value;
    return interaction
      ? `${interaction.payment.id}:${snapshot.value?.domainRevision}`
      : null;
  },
  () => {
    selectedLiquidationPropertyIds.value = [];
    liquidationSubmitting.value = false;
  },
  { immediate: true }
);

watch(statusMessage, () => {
  if (getScenePresentationPreferences().motion === 'reduced') return;

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
  if (window.render_game_to_text === renderBrowserTestSnapshot) {
    delete window.render_game_to_text;
  }
  lifecycle.dispose();
});

function queueStableSave(
  next: TechnicalSliceSessionSnapshot,
  generation: number
): void {
  if (!isStableFlowPhase(next.flow)) return;
  if (!random) return;
  const flow = next.flow;
  const saveKey = [
    flow,
    next.game.round,
    next.game.activePlayerIndex,
    next.domainRevision
  ].join(':');
  if (saveKey === lastSavedRoundKey) return;
  lastSavedRoundKey = saveKey;

  const gameSnapshot = structuredClone(next.game);
  const randomSnapshot = random.getSnapshot();
  const turnEnded = [...next.lastEvents]
    .reverse()
    .find((event) => event.type === 'TURN_ENDED');
  const fromPlayerId =
    flow === 'awaitingHandoff'
      ? turnEnded?.type === 'TURN_ENDED'
        ? turnEnded.playerId
        : restoredHandoffFromPlayerId.value
      : null;

  lifecycle.enqueueForActiveSession(
    async () => {
      await saveTechnicalSliceSave(
        gameSnapshot,
        randomSnapshot,
        flow,
        fromPlayerId
      );
      if (lifecycle.getGeneration() === generation) {
        storageError.value = '';
      }
    },
    (error: unknown) => {
      storageError.value = `稳定存档写入失败：${errorMessage(error)}`;
      lastSavedRoundKey = '';
    }
  );
}

async function runPresentation(
  cue: PresentationCue,
  sourceSession: TechnicalSliceSession,
  generation: number
): Promise<void> {
  try {
    await presentSceneCue(cue);
  } catch (error) {
    if (lifecycle.getGeneration() === generation) {
      presentationError.value = `场景表现降级完成：${errorMessage(error)}`;
    }
  }
  if (
    lifecycle.getGeneration() !== generation ||
    lifecycle.getSession() !== sourceSession
  ) return;

  const current = sourceSession.getSnapshot();
  if (
    current.cue?.id === cue.id &&
    (current.flow === 'presentingBankruptcy' ||
      current.flow === 'presentingFinished')
  ) {
    presentationReadyCueId.value = cue.id;
    return;
  }
  sourceSession.presentationDone(cue.id);
}

function performAction(operation: (session: TechnicalSliceSession) => void): void {
  const session = lifecycle.getSession();
  if (
    !session ||
    actionLocked.value ||
    resumePromptOpen.value ||
    newGameSetupOpen.value
  ) return;
  actionLocked.value = true;

  try {
    operation(session);
  } finally {
    queueMicrotask(() => {
      actionLocked.value = false;
    });
  }
}

function roll(): void {
  performAction((session) => session.roll());
}

function endTurn(): void {
  cardsOpen.value = false;
  assetsOpen.value = false;
  performAction((session) => session.endTurn());
}

function confirmHandoff(): void {
  performAction((session) => {
    restoredHandoffFromPlayerId.value = null;
    session.confirmHandoff();
  });
}

function buyProperty(): void {
  performAction((session) => session.buyProperty());
}

function skipProperty(): void {
  performAction((session) => session.skipProperty());
}

function upgradeProperty(): void {
  performAction((session) => session.upgradeProperty());
}

function skipUpgrade(): void {
  performAction((session) => session.skipUpgrade());
}

function skipStock(): void {
  performAction((session) => session.resolveStockMarket(null));
}

function buyStock(): void {
  if (!selectedStockId.value) return;
  performAction((session) => {
    session.resolveStockMarket({
      stockId: selectedStockId.value,
      principal: selectedPrincipal.value,
      period: selectedPeriod.value
    });
  });
}

function acknowledgeResult(): void {
  performAction((session) => session.acknowledgeResult());
}

function discardCard(cardInstanceId: string): void {
  performAction((session) => session.chooseCardToDiscard(cardInstanceId));
}

function toggleLiquidationProperty(propertyId: string): void {
  if (liquidationSubmitting.value) return;
  selectedLiquidationPropertyIds.value = selectedLiquidationPropertyIds.value.includes(propertyId)
    ? selectedLiquidationPropertyIds.value.filter((id) => id !== propertyId)
    : [...selectedLiquidationPropertyIds.value, propertyId];
}

function confirmLiquidation(): void {
  const interaction = liquidationInteraction.value;
  if (
    !interaction ||
    !liquidationQuote.value ||
    actionLocked.value ||
    resumePromptOpen.value ||
    liquidationSubmitting.value ||
    selectedLiquidationPropertyIds.value.length === 0
  ) {
    return;
  }

  liquidationSubmitting.value = true;
  performAction((session) => {
    session.confirmLiquidation(
      interaction.payment.id,
      [...selectedLiquidationPropertyIds.value]
    );
    if (session.getSnapshot().error) {
      liquidationSubmitting.value = false;
    }
  });
}

function acknowledgePresentationResult(): void {
  const cueId = presentationReadyCueId.value;
  if (cueId === null) return;
  const delayHandoffActivation = presentingBankruptcy.value;
  if (delayHandoffActivation) {
    handoffActivationPending.value = true;
  }
  presentationReadyCueId.value = null;
  performAction((session) => session.presentationDone(cueId));
  if (delayHandoffActivation) {
    window.requestAnimationFrame(() => {
      handoffActivationPending.value = false;
    });
  }
}

function continueSavedGame(): void {
  const currentSnapshot = snapshot.value;
  if (!currentSnapshot) return;
  sessionAccepted.value = true;
  resumePromptOpen.value = false;
  if (isStableFlowPhase(currentSnapshot.flow)) {
    queueStableSave(currentSnapshot, lifecycle.getGeneration());
  }
  if (props.initialLoad.migrated && props.initialLoad.message) {
    recoveryNotice.value = props.initialLoad.message;
  }
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
  const activePlayerId = activePlayer.value?.id;
  if (!activePlayerId) return null;
  const change = event.changes.find((item) => item.playerId === activePlayerId);
  if (!change) return null;
  return `${change.amount > 0 ? '+' : ''}${change.amount * 10}万元`;
}

function resetTechnicalSlice(): void {
  if (actionLocked.value) return;
  sessionAccepted.value = false;
  resumePromptOpen.value = false;
  newGameSetupOpen.value = true;
  newGameWillOverwrite.value = lifecycle.getSession() !== null;
  selectedPlayerCount.value = 2;
  clearSessionTransientUi();
}

async function startNewGame(): Promise<void> {
  if (actionLocked.value) return;
  actionLocked.value = true;
  const playerCount = selectedPlayerCount.value;
  sessionAccepted.value = false;

  try {
    const cleared = lifecycle.retireAndDrain(async () => {
      await clearTechnicalSliceSave();
    });
    clearSessionTransientUi();
    snapshot.value = null;
    await cleared;
    startSession(
      {
        random: new SeededRandom(20260805),
        game: createTechnicalSliceState(playerCount),
        flow: 'turnReady'
      },
      true,
      null
    );
    newGameSetupOpen.value = false;
    newGameWillOverwrite.value = false;
  } catch (error) {
    storageError.value = `无法覆盖存档：${errorMessage(error)}`;
    actionLocked.value = false;
  }
}

function startSession(
  seed: {
    random: SeededRandom;
    game: GameState;
    flow: StableFlowPhase;
  },
  accepted: boolean,
  handoffFromPlayerId: PlayerId | null
): void {
  clearSessionTransientUi();
  actionLocked.value = false;
  random = seed.random;
  sessionAccepted.value = accepted;
  restoredHandoffFromPlayerId.value = handoffFromPlayerId;
  lifecycle.start(seed);
}

function clearSessionTransientUi(): void {
  cardsOpen.value = false;
  assetsOpen.value = false;
  selectedStockId.value = '';
  selectedPrincipal.value = 50;
  selectedPeriod.value = 2;
  selectedLiquidationPropertyIds.value = [];
  liquidationSubmitting.value = false;
  actionLocked.value = false;
  storageError.value = '';
  presentationError.value = '';
  presentationReadyCueId.value = null;
  handoffActivationPending.value = false;
  restoredHandoffFromPlayerId.value = null;
  handledCueId = 0;
  lastLoggedDomainRevision = -1;
  lastSavedRoundKey = '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function isStableFlowPhase(flow: string): flow is StableFlowPhase {
  return (
    flow === 'turnReady' ||
    flow === 'awaitingHandoff' ||
    flow === 'awaitingLiquidation' ||
    flow === 'finished'
  );
}

function clearSessionError(): void {
  lifecycle.getSession()?.clearError();
}

if (initialSession) {
  startSession(
    {
      random: initialSave
        ? SeededRandom.fromSnapshot(initialSave.random)
        : SeededRandom.fromSnapshot(props.browserTestFixture!.random),
      game: initialSession.game,
      flow: initialSession.flow
    },
    initialSave === null,
    initialSave?.handoffFromPlayerId ?? null
  );
}
</script>

<template>
  <main class="app-shell" :class="{ 'private-info-hidden': privateInfoHidden }">
    <template v-if="snapshot && game && activePlayer">
      <GameCanvas :game-state="game" />

    <PlayerBar
      :players="game.players"
      :active-player-id="activePlayerId"
      :property-counts="propertyCounts"
    />

    <aside
      v-if="!privateInfoHidden"
      class="current-player-card"
      :style="{ '--player-color': activePlayer.color }"
    >
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

    <aside v-else class="current-player-card privacy-card">
      <span class="privacy-lock">●</span>
      <div>
        <span class="eyebrow">Private information</span>
        <strong>玩家私有信息已隐藏</strong>
      </div>
    </aside>

    <section class="status-pill" aria-live="polite">
      <span class="status-dot"></span>
      {{ statusMessage }}
    </section>

    <ControlDock
      v-if="!privateInfoHidden && !isFinishedFlow"
      :can-roll="canRoll"
      :can-end-turn="canEndTurn"
      :busy="busy"
      :card-count="activePlayer.cards.length"
      :stock-count="activePlayer.stocks.length"
      :next-player-name="nextPlayer?.name ?? ''"
      @roll="roll"
      @end-turn="endTurn"
      @toggle-cards="cardsOpen = !cardsOpen; assetsOpen = false"
      @toggle-assets="assetsOpen = !assetsOpen; cardsOpen = false"
    />

    <ContextPanel
      v-if="cardsOpen && !privateInfoHidden"
      title="我的手牌"
      eyebrow="Cards"
      @close="cardsOpen = false"
    >
      <div v-if="activePlayer?.cards.length" class="collection-grid">
        <article v-for="card in activePlayer?.cards ?? []" :key="card.instanceId" class="collection-card">
          <span class="card-rarity">CARD</span>
          <strong>{{ technicalSliceContent.cards.find((item) => item.id === card.cardId)?.name }}</strong>
          <small>{{ technicalSliceContent.cards.find((item) => item.id === card.cardId)?.description }}</small>
        </article>
      </div>
      <p v-else class="empty-state">尚未获得卡牌。</p>
    </ContextPanel>

    <ContextPanel
      v-if="assetsOpen && !privateInfoHidden"
      title="资产概览"
      eyebrow="Assets"
      @close="assetsOpen = false"
    >
      <div class="asset-summary">
        <h3>地产</h3>
        <article
          v-for="property in Object.values(game.properties).filter((item) => item.ownerId === activePlayer?.id)"
          :key="property.id"
          class="asset-row"
        >
          <span>{{ technicalSliceContent.properties.find((item) => item.id === property.id)?.name }}</span>
          <b>L{{ property.level }}</b>
        </article>
        <p v-if="!Object.values(game.properties).some((item) => item.ownerId === activePlayer?.id)" class="empty-state">
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
      v-if="pending && !privateInfoHidden && pending.type !== 'LIQUIDATION'"
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
            :disabled="actionLocked"
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
            :disabled="actionLocked"
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
            :disabled="actionLocked"
            @click="selectedPeriod = period"
          >
            {{ period }}大轮
          </button>
        </div>

        <div class="modal-actions">
          <button class="secondary-action" type="button" :disabled="actionLocked" @click="skipStock">跳过</button>
          <button
            class="primary-action"
            type="button"
            :disabled="actionLocked || activePlayer.cash < selectedPrincipal"
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
          <button class="secondary-action" type="button" :disabled="actionLocked" @click="skipProperty">暂不购买</button>
          <button
            class="primary-action"
            type="button"
            :disabled="actionLocked || activePlayer.cash < pending.price"
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
          <button class="secondary-action" type="button" :disabled="actionLocked" @click="skipUpgrade">保持现状</button>
          <button
            class="primary-action"
            type="button"
            :disabled="actionLocked || activePlayer.cash < pending.cost"
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
        <button class="primary-action full" type="button" :disabled="actionLocked" @click="acknowledgeResult">知道了</button>
      </article>

      <article v-else-if="pending.type === 'CARD_DRAW'" class="decision-modal result-modal">
        <span class="eyebrow">幸运卡片</span>
        <div class="result-icon card">▤</div>
        <h2>{{ pending.title }}</h2>
        <p>{{ pending.description }}</p>
        <button class="primary-action full" type="button" :disabled="actionLocked" @click="acknowledgeResult">收入手牌</button>
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
            :disabled="actionLocked"
            @click="discardCard(card.instanceId)"
          >
            <strong>{{ cardName(card.instanceId) }}</strong>
            <small>{{ card.instanceId === pending.drawnCardInstanceId ? '本次新抽取' : '原有手牌' }}</small>
            <span>弃置此牌</span>
          </button>
        </div>
      </article>
    </section>

    <section
      v-if="liquidationInteraction && liquidationQuote && !privateInfoHidden"
      class="modal-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <LiquidationModal
        :payment="liquidationInteraction.payment"
        :payer-name="activePlayer.name"
        :receiver-name="liquidationReceiver?.name ?? null"
        :candidates="liquidationCandidates"
        :selected-property-ids="selectedLiquidationPropertyIds"
        :quote="liquidationQuote"
        :submitting="liquidationSubmitting"
        @toggle-property="toggleLiquidationProperty"
        @confirm="confirmLiquidation"
      />
    </section>

    <section
      v-if="presentingBankruptcy && bankruptPlayer && !resumePromptOpen"
      class="presentation-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <article class="presentation-card bankruptcy-card">
        <span class="eyebrow">Bankruptcy</span>
        <div class="presentation-icon">!</div>
        <h2>{{ bankruptPlayer.name }} 已破产</h2>
        <p>该玩家已退出本局。</p>
        <p v-if="bankruptcyHandoffPlayer">
          确认后将交接给 {{ bankruptcyHandoffPlayer.name }}。
        </p>
        <p v-else>正在确定后续流程。</p>
        <button
          class="primary-action full"
          type="button"
          :disabled="actionLocked || presentationReadyCueId === null"
          @click="acknowledgePresentationResult"
        >
          {{ presentationReadyCueId === null ? '正在呈现…' : '继续交接' }}
        </button>
      </article>
    </section>

    <section
      v-if="isFinishedFlow && winner && !resumePromptOpen"
      class="presentation-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <article class="presentation-card winner-card" :style="{ '--winner-color': winner.color }">
        <span class="eyebrow">Game finished</span>
        <div class="presentation-icon winner-icon">★</div>
        <h2>游戏结束</h2>
        <p><strong>{{ winner.name }}</strong> 获胜</p>
        <dl class="winner-summary">
          <div><dt>最终现金</dt><dd>{{ winner.cash * 10 }}万元</dd></div>
          <div><dt>胜者标识</dt><dd>{{ winner.id }}</dd></div>
        </dl>
        <button
          v-if="presentingFinished"
          class="primary-action full"
          type="button"
          :disabled="actionLocked || presentationReadyCueId === null"
          @click="acknowledgePresentationResult"
        >
          {{ presentationReadyCueId === null ? '正在呈现…' : '查看最终结果' }}
        </button>
      </article>
    </section>

    <section
      v-if="handoffPending && !handoffActivationPending && !resumePromptOpen"
      class="handoff-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <article class="handoff-card" :style="{ '--player-color': activePlayer.color }">
        <span class="eyebrow">Pass the device</span>
        <div class="handoff-route">
          <span>{{ handoffFromPlayer?.name ?? '上一位玩家' }}</span>
          <i>→</i>
          <strong>{{ activePlayer.name }}</strong>
        </div>
        <h2>请将设备交给 {{ activePlayer.name }}</h2>
        <p>上一位玩家的手牌和资产入口已隐藏。确认设备已交接后，再开始新的回合。</p>
        <button class="primary-action handoff-action" type="button" :disabled="actionLocked" @click="confirmHandoff">
          {{ activePlayer.name }} 已准备好
        </button>
      </article>
    </section>

    <section
      v-if="resumePromptOpen"
      class="session-entry-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <article class="session-entry-card">
        <span class="eyebrow">Stable save detected</span>
        <h1>继续上次游戏？</h1>
        <p>存档只记录完整回合边界，不会恢复到投骰、移动或结算动画中间。</p>
        <div class="session-summary">
          <div><span>当前大轮</span><strong>第 {{ game.round }} 大轮</strong></div>
          <div><span>当前玩家</span><strong>{{ activePlayer.name }}</strong></div>
          <div><span>保存时间</span><strong>{{ savedAtText }}</strong></div>
          <div>
            <span>恢复节点</span>
            <strong>
              {{
                snapshot.flow === 'awaitingHandoff'
                  ? '玩家交接'
                  : snapshot.flow === 'awaitingLiquidation'
                    ? '等待清算'
                    : snapshot.flow === 'finished'
                      ? '最终结果'
                      : '回合开始'
              }}
            </strong>
          </div>
        </div>
        <p v-if="props.initialLoad.migrated" class="migration-note">旧版存档将在继续后升级到新的完整性校验格式。</p>
        <div class="session-entry-actions">
          <button class="secondary-action" type="button" :disabled="actionLocked" @click="resetTechnicalSlice">重新开始</button>
          <button class="primary-action" type="button" :disabled="actionLocked" @click="continueSavedGame">继续游戏</button>
        </div>
      </article>
    </section>

    <div v-if="snapshot.error" class="error-toast" role="alert">
      {{ snapshot.error }}
      <button type="button" @click="clearSessionError">×</button>
    </div>

    <div v-else-if="storageError" class="error-toast" role="alert">
      {{ storageError }}
      <button type="button" @click="storageError = ''">×</button>
    </div>

    <div v-else-if="presentationError" class="warning-toast" role="status">
      {{ presentationError }}
      <button type="button" @click="presentationError = ''">×</button>
    </div>

    </template>

    <NewGameSetup
      v-if="newGameSetupOpen"
      :selected-player-count="selectedPlayerCount"
      :overwrites-existing-save="newGameWillOverwrite"
      :busy="actionLocked"
      @select-player-count="selectedPlayerCount = $event"
      @start="startNewGame"
    />

    <div v-if="recoveryNotice" class="recovery-toast" role="status">
      {{ recoveryNotice }}
      <button type="button" @click="recoveryNotice = null">知道了</button>
    </div>

    <div class="build-badge">PHASE 2.1 · 2–4 PLAYER LOCAL GAME</div>
  </main>
</template>
