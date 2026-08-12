import {
  createTechnicalSliceState,
  type GameState,
  type PlayerState
} from '@bigmoney/game-core';
import type { RandomSnapshot } from '@bigmoney/game-random';
import type { StableFlowPhase } from '@bigmoney/game-flow';
import type { TechnicalSliceLoadResult } from './persistence';

export type BrowserTestFixtureName =
  | 'solvent-rent'
  | 'partial-liquidation'
  | 'three-player-bankruptcy-handoff'
  | 'two-player-bankruptcy-finished';

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
      return createFixture(fixtureName, 100, []);
    case 'partial-liquidation':
      return createFixture(fixtureName, 15, ['A2', 'A3']);
    case 'three-player-bankruptcy-handoff':
      return createFixture(fixtureName, 10, ['A2'], true);
    case 'two-player-bankruptcy-finished':
      return createFixture(fixtureName, 10, ['A2']);
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
    value === 'two-player-bankruptcy-finished'
  );
}

function createFixture(
  name: BrowserTestFixtureName,
  payerCash: number,
  payerPropertyIds: readonly string[],
  includesThirdPlayer = false
): BrowserTestFixture {
  const game = createTechnicalSliceState();
  const payer = game.players[1]!;

  game.activePlayerIndex = 1;
  payer.position = 0;
  payer.cash = payerCash;
  game.properties.A1!.ownerId = 'P1';
  game.properties.A1!.level = 3;

  for (const propertyId of payerPropertyIds) {
    game.properties[propertyId]!.ownerId = payer.id;
  }

  if (includesThirdPlayer) {
    game.players.push(createThirdPlayer(game.players[0]!));
  }

  return {
    name,
    game,
    random: { ...FIXTURE_RANDOM },
    flow: 'turnReady'
  };
}

function createThirdPlayer(template: PlayerState): PlayerState {
  return {
    ...structuredClone(template),
    id: 'P3',
    name: '玩家三',
    color: '#7E68B8',
    cash: 500,
    position: 0,
    bankrupt: false,
    cards: [],
    stocks: []
  };
}
