import { fullMap36Content, type GameContent } from '@bigmoney/game-content';
import {
  createLocalGameState,
  type GameState,
  type LocalPlayerCount
} from '@bigmoney/game-core';
import type { RandomSnapshot } from '@bigmoney/game-random';
import type { StableFlowPhase } from '@bigmoney/game-flow';

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
  | 'four-player-presentation'
  | 'finish-no-lap'
  | 'lap-wrap'
  | 'multi-step-wrap'
  | 'reserved-jail'
  | 'reserved-facility-01'
  | 'reserved-project'
  | 'reserved-facility-02'
  | 'reserved-minigame'
  | 'property-purchase'
  | 'property-upgrade'
  | 'property-rent'
  | 'stock-entry-01'
  | 'stock-entry-02'
  | 'card-entry-01'
  | 'card-entry-02'
  | 'card-entry-03'
  | 'event-entry-01'
  | 'event-entry-02'
  | 'event-entry-03'
  | 'event-entry-04';

export interface BrowserTestFixture {
  name: BrowserTestFixtureName;
  content: GameContent;
  game: GameState;
  random: RandomSnapshot;
  flow: StableFlowPhase;
}

const BROWSER_TEST_MODE = 'browser-test';
const FIXTURE_RANDOM: RandomSnapshot = {
  algorithm: 'xorshift32',
  state: 1
};
const MULTI_STEP_RANDOM: RandomSnapshot = {
  algorithm: 'xorshift32',
  state: 2688
};
const PLAYER_TRANSFER_RANDOM: RandomSnapshot = {
  algorithm: 'xorshift32',
  state: 32
};

const FIXTURE_NAMES: readonly BrowserTestFixtureName[] = [
  'solvent-rent',
  'partial-liquidation',
  'three-player-bankruptcy-handoff',
  'two-player-bankruptcy-finished',
  'four-player-skip-p2',
  'four-player-skip-p2-p3',
  'four-player-partial-liquidation',
  'three-player-finished-p3',
  'four-player-finished-p3',
  'four-player-player-transfer',
  'four-player-presentation',
  'finish-no-lap',
  'lap-wrap',
  'multi-step-wrap',
  'reserved-jail',
  'reserved-facility-01',
  'reserved-project',
  'reserved-facility-02',
  'reserved-minigame',
  'property-purchase',
  'property-upgrade',
  'property-rent',
  'stock-entry-01',
  'stock-entry-02',
  'card-entry-01',
  'card-entry-02',
  'card-entry-03',
  'event-entry-01',
  'event-entry-02',
  'event-entry-03',
  'event-entry-04'
];

export function getBrowserTestFixture(
  mode: string,
  fixtureName: string | null
): BrowserTestFixture | null {
  if (mode !== BROWSER_TEST_MODE || !isFixtureName(fixtureName)) return null;

  switch (fixtureName) {
    case 'solvent-rent':
      return createRentFixture(fixtureName, 2, 100, []);
    case 'partial-liquidation':
      return createRentFixture(fixtureName, 2, 15, ['HARBOR_03', 'HARBOR_05']);
    case 'three-player-bankruptcy-handoff':
      return createRentFixture(fixtureName, 3, 10, ['HARBOR_03']);
    case 'two-player-bankruptcy-finished':
      return createRentFixture(fixtureName, 2, 10, ['HARBOR_03']);
    case 'four-player-partial-liquidation':
      return createRentFixture(fixtureName, 4, 15, ['HARBOR_03', 'HARBOR_05']);
    case 'four-player-skip-p2':
      return createBankruptcySkipFixture(fixtureName, false);
    case 'four-player-skip-p2-p3':
      return createBankruptcySkipFixture(fixtureName, true);
    case 'three-player-finished-p3':
      return createFinishedFixture(fixtureName, 3);
    case 'four-player-finished-p3':
      return createFinishedFixture(fixtureName, 4);
    case 'four-player-player-transfer':
      return createPlayerTransferFixture();
    case 'four-player-presentation':
      return createPresentationFixture();
    case 'finish-no-lap':
      return createPositionFixture(fixtureName, 34);
    case 'lap-wrap':
      return createPositionFixture(fixtureName, 35);
    case 'multi-step-wrap':
      return createPositionFixture(fixtureName, 34, MULTI_STEP_RANDOM);
    case 'reserved-jail':
      return createPositionFixture(fixtureName, 8);
    case 'reserved-facility-01':
      return createPositionFixture(fixtureName, 13);
    case 'reserved-project':
      return createPositionFixture(fixtureName, 17);
    case 'reserved-facility-02':
      return createPositionFixture(fixtureName, 24);
    case 'reserved-minigame':
      return createPositionFixture(fixtureName, 26);
    case 'property-purchase':
      return createPositionFixture(fixtureName, 0);
    case 'property-upgrade':
      return createPropertyUpgradeFixture();
    case 'property-rent':
      return createPropertyRentFixture();
    case 'stock-entry-01':
      return createPositionFixture(fixtureName, 5);
    case 'stock-entry-02':
      return createPositionFixture(fixtureName, 22);
    case 'card-entry-01':
      return createPositionFixture(fixtureName, 3);
    case 'card-entry-02':
      return createPositionFixture(fixtureName, 15);
    case 'card-entry-03':
      return createPositionFixture(fixtureName, 31);
    case 'event-entry-01':
      return createPositionFixture(fixtureName, 1);
    case 'event-entry-02':
      return createPositionFixture(fixtureName, 10);
    case 'event-entry-03':
      return createPositionFixture(fixtureName, 19);
    case 'event-entry-04':
      return createPositionFixture(fixtureName, 29);
  }
}

export function getBrowserTestFixtureForInitialLoad(
  initialLoad: { status: 'empty' | 'ready' | 'recovered' },
  mode: string,
  fixtureName: string | null
): BrowserTestFixture | null {
  if (initialLoad.status === 'ready') return null;
  return getBrowserTestFixture(mode, fixtureName);
}

function isFixtureName(value: string | null): value is BrowserTestFixtureName {
  return value !== null && FIXTURE_NAMES.includes(value as BrowserTestFixtureName);
}

function createRentFixture(
  name: BrowserTestFixtureName,
  playerCount: LocalPlayerCount,
  payerCash: number,
  payerPropertyIds: readonly string[]
): BrowserTestFixture {
  return createFixture(name, playerCount, (game) => {
    const payer = game.players[1]!;
    game.activePlayerIndex = 1;
    payer.position = 0;
    payer.cash = payerCash;
    game.properties.HARBOR_01!.ownerId = 'P1';
    game.properties.HARBOR_01!.level = 3;

    for (const propertyId of payerPropertyIds) {
      game.properties[propertyId]!.ownerId = payer.id;
    }
  });
}

function createBankruptcySkipFixture(
  name: 'four-player-skip-p2' | 'four-player-skip-p2-p3',
  skipsP3: boolean
): BrowserTestFixture {
  return createFixture(name, 4, (game) => {
    game.players[1]!.bankrupt = true;
    game.players[1]!.cash = 0;
    if (skipsP3) {
      game.players[2]!.bankrupt = true;
      game.players[2]!.cash = 0;
    }
  });
}

function createFinishedFixture(
  name: 'three-player-finished-p3' | 'four-player-finished-p3',
  playerCount: 3 | 4
): BrowserTestFixture {
  return createFixture(name, playerCount, (game) => {
    game.players[0]!.cash = 10;
    game.players[1]!.bankrupt = true;
    game.players[1]!.cash = 0;
    if (playerCount === 4) {
      game.players[3]!.bankrupt = true;
      game.players[3]!.cash = 0;
    }
    game.properties.HARBOR_01!.ownerId = 'P3';
    game.properties.HARBOR_01!.level = 3;
  });
}

function createPlayerTransferFixture(): BrowserTestFixture {
  return createFixture('four-player-player-transfer', 4, (game) => {
    game.activePlayerIndex = 1;
    game.players[1]!.position = 1;
    game.players[2]!.bankrupt = true;
    game.players[2]!.cash = 0;
    game.players[3]!.cash = 10;
  }, PLAYER_TRANSFER_RANDOM);
}

function createPresentationFixture(): BrowserTestFixture {
  return createFixture('four-player-presentation', 4, (game) => {
    game.players[1]!.bankrupt = true;
    game.players[1]!.cash = 0;
    game.players[2]!.position = 3;
    game.players[3]!.position = 3;
    game.properties.HARBOR_01!.ownerId = 'P3';
    game.properties.HARBOR_01!.level = 1;
    game.properties.METRO_03!.ownerId = 'P4';
    game.properties.METRO_03!.level = 3;
  });
}

function createPositionFixture(
  name: Exclude<
    BrowserTestFixtureName,
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
    | 'four-player-presentation'
    | 'property-upgrade'
    | 'property-rent'
  >,
  position: number,
  random: RandomSnapshot = FIXTURE_RANDOM
): BrowserTestFixture {
  return createFixture(name, 2, (game) => {
    game.players[0]!.position = position;
  }, random);
}

function createPropertyUpgradeFixture(): BrowserTestFixture {
  return createFixture('property-upgrade', 2, (game) => {
    game.players[0]!.position = 12;
    game.properties.METRO_03!.ownerId = 'P1';
  });
}

function createPropertyRentFixture(): BrowserTestFixture {
  return createFixture('property-rent', 2, (game) => {
    game.activePlayerIndex = 1;
    game.players[1]!.position = 33;
    game.properties.SKYLINE_05!.ownerId = 'P1';
    game.properties.SKYLINE_05!.level = 2;
  });
}

function createFixture(
  name: BrowserTestFixtureName,
  playerCount: LocalPlayerCount,
  configure: (game: GameState) => void,
  random: RandomSnapshot = FIXTURE_RANDOM
): BrowserTestFixture {
  const game = createLocalGameState(fullMap36Content, playerCount);
  configure(game);
  return {
    name,
    content: fullMap36Content,
    game,
    random: { ...random },
    flow: 'turnReady'
  };
}
