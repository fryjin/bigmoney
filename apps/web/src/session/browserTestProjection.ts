import type { TechnicalSliceSessionSnapshot } from '@bigmoney/game-flow';

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

export function renderBrowserTestGameText(
  snapshot: TechnicalSliceSessionSnapshot,
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
  const pendingLiquidation =
    pending?.type === 'LIQUIDATION'
      ? {
          paymentId: pending.payment.id,
          payerId: pending.payment.payerId,
          receiverId: pending.payment.receiverId,
          amount: pending.payment.amount,
          reason: pending.payment.reason
        }
      : null;
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
    round: snapshot.game.round,
    activePlayerIndex: snapshot.game.activePlayerIndex,
    playerCount: snapshot.game.players.length,
    domainRevision: snapshot.domainRevision,
    lastEventTypes: snapshot.lastEvents.map((event) => event.type),
    eventResolutions,
    winnerId: snapshot.game.winnerId,
    activePlayerId: snapshot.game.players[snapshot.game.activePlayerIndex]?.id ?? null,
    pendingLiquidation,
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
