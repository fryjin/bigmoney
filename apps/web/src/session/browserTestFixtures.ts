import {
  createTechnicalSliceState,
  type GameState
} from '@bigmoney/game-core';
import type { RandomSnapshot } from '@bigmoney/game-random';
import type { StableFlowPhase } from '@bigmoney/game-flow';
import type { TechnicalSliceLoadResult } from './persistence';

export type BrowserTestFixtureName =
  | 'solvent-rent'
  | 'partial-liquidation'
  | 'three-player-bankruptcy-handoff'
  | 'two-player-bankruptcy-finished'
  | 'four-player-skip-p2'
  | 'four-player-skip-p2-p3'
  | 'four-player-partial-liquidation'
  | 'three-player-finished-p3'
  | 'four-player-finished-p3'
  | 'four-player-player-transfer'
  | 'four-player-presentation';

export interface BrowserTestFixture {
  name: BrowserTestFixtureName;
  game: GameState;
  random: RandomSnapshot;
  flow: StableFlowPhase;
}

const BROWSER_TEST_MODE = 'browser-test';
const FIXTURE_RANDOM: RandomSnapshot = {
  algorithm: 'xorshift32',
  state: 1
};

export function getBrowserTestFixture(
  mode: string,
  fixtureName: string | null
): BrowserTestFixture | null {
  if (mode !== BROWSER_TEST_MODE || !isFixtureName(fixtureName)) return null;

  switch (fixtureName) {
    case 'solvent-rent':
      return createRentFixture(fixtureName, 2, 100, []);
    case 'partial-liquidation':
      return createRentFixture(fixtureName, 2, 15, ['A2', 'A3']);
    case 'three-player-bankruptcy-handoff':
      return createRentFixture(fixtureName, 3, 10, ['A2']);
    case 'two-player-bankruptcy-finished':
      return createRentFixture(fixtureName, 2, 10, ['A2']);
    case 'four-player-skip-p2':
      return createBankruptcySkipFixture(fixtureName, false);
    case 'four-player-skip-p2-p3':
      return createBankruptcySkipFixture(fixtureName, true);
    case 'four-player-partial-liquidation':
      return createRentFixture(fixtureName, 4, 15, ['A2', 'A3']);
    case 'three-player-finished-p3':
      return createFinishedFixture(fixtureName, 3);
    case 'four-player-finished-p3':
      return createFinishedFixture(fixtureName, 4);
    case 'four-player-player-transfer':
      return createPlayerTransferFixture();
    case 'four-player-presentation':
      return createPresentationFixture();
  }
}

export function getBrowserTestFixtureForInitialLoad(
  initialLoad: TechnicalSliceLoadResult,
  mode: string,
  fixtureName: string | null
): BrowserTestFixture | null {
  if (initialLoad.status === 'ready') return null;
  return getBrowserTestFixture(mode, fixtureName);
}

function isFixtureName(value: string | null): value is BrowserTestFixtureName {
  return (
    value === 'solvent-rent' ||
    value === 'partial-liquidation' ||
    value === 'three-player-bankruptcy-handoff' ||
    value === 'two-player-bankruptcy-finished' ||
    value === 'four-player-skip-p2' ||
    value === 'four-player-skip-p2-p3' ||
    value === 'four-player-partial-liquidation' ||
    value === 'three-player-finished-p3' ||
    value === 'four-player-finished-p3' ||
    value === 'four-player-player-transfer' ||
    value === 'four-player-presentation'
  );
}

function createRentFixture(
  name: BrowserTestFixtureName,
  playerCount: 2 | 3 | 4,
  payerCash: number,
  payerPropertyIds: readonly string[]
): BrowserTestFixture {
  const game = createTechnicalSliceState(playerCount);
  const payer = game.players[1]!;

  game.activePlayerIndex = 1;
  payer.position = 0;
  payer.cash = payerCash;
  game.properties.A1!.ownerId = 'P1';
  game.properties.A1!.level = 3;

  for (const propertyId of payerPropertyIds) {
    game.properties[propertyId]!.ownerId = payer.id;
  }

  return {
    name,
    game,
    random: { ...FIXTURE_RANDOM },
    flow: 'turnReady'
  };
}

function createBankruptcySkipFixture(
  name: 'four-player-skip-p2' | 'four-player-skip-p2-p3',
  skipsP3: boolean
): BrowserTestFixture {
  const game = createTechnicalSliceState(4);
  game.players[1]!.bankrupt = true;
  game.players[1]!.cash = 0;
  if (skipsP3) {
    game.players[2]!.bankrupt = true;
    game.players[2]!.cash = 0;
  }

  return createFixture(name, game, FIXTURE_RANDOM);
}

function createFinishedFixture(
  name: 'three-player-finished-p3' | 'four-player-finished-p3',
  playerCount: 3 | 4
): BrowserTestFixture {
  const game = createTechnicalSliceState(playerCount);
  const payer = game.players[0]!;
  payer.cash = 10;
  game.players[1]!.bankrupt = true;
  game.players[1]!.cash = 0;
  if (playerCount === 4) {
    game.players[3]!.bankrupt = true;
    game.players[3]!.cash = 0;
  }
  game.properties.A1!.ownerId = 'P3';
  game.properties.A1!.level = 3;

  return createFixture(name, game, FIXTURE_RANDOM);
}

function createPlayerTransferFixture(): BrowserTestFixture {
  const game = createTechnicalSliceState(4);
  game.activePlayerIndex = 1;
  game.players[1]!.position = 1;
  game.players[2]!.bankrupt = true;
  game.players[2]!.cash = 0;
  game.players[3]!.cash = 10;

  return createFixture('four-player-player-transfer', game, {
    algorithm: 'xorshift32',
    state: 32
  });
}

function createPresentationFixture(): BrowserTestFixture {
  const game = createTechnicalSliceState(4);
  game.players[1]!.bankrupt = true;
  game.players[1]!.cash = 0;
  game.players[2]!.position = 3;
  game.players[3]!.position = 3;
  game.properties.A1!.ownerId = 'P3';
  game.properties.A2!.ownerId = 'P4';

  return createFixture('four-player-presentation', game, FIXTURE_RANDOM);
}

function createFixture(
  name: BrowserTestFixtureName,
  game: GameState,
  random: RandomSnapshot
): BrowserTestFixture {
  return {
    name,
    game,
    random: { ...random },
    flow: 'turnReady'
  };
}
