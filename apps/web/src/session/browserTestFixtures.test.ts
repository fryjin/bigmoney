import { describe, expect, it } from 'vitest';
import {
  getBrowserTestFixture,
  getBrowserTestFixtureForInitialLoad,
  type BrowserTestFixtureName
} from './browserTestFixtures';
import type { TechnicalSliceLoadResult } from './persistence';

describe('browser test fixtures', () => {
  const fixtureNames: BrowserTestFixtureName[] = [
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
    'four-player-presentation'
  ];

  it('only resolves a fixed fixture name in browser-test mode', () => {
    expect(getBrowserTestFixture('development', 'solvent-rent')).toBeNull();
    expect(getBrowserTestFixture('browser-test', 'cash=1')).toBeNull();
    expect(getBrowserTestFixture('browser-test', 'unknown')).toBeNull();

    for (const fixtureName of fixtureNames) {
      expect(getBrowserTestFixture('browser-test', fixtureName)?.name).toBe(fixtureName);
    }
  });

  it('creates a fresh canonical game state for the three-player bankruptcy handoff', () => {
    const first = getBrowserTestFixture(
      'browser-test',
      'three-player-bankruptcy-handoff'
    );
    const second = getBrowserTestFixture(
      'browser-test',
      'three-player-bankruptcy-handoff'
    );

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    expect(first?.flow).toBe('turnReady');
    expect(first?.random).toEqual({ algorithm: 'xorshift32', state: 1 });
    expect(first?.game.players.map((player) => player.id)).toEqual(['P1', 'P2', 'P3']);
    expect(first?.game.players.every((player) => !player.bankrupt)).toBe(true);
    expect(first?.game.activePlayerIndex).toBe(1);
    expect(first?.game.players[1]).toMatchObject({ cash: 10, position: 0 });
    expect(first?.game.properties).toMatchObject({
      A1: { ownerId: 'P1', level: 3 },
      A2: { ownerId: 'P2', level: 0 }
    });
  });

  it('creates each multiplayer fixture from the canonical Core roster', () => {
    const expectedPlayerIds = {
      'four-player-skip-p2': ['P1', 'P2', 'P3', 'P4'],
      'four-player-skip-p2-p3': ['P1', 'P2', 'P3', 'P4'],
      'four-player-partial-liquidation': ['P1', 'P2', 'P3', 'P4'],
      'three-player-finished-p3': ['P1', 'P2', 'P3'],
      'four-player-finished-p3': ['P1', 'P2', 'P3', 'P4'],
      'four-player-player-transfer': ['P1', 'P2', 'P3', 'P4'],
      'four-player-presentation': ['P1', 'P2', 'P3', 'P4']
    } as const;

    for (const [fixtureName, playerIds] of Object.entries(expectedPlayerIds)) {
      const fixture = getBrowserTestFixture(
        'browser-test',
        fixtureName as BrowserTestFixtureName
      );

      expect(fixture?.game.players.map((player) => player.id)).toEqual(playerIds);
      expect(fixture?.game.players.map((player) => player.name)).toEqual(
        playerIds.map((playerId) => ({
          P1: '玩家一',
          P2: '玩家二',
          P3: '玩家三',
          P4: '玩家四'
        })[playerId])
      );
    }
  });

  it('does not select a fixture when Persistence already restored a valid save', () => {
    const fixture = getBrowserTestFixture('browser-test', 'solvent-rent')!;
    const initialLoad: TechnicalSliceLoadResult = {
      status: 'ready',
      save: {
        schemaVersion: 3,
        game: fixture.game,
        random: fixture.random,
        flow: fixture.flow,
        handoffFromPlayerId: null,
        savedAt: '2026-08-12T00:00:00.000Z',
        integrity: 'fnv1a32:test'
      },
      message: null,
      migrated: false
    };

    expect(
      getBrowserTestFixtureForInitialLoad(
        initialLoad,
        'browser-test',
        'three-player-bankruptcy-handoff'
      )
    ).toBeNull();
  });
});
