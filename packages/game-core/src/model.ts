import type { TechnicalSliceContent } from '@bigmoney/game-content';

export type PlayerId = 'P1' | 'P2' | string;
export type PropertyId = string;
export type StockId = string;
export type CardId = string;
export type TileId = string;
export type Money = number;
export type GameStatus = 'IN_PROGRESS' | 'FINISHED';

interface ForcedPaymentBase {
  id: string;
  payerId: PlayerId;
  receiverId: PlayerId | null;
  amount: Money;
}

export type ForcedPayment =
  | (ForcedPaymentBase & {
      receiverId: PlayerId;
      reason: 'RENT';
      propertyId: PropertyId;
    })
  | (ForcedPaymentBase & {
      receiverId: null;
      reason: 'EVENT_EXPENSE';
      eventId: string;
      title: string;
      description: string;
    })
  | (ForcedPaymentBase & {
      receiverId: null;
      reason: 'PUBLIC_FEE';
    });

export interface LiquidationCandidate {
  propertyId: PropertyId;
  purchasePrice: Money;
  liquidationValue: Money;
}

export interface LiquidationQuote {
  paymentId: string;
  payerId: PlayerId;
  amountDue: Money;
  availableCash: Money;
  propertyIds: PropertyId[];
  liquidationValue: Money;
  cashAfterLiquidation: Money;
  remainingAmount: Money;
  canCompletePayment: boolean;
}

export interface CardInstance {
  instanceId: string;
  cardId: CardId;
}

export interface StockHolding {
  holdingId: string;
  stockId: StockId;
  principal: Money;
  originalPeriod: 2 | 4 | 6;
  remainingRounds: number;
  purchasedRound: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: string;
  cash: Money;
  position: number;
  bankrupt: boolean;
  cards: CardInstance[];
  stocks: StockHolding[];
}

export interface PropertyState {
  id: PropertyId;
  ownerId: PlayerId | null;
  level: 0 | 1 | 2 | 3;
}

export interface TurnState {
  rolledValue: number | null;
  remainingSteps: number;
  triggeredStockMarkets: string[];
  readyToEnd: boolean;
}

export interface StockMarketInteraction {
  type: 'STOCK_MARKET';
  playerId: PlayerId;
  tileId: TileId;
  marketId: string;
  offeredStockIds: StockId[];
}

export interface PropertyPurchaseInteraction {
  type: 'PROPERTY_PURCHASE';
  playerId: PlayerId;
  tileId: TileId;
  propertyId: PropertyId;
  price: Money;
}

export interface PropertyUpgradeInteraction {
  type: 'PROPERTY_UPGRADE';
  playerId: PlayerId;
  tileId: TileId;
  propertyId: PropertyId;
  currentLevel: 0 | 1 | 2;
  nextLevel: 1 | 2 | 3;
  cost: Money;
}

export interface EventResultInteraction {
  type: 'EVENT_RESULT';
  playerId: PlayerId;
  eventId: string;
  title: string;
  description: string;
}

export interface CardDrawInteraction {
  type: 'CARD_DRAW';
  playerId: PlayerId;
  card: CardInstance;
  title: string;
  description: string;
}

export interface CardReplacementInteraction {
  type: 'CARD_REPLACEMENT';
  playerId: PlayerId;
  candidateCards: CardInstance[];
  drawnCardInstanceId: string;
}

export interface LiquidationInteraction {
  type: 'LIQUIDATION';
  playerId: PlayerId;
  payment: ForcedPayment;
}

export type PendingInteraction =
  | StockMarketInteraction
  | PropertyPurchaseInteraction
  | PropertyUpgradeInteraction
  | EventResultInteraction
  | CardDrawInteraction
  | CardReplacementInteraction
  | LiquidationInteraction;

export interface GameState {
  ruleVersion: string;
  technicalSliceVersion: string;
  status: GameStatus;
  winnerId: PlayerId | null;
  round: number;
  activePlayerIndex: number;
  players: PlayerState[];
  properties: Record<PropertyId, PropertyState>;
  turn: TurnState;
  pendingInteraction: PendingInteraction | null;
  nextInstanceSequence: number;
}

export type GameCommand =
  | { type: 'ROLL_DICE'; playerId: PlayerId }
  | { type: 'MOVE_ONE_STEP'; playerId: PlayerId }
  | {
      type: 'RESOLVE_STOCK_MARKET';
      playerId: PlayerId;
      purchase:
        | {
            stockId: StockId;
            principal: Money;
            period: 2 | 4 | 6;
          }
        | null;
    }
  | { type: 'RESOLVE_DESTINATION'; playerId: PlayerId }
  | { type: 'BUY_PROPERTY'; playerId: PlayerId }
  | { type: 'SKIP_PROPERTY'; playerId: PlayerId }
  | { type: 'UPGRADE_PROPERTY'; playerId: PlayerId }
  | { type: 'SKIP_UPGRADE'; playerId: PlayerId }
  | { type: 'ACKNOWLEDGE_RESULT'; playerId: PlayerId }
  | { type: 'CHOOSE_CARD_TO_DISCARD'; playerId: PlayerId; cardInstanceId: string }
  | {
      type: 'CONFIRM_LIQUIDATION';
      playerId: PlayerId;
      paymentId: string;
      propertyIds: PropertyId[];
    }
  | { type: 'END_TURN'; playerId: PlayerId };

export type DomainEvent =
  | { type: 'DICE_ROLLED'; playerId: PlayerId; value: number }
  | { type: 'PLAYER_MOVED'; playerId: PlayerId; from: number; to: number }
  | { type: 'LAP_REWARD_GRANTED'; playerId: PlayerId; amount: Money }
  | {
      type: 'STOCK_MARKET_OFFERED';
      playerId: PlayerId;
      marketId: string;
      offeredStockIds: StockId[];
    }
  | { type: 'STOCK_MARKET_SKIPPED'; playerId: PlayerId; marketId: string }
  | {
      type: 'STOCK_PURCHASED';
      playerId: PlayerId;
      stockId: StockId;
      principal: Money;
      period: 2 | 4 | 6;
      holdingId: string;
    }
  | {
      type: 'STOCK_SETTLED';
      playerId: PlayerId;
      stockId: StockId;
      holdingId: string;
      hiddenResult: number;
      outcomeLabel: string;
      principal: Money;
      payout: Money;
    }
  | {
      type: 'PROPERTY_PURCHASE_REQUESTED';
      playerId: PlayerId;
      propertyId: PropertyId;
      price: Money;
    }
  | {
      type: 'PROPERTY_PURCHASED';
      playerId: PlayerId;
      propertyId: PropertyId;
      price: Money;
    }
  | { type: 'PROPERTY_PURCHASE_SKIPPED'; playerId: PlayerId; propertyId: PropertyId }
  | {
      type: 'PROPERTY_UPGRADE_REQUESTED';
      playerId: PlayerId;
      propertyId: PropertyId;
      nextLevel: 1 | 2 | 3;
      cost: Money;
    }
  | {
      type: 'PROPERTY_UPGRADED';
      playerId: PlayerId;
      propertyId: PropertyId;
      level: 1 | 2 | 3;
      cost: Money;
    }
  | { type: 'PROPERTY_UPGRADE_SKIPPED'; playerId: PlayerId; propertyId: PropertyId }
  | {
      type: 'RENT_PAID';
      payerId: PlayerId;
      ownerId: PlayerId;
      propertyId: PropertyId;
      amount: Money;
    }
  | { type: 'PAYMENT_REQUESTED'; payment: ForcedPayment }
  | { type: 'PAYMENT_COMPLETED'; payment: ForcedPayment }
  | {
      type: 'LIQUIDATION_REQUIRED';
      payment: ForcedPayment;
      remainingAmount: Money;
    }
  | {
      type: 'PROPERTY_LIQUIDATED';
      playerId: PlayerId;
      propertyId: PropertyId;
      value: Money;
    }
  | {
      type: 'PLAYER_BANKRUPT';
      playerId: PlayerId;
      paymentId: string;
      receiverId: PlayerId | null;
      paidAmount: Money;
      writtenOffAmount: Money;
    }
  | { type: 'GAME_FINISHED'; winnerId: PlayerId }
  | {
      type: 'EVENT_RESOLVED';
      eventId: string;
      playerId: PlayerId;
      title: string;
      description: string;
      changes: Array<{ playerId: PlayerId; amount: Money }>;
    }
  | {
      type: 'CARD_DRAWN';
      playerId: PlayerId;
      card: CardInstance;
      cardId: CardId;
      title: string;
      description: string;
    }
  | {
      type: 'CARD_REPLACEMENT_REQUIRED';
      playerId: PlayerId;
      candidateCards: CardInstance[];
      drawnCardInstanceId: string;
    }
  | {
      type: 'CARD_DISCARDED_AFTER_DRAW';
      playerId: PlayerId;
      discardedCardInstanceId: string;
    }
  | { type: 'TURN_READY_TO_END'; playerId: PlayerId }
  | {
      type: 'TURN_ENDED';
      playerId: PlayerId;
      nextPlayerId: PlayerId;
      completedRound: number | null;
      nextRound: number;
    };

export interface CommandResult {
  nextState: GameState;
  events: DomainEvent[];
}

export interface EngineOptions {
  content?: TechnicalSliceContent;
}
