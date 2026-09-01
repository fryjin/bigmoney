import { describe, expect, it } from 'vitest';
import {
  getBrowserTestFixture,
  getBrowserTestFixtureForInitialLoad,
  type BrowserTestFixtureName
} from './browserTestFixtures';
import type { LocalGameLoadResult } from './persistence';

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
    'four-player-presentation',
    'finish-no-lap',
    'lap-wrap',
    'multi-step-wrap',
    'reserved-jail',
    'reserved-project',
    'reserved-minigame',
    'facility-direct-14',
    'facility-direct-25',
    'facility-pass-through-14',
    'facility-exact-fee-14',
    'facility-liquidation-14',
    'facility-bankruptcy-handoff-14',
    'facility-bankruptcy-finished-14',
    'facility-stable-14',
    'facility-stable-25',
    'facility-direct-14-3p',
    'facility-direct-14-4p',
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

  it('only resolves fixed full-map fixture names in browser-test mode', () => {
    expect(getBrowserTestFixture('development', 'solvent-rent')).toBeNull();
    expect(getBrowserTestFixture('browser-test', 'cash=1')).toBeNull();
    expect(getBrowserTestFixture('browser-test', 'unknown')).toBeNull();

    for (const fixtureName of fixtureNames) {
      expect(getBrowserTestFixture('browser-test', fixtureName)?.name).toBe(fixtureName);
    }
  });

  it('creates fresh canonical full-map states for bankruptcy handoff', () => {
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
    expect(first?.content.boardVersion).toBe('full-map-36-v1');
    expect(first?.content.properties).toHaveLength(20);
    expect(first?.game.boardVersion).toBe('full-map-36-v1');
    expect(first?.game.players.map((player) => player.id)).toEqual(['P1', 'P2', 'P3']);
    expect(first?.game.players.every((player) => !player.bankrupt)).toBe(true);
    expect(first?.game.activePlayerIndex).toBe(1);
    expect(first?.game.players[1]).toMatchObject({ cash: 10, position: 0 });
    expect(first?.game.properties).toMatchObject({
      HARBOR_01: { ownerId: 'P1', level: 3 },
      HARBOR_03: { ownerId: 'P2', level: 0 }
    });
  });

  it('uses the canonical local roster and formal property IDs in every fixture', () => {
    for (const fixtureName of fixtureNames) {
      const fixture = getBrowserTestFixture('browser-test', fixtureName)!;
      expect(fixture.game.players.map((player) => player.name)).toEqual(
        fixture.game.players.map((player) => ({
          P1: '玩家一',
          P2: '玩家二',
          P3: '玩家三',
          P4: '玩家四'
        })[player.id])
      );
      expect(Object.keys(fixture.game.properties)).toHaveLength(20);
      expect(Object.keys(fixture.game.properties)).not.toContain('A1');
    }
  });

  it('does not select a fixture when Persistence already restored a valid v4 save', () => {
    const fixture = getBrowserTestFixture('browser-test', 'solvent-rent')!;
    const initialLoad: LocalGameLoadResult = {
      status: 'ready',
      save: {
        schemaVersion: 4,
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

  it('whitelists legal deterministic facility-entry states without pre-resolving payment', () => {
    const direct = getBrowserTestFixture('browser-test', 'facility-direct-14');
    const liquidation = getBrowserTestFixture('browser-test', 'facility-liquidation-14');
    const bankruptcy = getBrowserTestFixture('browser-test', 'facility-bankruptcy-handoff-14');

    expect(direct?.flow).toBe('turnReady');
    expect(direct?.game.pendingInteraction).toBeNull();
    expect(direct?.game.players[0]).toMatchObject({ id: 'P1', cash: 100, position: 13 });
    expect(direct?.random).toEqual({ algorithm: 'xorshift32', state: 1 });

    expect(liquidation?.flow).toBe('turnReady');
    expect(liquidation?.game.pendingInteraction).toBeNull();
    expect(liquidation?.game.players[0]).toMatchObject({ id: 'P1', cash: 20, position: 13 });
    expect(liquidation?.game.properties.HARBOR_03).toMatchObject({ ownerId: 'P1', level: 0 });

    expect(bankruptcy?.flow).toBe('turnReady');
    expect(bankruptcy?.game.pendingInteraction).toBeNull();
    expect(bankruptcy?.game.players[1]).toMatchObject({ id: 'P2', cash: 0, position: 13 });
    expect(bankruptcy?.game.properties.HARBOR_01).toMatchObject({ ownerId: 'P2', level: 0 });
  });
});
