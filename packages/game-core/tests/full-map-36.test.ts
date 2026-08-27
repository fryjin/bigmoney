import { describe, expect, it } from 'vitest';
import { fullMap36Content } from '@bigmoney/game-content';
import { SequenceRandom } from '@bigmoney/game-random';
import * as gameCore from '../src/index';
import {
  createLocalGameState,
  type CommandResult,
  type GameState,
  type LocalPlayerCount
} from '../src/index';

const contentForEngine = fullMap36Content;

function createFullMapState(playerCount: LocalPlayerCount = 2): GameState {
  return createLocalGameState(fullMap36Content, playerCount);
}

function rollAndMove(state: GameState, value: number): CommandResult {
  const playerId = state.players[state.activePlayerIndex]!.id;
  const random = new SequenceRandom([value]);
  let current = gameCore.executeCommand(
    state,
    { type: 'ROLL_DICE', playerId },
    random,
    contentForEngine
  );
  const events = [...current.events];

  while (current.nextState.turn.remainingSteps > 0) {
    current = gameCore.executeCommand(
      current.nextState,
      { type: 'MOVE_ONE_STEP', playerId },
      random,
      contentForEngine
    );
    events.push(...current.events);
  }

  return { nextState: current.nextState, events };
}

function resolveCurrentDestination(state: GameState, random = new SequenceRandom([0])): CommandResult {
  const playerId = state.players[state.activePlayerIndex]!.id;
  return gameCore.executeCommand(
    state,
    { type: 'RESOLVE_DESTINATION', playerId },
    random,
    contentForEngine
  );
}

function landOn(state: GameState, random = new SequenceRandom([1])): CommandResult {
  return resolveCurrentDestination(rollAndMove(state, 1).nextState, random);
}

describe('full-map-36 Core factory', () => {
  it('creates 2, 3, and 4 player canonical full-map states', () => {
    for (const playerCount of [2, 3, 4] as const) {
      const state = createFullMapState(playerCount);

      expect(state.boardVersion).toBe('full-map-36-v1');
      expect(state.technicalSliceVersion).toBeUndefined();
      expect(state.players).toHaveLength(playerCount);
      expect(state.players.every((player) => player.cash === 500 && player.position === 0)).toBe(true);
      expect(Object.keys(state.properties)).toHaveLength(20);
      expect(Object.keys(state.properties).sort()).toEqual(fullMap36Content.properties.map((property) => property.id).sort());
    }
  });

  it('keeps the technical-slice factory as a compatibility path', () => {
    const legacyState = gameCore.createTechnicalSliceState();

    expect(legacyState.technicalSliceVersion).toBe('phase-1.1');
    expect(legacyState.boardVersion).toBe('technical-slice-phase-1.1');
    expect(legacyState.players).toHaveLength(2);
    expect(Object.keys(legacyState.properties)).toEqual(['A1', 'A2', 'A3']);
  });
});

describe('full-map-36 movement and destinations', () => {
  it('moves every D6 step through legal 0..35 positions without teleporting', () => {
    const state = createFullMapState();
    state.players[0]!.position = 33;

    const result = rollAndMove(state, 6);
    const movementEvents = result.events.filter((event) => event.type === 'PLAYER_MOVED');

    expect(movementEvents.map((event) => event.to)).toEqual([34, 35, 0, 1, 2, 3]);
    expect(movementEvents.every((event) => event.to >= 0 && event.to <= 35)).toBe(true);
    expect(result.nextState.players[0]!.position).toBe(3);
  });

  it('does not reward landing on FINISH', () => {
    const state = createFullMapState();
    state.players[0]!.position = 34;

    const result = rollAndMove(state, 1);

    expect(result.nextState.players[0]!.position).toBe(35);
    expect(result.nextState.players[0]!.cash).toBe(500);
    expect(result.events.some((event) => event.type === 'LAP_REWARD_GRANTED')).toBe(false);
  });

  it('grants exactly one lap reward only for 35 to 0', () => {
    const state = createFullMapState();
    state.players[0]!.position = 35;

    const result = rollAndMove(state, 1);

    expect(result.nextState.players[0]!.position).toBe(0);
    expect(result.nextState.players[0]!.cash).toBe(580);
    expect(result.events.filter((event) => event.type === 'LAP_REWARD_GRANTED')).toEqual([
      { type: 'LAP_REWARD_GRANTED', playerId: 'P1', amount: 80 }
    ]);
  });

  it('grants one lap reward for multi-step wraps', () => {
    for (const [position, roll] of [[34, 2], [33, 3]] as const) {
      const state = createFullMapState();
      state.players[0]!.position = position;

      const result = rollAndMove(state, roll);

      expect(result.nextState.players[0]!.position).toBe(0);
      expect(result.nextState.players[0]!.cash).toBe(580);
      expect(result.events.filter((event) => event.type === 'LAP_REWARD_GRANTED')).toHaveLength(1);
    }
  });

  it('treats every reserved tile as a cash-neutral ready-to-end no-op', () => {
    for (const reservedIndex of [9, 14, 18, 25, 27]) {
      const state = createFullMapState();
      state.players[0]!.position = reservedIndex - 1;

      const result = landOn(state);

      expect(result.nextState.players[0]!.position).toBe(reservedIndex);
      expect(result.nextState.players[0]!.cash).toBe(500);
      expect(result.nextState.pendingInteraction).toBeNull();
      expect(result.nextState.turn.readyToEnd).toBe(true);
      expect(result.events).toEqual([{ type: 'TURN_READY_TO_END', playerId: 'P1' }]);
    }
  });
});

describe('full-map-36 generic content behavior', () => {
  it('uses official low, middle, and high property definitions for purchase, upgrade, and rent', () => {
    const purchaseState = createFullMapState();
    const purchase = landOn(purchaseState);
    const purchased = gameCore.executeCommand(
      purchase.nextState,
      { type: 'BUY_PROPERTY', playerId: 'P1' },
      new SequenceRandom([1]),
      contentForEngine
    );

    expect(purchased.nextState.properties.HARBOR_01).toMatchObject({ ownerId: 'P1', level: 0 });
    expect(purchased.nextState.players[0]!.cash).toBe(450);

    const upgradeState = createFullMapState();
    upgradeState.players[0]!.position = 12;
    upgradeState.properties.METRO_03!.ownerId = 'P1';
    const upgrade = landOn(upgradeState);
    const upgraded = gameCore.executeCommand(
      upgrade.nextState,
      { type: 'UPGRADE_PROPERTY', playerId: 'P1' },
      new SequenceRandom([1]),
      contentForEngine
    );

    expect(upgraded.nextState.properties.METRO_03).toMatchObject({ ownerId: 'P1', level: 1 });
    expect(upgraded.nextState.players[0]!.cash).toBe(449);

    const rentState = createFullMapState();
    rentState.activePlayerIndex = 1;
    rentState.players[1]!.position = 33;
    rentState.properties.SKYLINE_05!.ownerId = 'P1';
    const rent = landOn(rentState);

    expect(rent.nextState.players.map((player) => player.cash)).toEqual([515, 485]);
    expect(rent.nextState.pendingInteraction).toBeNull();
    expect(rent.nextState.turn.readyToEnd).toBe(true);
  });

  it('keeps official properties eligible for liquidation', () => {
    const state = createFullMapState();
    state.properties.INNOVATION_05!.ownerId = 'P1';

    expect(gameCore.getLiquidationCandidates(state, 'P1', contentForEngine)).toContainEqual({
      propertyId: 'INNOVATION_05',
      purchasePrice: 120,
      liquidationValue: 60
    });
  });

  it('uses MARKET_01 from both stock entry tiles', () => {
    for (const stockIndex of [6, 23]) {
      const state = createFullMapState();
      state.players[0]!.position = stockIndex - 1;
      const playerId = state.players[0]!.id;
      const random = new SequenceRandom([1, 0, 0, 0]);
      const moved = gameCore.executeCommand(
        state,
        { type: 'ROLL_DICE', playerId },
        random,
        contentForEngine
      ).nextState;
      const offered = gameCore.executeCommand(
        moved,
        { type: 'MOVE_ONE_STEP', playerId },
        random,
        contentForEngine
      );

      expect(offered.nextState.pendingInteraction).toMatchObject({
        type: 'STOCK_MARKET',
        marketId: 'MARKET_01'
      });
      expect(offered.events).toContainEqual(expect.objectContaining({
        type: 'STOCK_MARKET_OFFERED',
        marketId: 'MARKET_01'
      }));
    }
  });

  it('settles full-map stock holdings on a completed round rather than a board lap', () => {
    const state = createFullMapState();
    state.players[0]!.stocks = [{
      holdingId: 'STOCK-0001',
      stockId: 'SKYLINE_TECH',
      principal: 50,
      originalPeriod: 2,
      remainingRounds: 1,
      purchasedRound: 0
    }];
    state.turn.readyToEnd = true;

    const firstTurn = gameCore.executeCommand(
      state,
      { type: 'END_TURN', playerId: 'P1' },
      new SequenceRandom([20]),
      contentForEngine
    );
    firstTurn.nextState.turn.readyToEnd = true;
    const completedRound = gameCore.executeCommand(
      firstTurn.nextState,
      { type: 'END_TURN', playerId: 'P2' },
      new SequenceRandom([20]),
      contentForEngine
    );

    expect(firstTurn.events.some((event) => event.type === 'STOCK_SETTLED')).toBe(false);
    expect(completedRound.events).toContainEqual(expect.objectContaining({
      type: 'STOCK_SETTLED',
      playerId: 'P1',
      stockId: 'SKYLINE_TECH'
    }));
    expect(completedRound.nextState.round).toBe(2);
  });

  it('uses the same card pool from all three card entries', () => {
    for (const cardIndex of [4, 16, 32]) {
      const state = createFullMapState();
      state.players[0]!.position = cardIndex - 1;

      const result = landOn(state, new SequenceRandom([0]));

      expect(result.nextState.pendingInteraction).toMatchObject({
        type: 'CARD_DRAW',
        card: { cardId: 'CARD_REROLL' }
      });
    }
  });

  it('uses the same event pool from all four event entries', () => {
    for (const eventIndex of [2, 11, 20, 30]) {
      const state = createFullMapState();
      state.players[0]!.position = eventIndex - 1;

      const result = landOn(state, new SequenceRandom([0]));

      expect(result.nextState.pendingInteraction).toMatchObject({
        type: 'EVENT_RESULT',
        eventId: 'EVENT_CITY_REWARD'
      });
      expect(result.nextState.players[0]!.cash).toBe(520);
    }
  });
});

describe('full-map-36 multiplayer compatibility', () => {
  it('keeps player order, active-player selection, and winner calculation generic', () => {
    const threePlayers = createFullMapState(3);
    const fourPlayers = createFullMapState(4);
    threePlayers.turn.readyToEnd = true;

    const handoff = gameCore.executeCommand(
      threePlayers,
      { type: 'END_TURN', playerId: 'P1' },
      new SequenceRandom([20]),
      contentForEngine
    );
    fourPlayers.players[1]!.bankrupt = true;
    fourPlayers.players[2]!.bankrupt = true;

    expect(handoff.nextState.players[handoff.nextState.activePlayerIndex]!.id).toBe('P2');
    expect(gameCore.getActivePlayers(fourPlayers).map((player) => player.id)).toEqual(['P1', 'P4']);
    expect(gameCore.getNextActivePlayerIndex(fourPlayers, 0)).toBe(3);

    fourPlayers.players[3]!.bankrupt = true;
    expect(gameCore.getWinnerId(fourPlayers)).toBe('P1');
  });
});
