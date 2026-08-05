import type { RandomProvider } from '@town-board/game-random';

export type PlayerId = string;
export type TileId = string;

export interface PlayerState {
  id: PlayerId;
  name: string;
  cash: number;
  position: number;
  bankrupt: boolean;
}

export interface TileDefinition {
  id: TileId;
  type: 'START' | 'PROPERTY' | 'EVENT' | 'STOCK' | 'CARD' | 'FINISH';
  propertyId?: string;
  price?: number;
}

export interface PendingPropertyDecision {
  playerId: PlayerId;
  tileId: TileId;
  propertyId: string;
  price: number;
}

export interface GameState {
  ruleVersion: string;
  round: number;
  activePlayerIndex: number;
  players: PlayerState[];
  map: TileDefinition[];
  propertyOwners: Record<string, PlayerId | null>;
  pendingPropertyDecision: PendingPropertyDecision | null;
  phase: 'AWAITING_ROLL' | 'AWAITING_PROPERTY' | 'TURN_END' | 'FINISHED';
}

export type GameCommand =
  | { type: 'ROLL_DICE'; playerId: PlayerId }
  | { type: 'BUY_PROPERTY'; playerId: PlayerId }
  | { type: 'SKIP_PROPERTY'; playerId: PlayerId }
  | { type: 'END_TURN'; playerId: PlayerId };

export type DomainEvent =
  | { type: 'DICE_ROLLED'; playerId: PlayerId; value: number }
  | { type: 'PLAYER_MOVED'; playerId: PlayerId; from: number; to: number }
  | { type: 'LAP_REWARD_GRANTED'; playerId: PlayerId; amount: number }
  | { type: 'PROPERTY_DECISION_REQUESTED'; decision: PendingPropertyDecision }
  | { type: 'PROPERTY_PURCHASED'; playerId: PlayerId; propertyId: string; price: number }
  | { type: 'PROPERTY_SKIPPED'; playerId: PlayerId; propertyId: string }
  | { type: 'TURN_READY_TO_END'; playerId: PlayerId }
  | { type: 'TURN_ENDED'; playerId: PlayerId; nextPlayerId: PlayerId };

export interface CommandResult {
  nextState: GameState;
  events: DomainEvent[];
}

export function createTechnicalSliceState(): GameState {
  const map: TileDefinition[] = [
    { id: 'START', type: 'START' },
    { id: 'PROPERTY_A1', type: 'PROPERTY', propertyId: 'A1', price: 50 },
    { id: 'EVENT_01', type: 'EVENT' },
    { id: 'PROPERTY_A2', type: 'PROPERTY', propertyId: 'A2', price: 55 },
    { id: 'STOCK_01', type: 'STOCK' },
    { id: 'PROPERTY_A3', type: 'PROPERTY', propertyId: 'A3', price: 60 },
    { id: 'CARD_01', type: 'CARD' },
    { id: 'FINISH', type: 'FINISH' }
  ];

  return {
    ruleVersion: 'mvp-2026-08-05',
    round: 1,
    activePlayerIndex: 0,
    players: [
      { id: 'P1', name: '玩家一', cash: 500, position: 0, bankrupt: false },
      { id: 'P2', name: '玩家二', cash: 500, position: 0, bankrupt: false }
    ],
    map,
    propertyOwners: { A1: null, A2: null, A3: null },
    pendingPropertyDecision: null,
    phase: 'AWAITING_ROLL'
  };
}

export function handleCommand(
  state: GameState,
  command: GameCommand,
  random: RandomProvider
): CommandResult {
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer || activePlayer.id !== command.playerId) {
    throw new Error('Command rejected: player is not active.');
  }

  switch (command.type) {
    case 'ROLL_DICE':
      return rollDice(state, activePlayer.id, random);
    case 'BUY_PROPERTY':
      return buyProperty(state, activePlayer.id);
    case 'SKIP_PROPERTY':
      return skipProperty(state, activePlayer.id);
    case 'END_TURN':
      return endTurn(state, activePlayer.id);
  }
}

function rollDice(state: GameState, playerId: PlayerId, random: RandomProvider): CommandResult {
  if (state.phase !== 'AWAITING_ROLL') throw new Error('Roll is not allowed now.');

  const dice = random.nextInt(1, 6);
  const events: DomainEvent[] = [{ type: 'DICE_ROLLED', playerId, value: dice }];
  const nextState = structuredClone(state);
  const player = nextState.players[nextState.activePlayerIndex];

  for (let step = 0; step < dice; step += 1) {
    const from = player.position;
    const to = (from + 1) % nextState.map.length;
    player.position = to;
    events.push({ type: 'PLAYER_MOVED', playerId, from, to });
    if (nextState.map[to]?.type === 'FINISH') {
      player.cash += 80;
      events.push({ type: 'LAP_REWARD_GRANTED', playerId, amount: 80 });
    }
  }

  const tile = nextState.map[player.position];
  if (tile?.type === 'PROPERTY' && tile.propertyId && tile.price !== undefined) {
    const owner = nextState.propertyOwners[tile.propertyId];
    if (owner === null) {
      const decision = { playerId, tileId: tile.id, propertyId: tile.propertyId, price: tile.price };
      nextState.pendingPropertyDecision = decision;
      nextState.phase = 'AWAITING_PROPERTY';
      events.push({ type: 'PROPERTY_DECISION_REQUESTED', decision });
      return { nextState, events };
    }
  }

  nextState.phase = 'TURN_END';
  events.push({ type: 'TURN_READY_TO_END', playerId });
  return { nextState, events };
}

function buyProperty(state: GameState, playerId: PlayerId): CommandResult {
  const decision = state.pendingPropertyDecision;
  if (state.phase !== 'AWAITING_PROPERTY' || !decision || decision.playerId !== playerId) {
    throw new Error('No property decision is pending.');
  }

  const nextState = structuredClone(state);
  const player = nextState.players[nextState.activePlayerIndex];
  if (player.cash < decision.price) throw new Error('Insufficient cash.');

  player.cash -= decision.price;
  nextState.propertyOwners[decision.propertyId] = playerId;
  nextState.pendingPropertyDecision = null;
  nextState.phase = 'TURN_END';
  return {
    nextState,
    events: [
      { type: 'PROPERTY_PURCHASED', playerId, propertyId: decision.propertyId, price: decision.price },
      { type: 'TURN_READY_TO_END', playerId }
    ]
  };
}

function skipProperty(state: GameState, playerId: PlayerId): CommandResult {
  const decision = state.pendingPropertyDecision;
  if (state.phase !== 'AWAITING_PROPERTY' || !decision || decision.playerId !== playerId) {
    throw new Error('No property decision is pending.');
  }

  const nextState = structuredClone(state);
  nextState.pendingPropertyDecision = null;
  nextState.phase = 'TURN_END';
  return {
    nextState,
    events: [
      { type: 'PROPERTY_SKIPPED', playerId, propertyId: decision.propertyId },
      { type: 'TURN_READY_TO_END', playerId }
    ]
  };
}

function endTurn(state: GameState, playerId: PlayerId): CommandResult {
  if (state.phase !== 'TURN_END') throw new Error('Turn cannot end now.');

  const nextState = structuredClone(state);
  nextState.activePlayerIndex = (nextState.activePlayerIndex + 1) % nextState.players.length;
  if (nextState.activePlayerIndex === 0) nextState.round += 1;
  nextState.phase = 'AWAITING_ROLL';
  const nextPlayerId = nextState.players[nextState.activePlayerIndex]!.id;
  return { nextState, events: [{ type: 'TURN_ENDED', playerId, nextPlayerId }] };
}
