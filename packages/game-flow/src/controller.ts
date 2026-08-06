import {
  createTechnicalSliceState,
  executeCommand,
  type CommandResult,
  type DomainEvent,
  type GameState,
  type PlayerId
} from '@bigmoney/game-core';
import type { RandomProvider } from '@bigmoney/game-random';
import { createActor } from 'xstate';
import {
  technicalSliceFlowMachine,
  type FlowPhase,
  type StableFlowPhase
} from './machine';

export type PresentationCueKind =
  | 'ROLL'
  | 'MOVE'
  | 'STOCK'
  | 'PROPERTY'
  | 'UPGRADE'
  | 'DESTINATION'
  | 'TURN';

export interface PresentationCue {
  id: number;
  kind: PresentationCueKind;
  events: DomainEvent[];
}

export interface TechnicalSliceSessionSnapshot {
  flow: FlowPhase;
  game: GameState;
  cue: PresentationCue | null;
  lastEvents: DomainEvent[];
  error: string | null;
  revision: number;
  domainRevision: number;
}

export interface StockPurchaseSelection {
  stockId: string;
  principal: number;
  period: 2 | 4 | 6;
}

type Listener = (snapshot: TechnicalSliceSessionSnapshot) => void;

export class TechnicalSliceSession {
  private readonly actor = createActor(technicalSliceFlowMachine);
  private readonly listeners = new Set<Listener>();
  private gameState: GameState;
  private cue: PresentationCue | null = null;
  private lastEvents: DomainEvent[] = [];
  private error: string | null = null;
  private revision = 0;
  private domainRevision = 0;
  private cueSequence = 1;
  private operationInProgress = false;

  constructor(
    private readonly random: RandomProvider,
    initialState: GameState = createTechnicalSliceState(),
    initialFlow: StableFlowPhase = 'turnReady'
  ) {
    this.gameState = structuredClone(initialState);
    this.actor.start();
    if (initialFlow === 'awaitingHandoff') {
      this.actor.send({ type: 'RESTORE_HANDOFF' });
    }
  }

  getSnapshot(): TechnicalSliceSessionSnapshot {
    return {
      flow: String(this.actor.getSnapshot().value) as FlowPhase,
      game: structuredClone(this.gameState),
      cue: this.cue ? structuredClone(this.cue) : null,
      lastEvents: structuredClone(this.lastEvents),
      error: this.error,
      revision: this.revision,
      domainRevision: this.domainRevision
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.actor.stop();
    this.listeners.clear();
  }

  clearError(): void {
    this.error = null;
    this.emit();
  }


  confirmHandoff(): void {
    this.run(() => {
      this.expectPhase('awaitingHandoff');
      this.actor.send({ type: 'HANDOFF_CONFIRMED' });
      this.bump();
    });
  }

  roll(): void {
    this.run(() => {
      this.expectPhase('turnReady');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'ROLL_DICE', playerId },
        this.random
      );
      this.actor.send({ type: 'ROLL_STARTED' });
      this.commit(result, 'ROLL');
    });
  }

  resolveStockMarket(purchase: StockPurchaseSelection | null): void {
    this.run(() => {
      this.expectPhase('awaitingStock');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'RESOLVE_STOCK_MARKET', playerId, purchase },
        this.random
      );
      this.actor.send({ type: 'STOCK_RESOLVED' });
      this.commit(result, 'STOCK');
    });
  }

  buyProperty(): void {
    this.run(() => {
      this.expectPhase('awaitingProperty');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'BUY_PROPERTY', playerId },
        this.random
      );
      this.actor.send({ type: 'PROPERTY_RESOLVED' });
      this.commit(result, 'PROPERTY');
    });
  }

  skipProperty(): void {
    this.run(() => {
      this.expectPhase('awaitingProperty');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'SKIP_PROPERTY', playerId },
        this.random
      );
      this.actor.send({ type: 'PROPERTY_RESOLVED' });
      this.commit(result, 'PROPERTY');
    });
  }

  upgradeProperty(): void {
    this.run(() => {
      this.expectPhase('awaitingUpgrade');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'UPGRADE_PROPERTY', playerId },
        this.random
      );
      this.actor.send({ type: 'UPGRADE_RESOLVED' });
      this.commit(result, 'UPGRADE');
    });
  }

  skipUpgrade(): void {
    this.run(() => {
      this.expectPhase('awaitingUpgrade');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'SKIP_UPGRADE', playerId },
        this.random
      );
      this.actor.send({ type: 'UPGRADE_RESOLVED' });
      this.commit(result, 'UPGRADE');
    });
  }

  acknowledgeResult(): void {
    this.run(() => {
      this.expectPhase('awaitingResult');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'ACKNOWLEDGE_RESULT', playerId },
        this.random
      );
      this.actor.send({ type: 'RESULT_ACKNOWLEDGED' });
      this.commitWithoutCue(result);
    });
  }

  chooseCardToDiscard(cardInstanceId: string): void {
    this.run(() => {
      this.expectPhase('awaitingResult');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        {
          type: 'CHOOSE_CARD_TO_DISCARD',
          playerId,
          cardInstanceId
        },
        this.random
      );
      this.actor.send({ type: 'RESULT_ACKNOWLEDGED' });
      this.commitWithoutCue(result);
    });
  }

  endTurn(): void {
    this.run(() => {
      this.expectPhase('turnEnd');
      const playerId = this.activePlayerId();
      const result = executeCommand(
        this.gameState,
        { type: 'END_TURN', playerId },
        this.random
      );
      this.actor.send({ type: 'TURN_ENDED' });
      this.commit(result, 'TURN');
    });
  }

  presentationDone(cueId: number): void {
    this.run(() => {
      if (!this.cue || this.cue.id !== cueId) return;
      const phase = this.phase();
      this.cue = null;

      if (phase === 'presentingRoll') {
        this.actor.send({ type: 'ROLL_PRESENTED' });
        this.advanceMovement();
        return;
      }

      if (phase === 'presentingMove') {
        this.routeAfterMovementPresentation();
        return;
      }

      if (phase === 'presentingStock') {
        this.routeAfterStockPresentation();
        return;
      }

      if (phase === 'presentingDecision') {
        this.actor.send({ type: 'DECISION_PRESENTED' });
        this.bump();
        return;
      }

      if (phase === 'presentingDestination') {
        this.actor.send({ type: 'DESTINATION_PRESENTED' });
        this.bump();
        return;
      }

      if (phase === 'presentingTurnEnd') {
        this.actor.send({ type: 'TURN_PRESENTED' });
        this.bump();
      }
    });
  }

  private advanceMovement(): void {
    this.expectPhase('moving');
    const playerId = this.activePlayerId();
    const result = executeCommand(
      this.gameState,
      { type: 'MOVE_ONE_STEP', playerId },
      this.random
    );
    this.actor.send({ type: 'STEP_STARTED' });
    this.commit(result, 'MOVE');
  }

  private routeAfterMovementPresentation(): void {
    if (this.gameState.pendingInteraction?.type === 'STOCK_MARKET') {
      this.actor.send({ type: 'STOCK_REQUIRED' });
      this.bump();
      return;
    }

    if (this.gameState.turn.remainingSteps > 0) {
      this.actor.send({ type: 'CONTINUE_MOVE' });
      this.advanceMovement();
      return;
    }

    this.actor.send({ type: 'MOVEMENT_COMPLETE' });
    this.resolveDestination();
  }

  private routeAfterStockPresentation(): void {
    if (this.gameState.turn.remainingSteps > 0) {
      this.actor.send({ type: 'CONTINUE_MOVE' });
      this.advanceMovement();
      return;
    }

    this.actor.send({ type: 'MOVEMENT_COMPLETE' });
    this.resolveDestination();
  }

  private resolveDestination(): void {
    this.expectPhase('resolvingDestination');
    const playerId = this.activePlayerId();
    const result = executeCommand(
      this.gameState,
      { type: 'RESOLVE_DESTINATION', playerId },
      this.random
    );

    this.gameState = result.nextState;
    this.lastEvents = result.events;
    this.revision += 1;
    this.domainRevision += 1;

    const pendingType = this.gameState.pendingInteraction?.type;
    if (pendingType === 'PROPERTY_PURCHASE') {
      this.actor.send({ type: 'PROPERTY_REQUIRED' });
      this.emit();
      return;
    }
    if (pendingType === 'PROPERTY_UPGRADE') {
      this.actor.send({ type: 'UPGRADE_REQUIRED' });
      this.emit();
      return;
    }
    if (
      pendingType === 'EVENT_RESULT' ||
      pendingType === 'CARD_DRAW' ||
      pendingType === 'CARD_REPLACEMENT'
    ) {
      this.actor.send({ type: 'RESULT_REQUIRED' });
      this.emit();
      return;
    }

    const hasDestinationPresentation = result.events.some((event) =>
      ['RENT_PAID'].includes(event.type)
    );

    if (hasDestinationPresentation) {
      this.actor.send({ type: 'DESTINATION_PRESENTATION_REQUIRED' });
      this.cue = this.createCue('DESTINATION', result.events);
      this.emit();
      return;
    }

    this.actor.send({ type: 'DESTINATION_COMPLETE' });
    this.emit();
  }

  private commit(result: CommandResult, kind: PresentationCueKind): void {
    this.gameState = result.nextState;
    this.lastEvents = result.events;
    this.cue = this.createCue(kind, result.events);
    this.revision += 1;
    this.domainRevision += 1;
    this.emit();
  }

  private commitWithoutCue(result: CommandResult): void {
    this.gameState = result.nextState;
    this.lastEvents = result.events;
    this.cue = null;
    this.revision += 1;
    this.domainRevision += 1;
    this.emit();
  }

  private createCue(
    kind: PresentationCueKind,
    events: DomainEvent[]
  ): PresentationCue {
    const cue: PresentationCue = {
      id: this.cueSequence,
      kind,
      events: structuredClone(events)
    };
    this.cueSequence += 1;
    return cue;
  }

  private activePlayerId(): PlayerId {
    const player = this.gameState.players[this.gameState.activePlayerIndex];
    if (!player) throw new Error('找不到当前玩家。');
    return player.id;
  }

  private phase(): FlowPhase {
    return String(this.actor.getSnapshot().value) as FlowPhase;
  }

  private expectPhase(expected: FlowPhase): void {
    const actual = this.phase();
    if (actual !== expected) {
      throw new Error(`流程状态不允许该操作：${actual}，期望 ${expected}。`);
    }
  }

  private run(operation: () => void): void {
    if (this.operationInProgress) return;
    this.operationInProgress = true;

    try {
      this.error = null;
      operation();
    } catch (error) {
      this.error = error instanceof Error ? error.message : '未知流程错误';
      this.emit();
    } finally {
      this.operationInProgress = false;
    }
  }

  private bump(): void {
    this.revision += 1;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
