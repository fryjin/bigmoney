import type { ForcedPayment } from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import type { LocalGameSessionSnapshot } from '@bigmoney/game-flow';

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

export function renderBrowserTestGameText(
  snapshot: LocalGameSessionSnapshot,
  privateInfoHidden: boolean
): string {
  if (privateInfoHidden) {
    return JSON.stringify({
      flow: snapshot.flow,
      status: snapshot.game.status,
      privateInfoHidden: true
    });
  }

  const pending = snapshot.game.pendingInteraction;
  const activePlayer = snapshot.game.players[snapshot.game.activePlayerIndex] ?? null;
  const currentTile = activePlayer
    ? fullMap36Content.tiles[activePlayer.position] ?? null
    : null;
  const pendingLiquidation =
    pending?.type === 'LIQUIDATION'
      ? projectPayment(pending.payment)
      : null;
  const completedPayments = snapshot.lastEvents.flatMap((event) =>
    event.type === 'PAYMENT_COMPLETED' ? [projectPayment(event.payment)] : []
  );
  const eventResolutions = snapshot.lastEvents.flatMap((event) =>
    event.type === 'EVENT_RESOLVED'
      ? [{
          eventId: event.eventId,
          playerId: event.playerId,
          changes: event.changes.map((change) => ({ ...change }))
        }]
      : []
  );

  return JSON.stringify({
    flow: snapshot.flow,
    status: snapshot.game.status,
    boardVersion: snapshot.game.boardVersion,
    tileCount: fullMap36Content.tiles.length,
    round: snapshot.game.round,
    activePlayerIndex: snapshot.game.activePlayerIndex,
    playerCount: snapshot.game.players.length,
    domainRevision: snapshot.domainRevision,
    lastEventTypes: snapshot.lastEvents.map((event) => event.type),
    eventResolutions,
    winnerId: snapshot.game.winnerId,
    activePlayerId: activePlayer?.id ?? null,
    activePlayerPosition: activePlayer?.position ?? null,
    currentTileId: currentTile?.id ?? null,
    currentTileType: currentTile?.type ?? null,
    currentTileName: currentTile?.name ?? null,
    currentTileReservedKind:
      currentTile?.type === 'RESERVED' ? currentTile.reservedKind : null,
    pendingInteractionType: pending?.type ?? null,
    pendingMarketId: pending?.type === 'STOCK_MARKET' ? pending.marketId : null,
    pendingEventId: pending?.type === 'EVENT_RESULT' ? pending.eventId : null,
    pendingCardId: pending?.type === 'CARD_DRAW' ? pending.card.cardId : null,
    pendingPropertyId:
      pending?.type === 'PROPERTY_PURCHASE' || pending?.type === 'PROPERTY_UPGRADE'
        ? pending.propertyId
      : null,
    pendingLiquidation,
    completedPayments,
    moves: snapshot.lastEvents.flatMap((event) =>
      event.type === 'PLAYER_MOVED' ? [{ from: event.from, to: event.to }] : []
    ),
    lapRewards: snapshot.lastEvents.flatMap((event) =>
      event.type === 'LAP_REWARD_GRANTED' ? [{ playerId: event.playerId, amount: event.amount }] : []
    ),
    players: snapshot.game.players.map((player) => ({
      id: player.id,
      cash: player.cash,
      position: player.position,
      bankrupt: player.bankrupt
    })),
    properties: Object.values(snapshot.game.properties).map((property) => ({
      id: property.id,
      ownerId: property.ownerId,
      level: property.level
    }))
  });
}

function projectPayment(payment: ForcedPayment) {
  return {
    paymentId: payment.id,
    payerId: payment.payerId,
    receiverId: payment.receiverId,
    amount: payment.amount,
    reason: payment.reason,
    tileId: payment.reason === 'PUBLIC_FEE' ? payment.tileId : null
  };
}
