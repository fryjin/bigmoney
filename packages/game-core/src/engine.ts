import {
  technicalSliceContent,
  type TechnicalSliceContent
} from '@bigmoney/game-content';
import {
  pickOne,
  pickUnique,
  type RandomProvider
} from '@bigmoney/game-random';
import { getRent, getUpgradeCost, roundMoney } from './money';
import type {
  CardInstance,
  CommandResult,
  DomainEvent,
  GameCommand,
  GameState,
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
  const activePlayer = getActivePlayer(state);
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
      if (player.cash < rent) {
        throw new Error('技术切片暂未进入资产清算模块；本次租金超出玩家现金。');
      }
      player.cash -= rent;
      owner.cash += rent;
      events.push({
        type: 'RENT_PAID',
        payerId: playerId,
        ownerId: owner.id,
        propertyId: property.id,
        amount: rent
      });
    }
  }

  if (tile.type === 'EVENT') {
    const eventDefinition = pickOne(content.events, random);
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
  nextState.activePlayerIndex = (nextState.activePlayerIndex + 1) % nextState.players.length;

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
  kind: 'PERSONAL_INCOME' | 'PERSONAL_EXPENSE' | 'PLAYER_TRANSFER',
  amount: number
): Array<{ playerId: PlayerId; amount: number }> {
  const activePlayer = state.players.find((player) => player.id === activePlayerId);
  if (!activePlayer) throw new Error('事件玩家不存在。');

  if (kind === 'PERSONAL_INCOME') {
    activePlayer.cash += amount;
    return [{ playerId: activePlayerId, amount }];
  }

  if (kind === 'PERSONAL_EXPENSE') {
    if (activePlayer.cash < amount) {
      throw new Error('技术切片暂未进入资产清算模块；本次事件费用超出玩家现金。');
    }
    activePlayer.cash -= amount;
    return [{ playerId: activePlayerId, amount: -amount }];
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
