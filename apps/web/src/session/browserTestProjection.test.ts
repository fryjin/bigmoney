import { describe, expect, it } from 'vitest';
import { fullMap36Content } from '@bigmoney/game-content';
import { createLocalGameState, type GameState } from '@bigmoney/game-core';
import type { LocalGameSessionSnapshot } from '@bigmoney/game-flow';
import { renderBrowserTestGameText } from './browserTestProjection';

describe('browser test state projection', () => {
  it('reads the canonical liquidation payment details without mutating state', () => {
    const game = createLocalGameState(fullMap36Content);
    game.activePlayerIndex = 1;
    game.pendingInteraction = {
      type: 'LIQUIDATION',
      playerId: 'P2',
      payment: {
        id: 'PAYMENT-0001',
        payerId: 'P2',
        receiverId: 'P1',
        amount: 75,
        reason: 'RENT',
        propertyId: 'HARBOR_01'
      }
    };
    const before = structuredClone(game);

    expect(JSON.parse(renderBrowserTestGameText(snapshot(game), false))).toMatchObject({
      flow: 'awaitingLiquidation',
      boardVersion: 'full-map-36-v1',
      tileCount: 36,
      activePlayerId: 'P2',
      activePlayerIndex: 1,
      activePlayerPosition: 0,
      currentTileId: 'START',
      currentTileType: 'START',
      playerCount: 2,
      round: 1,
      domainRevision: 0,
      lastEventTypes: [],
      eventResolutions: [],
      pendingLiquidation: {
        paymentId: 'PAYMENT-0001',
        payerId: 'P2',
        receiverId: 'P1',
        amount: 75,
        reason: 'RENT'
      }
    });
    expect(game).toEqual(before);
  });

  it('projects only the current public event resolution details', () => {
    const game = createLocalGameState(fullMap36Content, 4);
    const snapshotWithEvent = snapshot(game, 'awaitingResult');
    snapshotWithEvent.lastEvents = [{
      type: 'EVENT_RESOLVED',
      eventId: 'EVENT_NEIGHBOR_SUPPORT',
      playerId: 'P2',
      title: '邻里互助',
      description: '下一名仍在游戏中的玩家向你转账200万元。',
      changes: [
        { playerId: 'P4', amount: -10 },
        { playerId: 'P2', amount: 10 }
      ]
    }];

    expect(JSON.parse(renderBrowserTestGameText(snapshotWithEvent, false))).toMatchObject({
      eventResolutions: [{
        eventId: 'EVENT_NEIGHBOR_SUPPORT',
        playerId: 'P2',
        changes: [
          { playerId: 'P4', amount: -10 },
          { playerId: 'P2', amount: 10 }
        ]
      }]
    });
  });

  it('redacts private player and asset data during handoff', () => {
    const game = createLocalGameState(fullMap36Content);
    game.players[0]!.cards.push({ instanceId: 'CARD-0001', cardId: 'CARD_REROLL' });
    game.players[0]!.stocks.push({
      holdingId: 'STOCK-0001',
      stockId: 'SKYLINE_TECH',
      principal: 50,
      originalPeriod: 2,
      remainingRounds: 2,
      purchasedRound: 1
    });

    expect(JSON.parse(renderBrowserTestGameText(snapshot(game, 'awaitingHandoff'), true))).toEqual({
      flow: 'awaitingHandoff',
      status: 'IN_PROGRESS',
      privateInfoHidden: true
    });
  });
});

function snapshot(
  game: GameState,
  flow: LocalGameSessionSnapshot['flow'] = 'awaitingLiquidation'
): LocalGameSessionSnapshot {
  return {
    flow,
    game,
    cue: null,
    lastEvents: [],
    error: null,
    revision: 0,
    domainRevision: 0
  };
}
