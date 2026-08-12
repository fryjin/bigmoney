import {
  technicalSliceContent,
  type TechnicalSliceContent
} from '@bigmoney/game-content';
import {
  pickOne,
  pickUnique,
  type RandomProvider
} from '@bigmoney/game-random';
import {
  getLiquidationValue,
  getRent,
  getUpgradeCost,
  roundMoney
} from './money';
import type {
  CardInstance,
  CommandResult,
  DomainEvent,
  ForcedPayment,
  GameCommand,
  GameState,
  LiquidationCandidate,
  LiquidationQuote,
  PlayerId,
  PlayerState,
  PropertyState,
  StockHolding
} from './model';

export function createTechnicalSliceState(
  content: TechnicalSliceContent = technicalSliceContent
): GameState {
  const properties = Object.fromEntries(
    content.properties.map((property): [string, PropertyState] => [
      property.id,
      {
        id: property.id,
        ownerId: null,
        level: 0
      }
    ])
  );

  return {
    ruleVersion: content.ruleVersion,
    technicalSliceVersion: content.technicalSliceVersion,
    status: 'IN_PROGRESS',
    winnerId: null,
    round: 1,
    activePlayerIndex: 0,
    players: [
      createPlayer('P1', '玩家一', '#E87868', content.startingCash),
      createPlayer('P2', '玩家二', '#4F8FB8', content.startingCash)
    ],
    properties,
    turn: createEmptyTurn(),
    pendingInteraction: null,
    nextInstanceSequence: 1
  };
}

export function executeCommand(
  state: GameState,
  command: GameCommand,
  random: RandomProvider,
  content: TechnicalSliceContent = technicalSliceContent
): CommandResult {
  if (state.status === 'FINISHED') {
    throw new Error('游戏已经结束。');
  }
  const activePlayer = getActivePlayer(state);
  if (activePlayer.bankrupt) {
    throw new Error('破产玩家不能继续执行回合操作。');
  }
  if (activePlayer.id !== command.playerId) {
    throw new Error('当前操作玩家不是本回合玩家。');
  }

  switch (command.type) {
    case 'ROLL_DICE':
      return rollDice(state, activePlayer.id, random);
    case 'MOVE_ONE_STEP':
      return moveOneStep(state, activePlayer.id, random, content);
    case 'RESOLVE_STOCK_MARKET':
      return resolveStockMarket(state, activePlayer.id, command.purchase, content);
    case 'RESOLVE_DESTINATION':
      return resolveDestination(state, activePlayer.id, random, content);
    case 'BUY_PROPERTY':
      return buyProperty(state, activePlayer.id);
    case 'SKIP_PROPERTY':
      return skipProperty(state, activePlayer.id);
    case 'UPGRADE_PROPERTY':
      return upgradeProperty(state, activePlayer.id);
    case 'SKIP_UPGRADE':
      return skipUpgrade(state, activePlayer.id);
    case 'ACKNOWLEDGE_RESULT':
      return acknowledgeResult(state, activePlayer.id);
    case 'CHOOSE_CARD_TO_DISCARD':
      return chooseCardToDiscard(state, activePlayer.id, command.cardInstanceId);
    case 'CONFIRM_LIQUIDATION':
      return confirmLiquidation(state, activePlayer.id, command.paymentId, command.propertyIds, content);
    case 'END_TURN':
      return endTurn(state, activePlayer.id, random, content);
  }
}

function createPlayer(
  id: PlayerId,
  name: string,
  color: string,
  cash: number
): PlayerState {
  return {
    id,
    name,
    color,
    cash,
    position: 0,
    bankrupt: false,
    cards: [],
    stocks: []
  };
}

function createEmptyTurn(): GameState['turn'] {
  return {
    rolledValue: null,
    remainingSteps: 0,
    triggeredStockMarkets: [],
    readyToEnd: false
  };
}

function getActivePlayer(state: GameState): PlayerState {
  const player = state.players[state.activePlayerIndex];
  if (!player) throw new Error('找不到当前玩家。');
  return player;
}

export function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !player.bankrupt);
}

export function getNextActivePlayerIndex(state: GameState, fromIndex: number): number | null {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidateIndex = (fromIndex + offset) % state.players.length;
    const candidate = state.players[candidateIndex];
    if (candidate && !candidate.bankrupt) return candidateIndex;
  }
  return null;
}

export function getWinnerId(state: GameState): PlayerId | null {
  const activePlayers = getActivePlayers(state);
  return activePlayers.length === 1 ? activePlayers[0]!.id : null;
}

export function getLiquidationCandidates(
  state: GameState,
  playerId: PlayerId,
  content: TechnicalSliceContent = technicalSliceContent
): LiquidationCandidate[] {
  return content.properties.flatMap((definition) => {
    const property = state.properties[definition.id];
    if (!property || property.ownerId !== playerId) return [];
    return [{
      propertyId: property.id,
      purchasePrice: definition.purchasePrice,
      liquidationValue: getLiquidationValue(definition.purchasePrice)
    }];
  });
}

export function quoteLiquidation(
  state: GameState,
  paymentId: string,
  propertyIds: PropertyState['id'][],
  content: TechnicalSliceContent = technicalSliceContent
): LiquidationQuote {
  const pending = getLiquidationInteraction(state, paymentId);
  const candidates = getSelectedLiquidationCandidates(
    state,
    pending.playerId,
    propertyIds,
    content
  );
  const liquidationValue = candidates.reduce(
    (total, candidate) => total + candidate.liquidationValue,
    0
  );
  const payer = state.players.find((player) => player.id === pending.playerId);
  if (!payer) throw new Error('付款玩家不存在。');
  const cashAfterLiquidation = payer.cash + liquidationValue;
  const remainingAmount = Math.max(pending.payment.amount - cashAfterLiquidation, 0);

  return {
    paymentId,
    payerId: pending.playerId,
    amountDue: pending.payment.amount,
    availableCash: payer.cash,
    propertyIds: candidates.map((candidate) => candidate.propertyId),
    liquidationValue,
    cashAfterLiquidation,
    remainingAmount,
    canCompletePayment: remainingAmount === 0
  };
}

function rollDice(
  state: GameState,
  playerId: PlayerId,
  random: RandomProvider
): CommandResult {
  if (state.pendingInteraction) throw new Error('仍有未处理的交互。');
  if (state.turn.rolledValue !== null || state.turn.remainingSteps > 0 || state.turn.readyToEnd) {
    throw new Error('当前阶段不能再次投骰。');
  }

  const nextState = structuredClone(state);
  const value = random.nextInt(1, 6);
  nextState.turn.rolledValue = value;
  nextState.turn.remainingSteps = value;

  return {
    nextState,
    events: [{ type: 'DICE_ROLLED', playerId, value }]
  };
}

function moveOneStep(
  state: GameState,
  playerId: PlayerId,
  random: RandomProvider,
  content: TechnicalSliceContent
): CommandResult {
  if (state.pendingInteraction) throw new Error('移动前必须完成当前交互。');
  if (state.turn.remainingSteps <= 0 || state.turn.rolledValue === null) {
    throw new Error('没有可执行的剩余步数。');
  }

  const nextState = structuredClone(state);
  const player = getActivePlayer(nextState);
  const events: DomainEvent[] = [];

  const from = player.position;
  const to = (from + 1) % content.tiles.length;
  player.position = to;
  nextState.turn.remainingSteps -= 1;
  events.push({ type: 'PLAYER_MOVED', playerId, from, to });

  const fromTile = content.tiles[from];
  const toTile = content.tiles[to];

  if (fromTile?.type === 'FINISH' && toTile?.type === 'START') {
    player.cash += content.lapReward;
    events.push({
      type: 'LAP_REWARD_GRANTED',
      playerId,
      amount: content.lapReward
    });
  }

  if (
    toTile?.type === 'STOCK' &&
    toTile.stockMarketId &&
    !nextState.turn.triggeredStockMarkets.includes(toTile.stockMarketId)
  ) {
    nextState.turn.triggeredStockMarkets.push(toTile.stockMarketId);
    const offeredStockIds = pickUnique(
      content.stocks.map((stock) => stock.id),
      content.stockMarket.offerCount,
      random
    );

    nextState.pendingInteraction = {
      type: 'STOCK_MARKET',
      playerId,
      tileId: toTile.id,
      marketId: toTile.stockMarketId,
      offeredStockIds
    };

    events.push({
      type: 'STOCK_MARKET_OFFERED',
      playerId,
      marketId: toTile.stockMarketId,
      offeredStockIds
    });
  }

  return { nextState, events };
}

function resolveStockMarket(
  state: GameState,
  playerId: PlayerId,
  purchase: Extract<GameCommand, { type: 'RESOLVE_STOCK_MARKET' }>['purchase'],
  content: TechnicalSliceContent
): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'STOCK_MARKET' || pending.playerId !== playerId) {
    throw new Error('当前没有可处理的股票市场交互。');
  }

  const nextState = structuredClone(state);
  const nextPending = nextState.pendingInteraction;
  if (!nextPending || nextPending.type !== 'STOCK_MARKET') {
    throw new Error('股票市场状态已失效。');
  }
  const player = getActivePlayer(nextState);
  const events: DomainEvent[] = [];

  if (purchase === null) {
    events.push({
      type: 'STOCK_MARKET_SKIPPED',
      playerId,
      marketId: pending.marketId
    });
  } else {
    if (!pending.offeredStockIds.includes(purchase.stockId)) {
      throw new Error('所选股票不在本次市场报价中。');
    }
    if (!content.stockMarket.investmentTiers.some((tier) => tier === purchase.principal)) {
      throw new Error('投资金额不符合固定档位。');
    }
    if (!content.stockMarket.periods.includes(purchase.period)) {
      throw new Error('投资周期不符合可选周期。');
    }
    if (player.stocks.length >= 3) throw new Error('持仓数量已达到上限。');
    if (player.stocks.some((holding) => holding.stockId === purchase.stockId)) {
      throw new Error('持有期间不能重复购买同一股票。');
    }
    if (player.cash < purchase.principal) throw new Error('余额不足，无法购买股票。');

    player.cash -= purchase.principal;
    const holdingId = createInstanceId(nextState, 'STOCK');
    player.stocks.push({
      holdingId,
      stockId: purchase.stockId,
      principal: purchase.principal,
      originalPeriod: purchase.period,
      remainingRounds: purchase.period,
      purchasedRound: nextState.round
    });
    events.push({
      type: 'STOCK_PURCHASED',
      playerId,
      stockId: purchase.stockId,
      principal: purchase.principal,
      period: purchase.period,
      holdingId
    });
  }

  nextState.pendingInteraction = null;
  return { nextState, events };
}

function resolveDestination(
  state: GameState,
  playerId: PlayerId,
  random: RandomProvider,
  content: TechnicalSliceContent
): CommandResult {
  if (state.pendingInteraction) throw new Error('仍有未处理的交互。');
  if (state.turn.rolledValue === null || state.turn.remainingSteps !== 0) {
    throw new Error('必须完成移动后才能结算最终落点。');
  }

  const nextState = structuredClone(state);
  const player = getActivePlayer(nextState);
  const tile = content.tiles[player.position];
  if (!tile) throw new Error('玩家所在地图节点无效。');

  const events: DomainEvent[] = [];

  if (tile.type === 'PROPERTY' && tile.propertyId) {
    const property = nextState.properties[tile.propertyId];
    const definition = content.properties.find((item) => item.id === tile.propertyId);
    if (!property || !definition) throw new Error('地产配置不存在。');

    if (property.ownerId === null) {
      nextState.pendingInteraction = {
        type: 'PROPERTY_PURCHASE',
        playerId,
        tileId: tile.id,
        propertyId: property.id,
        price: definition.purchasePrice
      };
      events.push({
        type: 'PROPERTY_PURCHASE_REQUESTED',
        playerId,
        propertyId: property.id,
        price: definition.purchasePrice
      });
      return { nextState, events };
    }

    if (property.ownerId === playerId) {
      if (property.level < 3) {
        const nextLevel = (property.level + 1) as 1 | 2 | 3;
        const cost = getUpgradeCost(definition.purchasePrice, nextLevel);
        nextState.pendingInteraction = {
          type: 'PROPERTY_UPGRADE',
          playerId,
          tileId: tile.id,
          propertyId: property.id,
          currentLevel: property.level as 0 | 1 | 2,
          nextLevel,
          cost
        };
        events.push({
          type: 'PROPERTY_UPGRADE_REQUESTED',
          playerId,
          propertyId: property.id,
          nextLevel,
          cost
        });
        return { nextState, events };
      }
    } else {
      const owner = nextState.players.find((candidate) => candidate.id === property.ownerId);
      if (!owner) throw new Error('地产所有者不存在。');
      const rent = getRent(definition.purchasePrice, property.level);
      requestForcedPayment(
        nextState,
        {
          id: createInstanceId(nextState, 'PAYMENT'),
          payerId: playerId,
          receiverId: owner.id,
          amount: rent,
          reason: 'RENT',
          propertyId: property.id
        },
        content,
        events
      );
      return { nextState, events };
    }
  }

  if (tile.type === 'EVENT') {
    const eventDefinition = pickOne(content.events, random);
    if (eventDefinition.kind === 'PERSONAL_EXPENSE') {
      requestForcedPayment(
        nextState,
        {
          id: createInstanceId(nextState, 'PAYMENT'),
          payerId: playerId,
          receiverId: null,
          amount: eventDefinition.amount,
          reason: 'EVENT_EXPENSE',
          eventId: eventDefinition.id,
          title: eventDefinition.name,
          description: eventDefinition.description
        },
        content,
        events
      );
      return { nextState, events };
    }
    const changes = applyEvent(nextState, playerId, eventDefinition.kind, eventDefinition.amount);
    nextState.pendingInteraction = {
      type: 'EVENT_RESULT',
      playerId,
      eventId: eventDefinition.id,
      title: eventDefinition.name,
      description: eventDefinition.description
    };
    events.push({
      type: 'EVENT_RESOLVED',
      eventId: eventDefinition.id,
      playerId,
      title: eventDefinition.name,
      description: eventDefinition.description,
      changes
    });
    return { nextState, events };
  }

  if (tile.type === 'CARD') {
    const cardDefinition = pickOne(content.cards, random);
    const card: CardInstance = {
      instanceId: createInstanceId(nextState, 'CARD'),
      cardId: cardDefinition.id
    };

    if (player.cards.length < content.cardHandCap) {
      player.cards.push(card);
      nextState.pendingInteraction = {
        type: 'CARD_DRAW',
        playerId,
        card,
        title: cardDefinition.name,
        description: cardDefinition.description
      };
      events.push({
        type: 'CARD_DRAWN',
        playerId,
        card,
        cardId: cardDefinition.id,
        title: cardDefinition.name,
        description: cardDefinition.description
      });
      return { nextState, events };
    }

    const candidateCards = [...player.cards, card];
    nextState.pendingInteraction = {
      type: 'CARD_REPLACEMENT',
      playerId,
      candidateCards,
      drawnCardInstanceId: card.instanceId
    };
    events.push({
      type: 'CARD_REPLACEMENT_REQUIRED',
      playerId,
      candidateCards,
      drawnCardInstanceId: card.instanceId
    });
    return { nextState, events };
  }

  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function buyProperty(state: GameState, playerId: PlayerId): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'PROPERTY_PURCHASE' || pending.playerId !== playerId) {
    throw new Error('当前没有待处理的地产购买。');
  }

  const nextState = structuredClone(state);
  const player = getActivePlayer(nextState);
  const property = nextState.properties[pending.propertyId];
  if (!property || property.ownerId !== null) throw new Error('地产已不再可购买。');
  if (player.cash < pending.price) throw new Error('余额不足，无法购买地产。');

  player.cash -= pending.price;
  property.ownerId = playerId;
  nextState.pendingInteraction = null;

  const events: DomainEvent[] = [{
    type: 'PROPERTY_PURCHASED',
    playerId,
    propertyId: pending.propertyId,
    price: pending.price
  }];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function skipProperty(state: GameState, playerId: PlayerId): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'PROPERTY_PURCHASE' || pending.playerId !== playerId) {
    throw new Error('当前没有待处理的地产购买。');
  }

  const nextState = structuredClone(state);
  nextState.pendingInteraction = null;
  const events: DomainEvent[] = [{
    type: 'PROPERTY_PURCHASE_SKIPPED',
    playerId,
    propertyId: pending.propertyId
  }];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function upgradeProperty(state: GameState, playerId: PlayerId): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'PROPERTY_UPGRADE' || pending.playerId !== playerId) {
    throw new Error('当前没有待处理的地产升级。');
  }

  const nextState = structuredClone(state);
  const player = getActivePlayer(nextState);
  const property = nextState.properties[pending.propertyId];
  if (!property || property.ownerId !== playerId) throw new Error('只能升级自己的地产。');
  if (player.cash < pending.cost) throw new Error('余额不足，无法升级地产。');

  player.cash -= pending.cost;
  property.level = pending.nextLevel;
  nextState.pendingInteraction = null;

  const events: DomainEvent[] = [{
    type: 'PROPERTY_UPGRADED',
    playerId,
    propertyId: property.id,
    level: pending.nextLevel,
    cost: pending.cost
  }];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function skipUpgrade(state: GameState, playerId: PlayerId): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'PROPERTY_UPGRADE' || pending.playerId !== playerId) {
    throw new Error('当前没有待处理的地产升级。');
  }

  const nextState = structuredClone(state);
  nextState.pendingInteraction = null;
  const events: DomainEvent[] = [{
    type: 'PROPERTY_UPGRADE_SKIPPED',
    playerId,
    propertyId: pending.propertyId
  }];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function acknowledgeResult(state: GameState, playerId: PlayerId): CommandResult {
  const pending = state.pendingInteraction;
  if (
    !pending ||
    !['EVENT_RESULT', 'CARD_DRAW'].includes(pending.type) ||
    pending.playerId !== playerId
  ) {
    throw new Error('当前没有可确认的结果。');
  }

  const nextState = structuredClone(state);
  nextState.pendingInteraction = null;
  const events: DomainEvent[] = [];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function chooseCardToDiscard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: string
): CommandResult {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'CARD_REPLACEMENT' || pending.playerId !== playerId) {
    throw new Error('当前没有待处理的手牌替换。');
  }
  if (!pending.candidateCards.some((card) => card.instanceId === cardInstanceId)) {
    throw new Error('选择的卡牌不在候选手牌中。');
  }

  const nextState = structuredClone(state);
  const player = getActivePlayer(nextState);
  player.cards = pending.candidateCards.filter((card) => card.instanceId !== cardInstanceId);
  if (player.cards.length !== 3) throw new Error('手牌替换后必须保留3张卡。');

  nextState.pendingInteraction = null;
  const events: DomainEvent[] = [{
    type: 'CARD_DISCARDED_AFTER_DRAW',
    playerId,
    discardedCardInstanceId: cardInstanceId
  }];
  markTurnReady(nextState, playerId, events);
  return { nextState, events };
}

function confirmLiquidation(
  state: GameState,
  playerId: PlayerId,
  paymentId: string,
  propertyIds: PropertyState['id'][],
  content: TechnicalSliceContent
): CommandResult {
  const pending = getLiquidationInteraction(state, paymentId);
  if (pending.playerId !== playerId) {
    throw new Error('只能确认当前付款玩家的清算。');
  }
  const quote = quoteLiquidation(state, paymentId, propertyIds, content);
  const nextState = structuredClone(state);
  const nextPending = getLiquidationInteraction(nextState, paymentId);
  const payer = nextState.players.find((player) => player.id === playerId);
  if (!payer) throw new Error('付款玩家不存在。');

  const events: DomainEvent[] = [];
  for (const propertyId of quote.propertyIds) {
    const property = nextState.properties[propertyId];
    const candidate = getLiquidationCandidates(nextState, playerId, content).find(
      (item) => item.propertyId === propertyId
    );
    if (!property || !candidate) throw new Error('待清算地产状态已失效。');

    property.ownerId = null;
    property.level = 0;
    payer.cash += candidate.liquidationValue;
    events.push({
      type: 'PROPERTY_LIQUIDATED',
      playerId,
      propertyId,
      value: candidate.liquidationValue
    });
  }

  resolveForcedPayment(nextState, nextPending.payment, content, events);
  return { nextState, events };
}

function getLiquidationInteraction(state: GameState, paymentId: string) {
  const pending = state.pendingInteraction;
  if (!pending || pending.type !== 'LIQUIDATION' || pending.payment.id !== paymentId) {
    throw new Error('当前没有匹配的待清算付款。');
  }
  return pending;
}

function getSelectedLiquidationCandidates(
  state: GameState,
  playerId: PlayerId,
  propertyIds: PropertyState['id'][],
  content: TechnicalSliceContent
): LiquidationCandidate[] {
  if (propertyIds.length === 0) {
    throw new Error('清算地产不能为空。');
  }
  if (new Set(propertyIds).size !== propertyIds.length) {
    throw new Error('清算地产不能重复。');
  }

  const candidatesById = new Map(
    getLiquidationCandidates(state, playerId, content).map((candidate) => [
      candidate.propertyId,
      candidate
    ])
  );
  return propertyIds.map((propertyId) => {
    const candidate = candidatesById.get(propertyId);
    if (!candidate) throw new Error('只能清算付款玩家持有的地产。');
    return candidate;
  });
}

function requestForcedPayment(
  state: GameState,
  payment: ForcedPayment,
  content: TechnicalSliceContent,
  events: DomainEvent[]
): void {
  events.push({ type: 'PAYMENT_REQUESTED', payment });
  resolveForcedPayment(state, payment, content, events);
}

function resolveForcedPayment(
  state: GameState,
  payment: ForcedPayment,
  content: TechnicalSliceContent,
  events: DomainEvent[]
): void {
  const payer = state.players.find((player) => player.id === payment.payerId);
  if (!payer) throw new Error('付款玩家不存在。');

  if (payer.cash >= payment.amount) {
    payer.cash -= payment.amount;
    if (payment.receiverId !== null) {
      const receiver = state.players.find((player) => player.id === payment.receiverId);
      if (!receiver) throw new Error('收款玩家不存在。');
      receiver.cash += payment.amount;
    }
    state.pendingInteraction = null;
    events.push({ type: 'PAYMENT_COMPLETED', payment });
    continueAfterPayment(state, payment, events);
    return;
  }

  if (getLiquidationCandidates(state, payment.payerId, content).length > 0) {
    state.pendingInteraction = {
      type: 'LIQUIDATION',
      playerId: payment.payerId,
      payment
    };
    events.push({
      type: 'LIQUIDATION_REQUIRED',
      payment,
      remainingAmount: payment.amount - payer.cash
    });
    return;
  }

  const paidAmount = payer.cash;
  payer.cash = 0;
  if (payment.receiverId !== null) {
    const receiver = state.players.find((player) => player.id === payment.receiverId);
    if (!receiver) throw new Error('收款玩家不存在。');
    receiver.cash += paidAmount;
  }
  payer.bankrupt = true;
  state.pendingInteraction = null;
  events.push({
    type: 'PLAYER_BANKRUPT',
    playerId: payer.id,
    paymentId: payment.id,
    receiverId: payment.receiverId,
    paidAmount,
    writtenOffAmount: payment.amount - paidAmount
  });

  const winnerId = getWinnerId(state);
  if (winnerId !== null) {
    state.status = 'FINISHED';
    state.winnerId = winnerId;
    events.push({ type: 'GAME_FINISHED', winnerId });
  }
}

function continueAfterPayment(
  state: GameState,
  payment: ForcedPayment,
  events: DomainEvent[]
): void {
  if (payment.reason === 'RENT') {
    events.push({
      type: 'RENT_PAID',
      payerId: payment.payerId,
      ownerId: payment.receiverId,
      propertyId: payment.propertyId,
      amount: payment.amount
    });
    markTurnReady(state, payment.payerId, events);
    return;
  }

  if (payment.reason === 'EVENT_EXPENSE') {
    state.pendingInteraction = {
      type: 'EVENT_RESULT',
      playerId: payment.payerId,
      eventId: payment.eventId,
      title: payment.title,
      description: payment.description
    };
    events.push({
      type: 'EVENT_RESOLVED',
      eventId: payment.eventId,
      playerId: payment.payerId,
      title: payment.title,
      description: payment.description,
      changes: [{ playerId: payment.payerId, amount: -payment.amount }]
    });
    return;
  }

  markTurnReady(state, payment.payerId, events);
}

function endTurn(
  state: GameState,
  playerId: PlayerId,
  random: RandomProvider,
  content: TechnicalSliceContent
): CommandResult {
  if (state.pendingInteraction) throw new Error('仍有未处理的交互。');
  if (!state.turn.readyToEnd) throw new Error('当前回合尚未完成结算。');

  const nextState = structuredClone(state);
  const events: DomainEvent[] = [];
  const previousPlayerIndex = nextState.activePlayerIndex;
  const nextPlayerIndex = getNextActivePlayerIndex(nextState, previousPlayerIndex);
  if (nextPlayerIndex === null) throw new Error('没有可继续游戏的玩家。');
  nextState.activePlayerIndex = nextPlayerIndex;

  let completedRound: number | null = null;
  if (nextState.activePlayerIndex <= previousPlayerIndex) {
    completedRound = nextState.round;
    settleStocksForCompletedRound(nextState, completedRound, random, content, events);
    nextState.round += 1;
  }

  nextState.turn = createEmptyTurn();
  nextState.pendingInteraction = null;
  const nextPlayerId = getActivePlayer(nextState).id;
  events.push({
    type: 'TURN_ENDED',
    playerId,
    nextPlayerId,
    completedRound,
    nextRound: nextState.round
  });

  return { nextState, events };
}

function applyEvent(
  state: GameState,
  activePlayerId: PlayerId,
  kind: 'PERSONAL_INCOME' | 'PLAYER_TRANSFER',
  amount: number
): Array<{ playerId: PlayerId; amount: number }> {
  const activePlayer = state.players.find((player) => player.id === activePlayerId);
  if (!activePlayer) throw new Error('事件玩家不存在。');

  if (kind === 'PERSONAL_INCOME') {
    activePlayer.cash += amount;
    return [{ playerId: activePlayerId, amount }];
  }

  const otherPlayer = state.players.find(
    (player) => player.id !== activePlayerId && !player.bankrupt
  );
  if (!otherPlayer) return [];
  const transferable = Math.min(amount, otherPlayer.cash);
  otherPlayer.cash -= transferable;
  activePlayer.cash += transferable;
  return [
    { playerId: otherPlayer.id, amount: -transferable },
    { playerId: activePlayerId, amount: transferable }
  ];
}

function settleStocksForCompletedRound(
  state: GameState,
  completedRound: number,
  random: RandomProvider,
  content: TechnicalSliceContent,
  events: DomainEvent[]
): void {
  for (const player of state.players) {
    if (player.bankrupt) continue;
    const remainingHoldings: StockHolding[] = [];

    for (const holding of player.stocks) {
      if (holding.purchasedRound < completedRound) {
        holding.remainingRounds -= 1;
      }

      if (holding.remainingRounds > 0) {
        remainingHoldings.push(holding);
        continue;
      }

      const hiddenResult = random.nextInt(1, 20);
      const outcome = content.stockOutcomes.find(
        (candidate) => hiddenResult >= candidate.min && hiddenResult <= candidate.max
      );
      if (!outcome) throw new Error('股票结算区间配置不完整。');

      const multiplier = outcome.multipliers[String(holding.originalPeriod) as '2' | '4' | '6'];
      const payout = roundMoney(holding.principal * multiplier);
      player.cash += payout;
      events.push({
        type: 'STOCK_SETTLED',
        playerId: player.id,
        stockId: holding.stockId,
        holdingId: holding.holdingId,
        hiddenResult,
        outcomeLabel: outcome.label,
        principal: holding.principal,
        payout
      });
    }

    player.stocks = remainingHoldings;
  }
}

function markTurnReady(
  state: GameState,
  playerId: PlayerId,
  events: DomainEvent[]
): void {
  state.turn.readyToEnd = true;
  events.push({ type: 'TURN_READY_TO_END', playerId });
}

function createInstanceId(state: GameState, prefix: string): string {
  const id = `${prefix}-${state.nextInstanceSequence.toString().padStart(4, '0')}`;
  state.nextInstanceSequence += 1;
  return id;
}
