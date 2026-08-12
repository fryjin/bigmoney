import { setup } from 'xstate';

export type StableFlowPhase =
  | 'turnReady'
  | 'awaitingHandoff'
  | 'awaitingLiquidation'
  | 'finished';

export type FlowPhase =
  | StableFlowPhase
  | 'presentingRoll'
  | 'moving'
  | 'presentingMove'
  | 'awaitingStock'
  | 'presentingStock'
  | 'resolvingDestination'
  | 'awaitingProperty'
  | 'awaitingUpgrade'
  | 'awaitingResult'
  | 'presentingDecision'
  | 'presentingDestination'
  | 'presentingLiquidation'
  | 'presentingBankruptcy'
  | 'presentingFinished'
  | 'turnEnd'
  | 'presentingTurnEnd';

export type FlowMachineEvent =
  | { type: 'RESTORE_HANDOFF' }
  | { type: 'RESTORE_LIQUIDATION' }
  | { type: 'RESTORE_FINISHED' }
  | { type: 'HANDOFF_CONFIRMED' }
  | { type: 'ROLL_STARTED' }
  | { type: 'ROLL_PRESENTED' }
  | { type: 'STEP_STARTED' }
  | { type: 'CONTINUE_MOVE' }
  | { type: 'STOCK_REQUIRED' }
  | { type: 'STOCK_RESOLVED' }
  | { type: 'MOVEMENT_COMPLETE' }
  | { type: 'PROPERTY_REQUIRED' }
  | { type: 'UPGRADE_REQUIRED' }
  | { type: 'RESULT_REQUIRED' }
  | { type: 'DESTINATION_PRESENTATION_REQUIRED' }
  | { type: 'DESTINATION_COMPLETE' }
  | { type: 'LIQUIDATION_REQUIRED' }
  | { type: 'LIQUIDATION_COMPLETED' }
  | { type: 'LIQUIDATION_RESULT_REQUIRED' }
  | { type: 'LIQUIDATION_PRESENTED' }
  | { type: 'BANKRUPTCY_PRESENTATION_REQUIRED' }
  | { type: 'BANKRUPTCY_PRESENTED' }
  | { type: 'FINISHED_PRESENTATION_REQUIRED' }
  | { type: 'FINISHED_PRESENTED' }
  | { type: 'PROPERTY_RESOLVED' }
  | { type: 'UPGRADE_RESOLVED' }
  | { type: 'RESULT_ACKNOWLEDGED' }
  | { type: 'DECISION_PRESENTED' }
  | { type: 'DESTINATION_PRESENTED' }
  | { type: 'TURN_ENDED' }
  | { type: 'TURN_PRESENTED' };

export const technicalSliceFlowMachine = setup({
  types: {
    events: {} as FlowMachineEvent
  }
}).createMachine({
  id: 'bigmoneyPhase14Flow',
  initial: 'turnReady',
  states: {
    turnReady: {
      on: {
        RESTORE_HANDOFF: 'awaitingHandoff',
        RESTORE_LIQUIDATION: 'awaitingLiquidation',
        RESTORE_FINISHED: 'finished',
        ROLL_STARTED: 'presentingRoll'
      }
    },
    awaitingHandoff: {
      on: {
        HANDOFF_CONFIRMED: 'turnReady'
      }
    },
    presentingRoll: {
      on: {
        ROLL_PRESENTED: 'moving'
      }
    },
    moving: {
      on: {
        STEP_STARTED: 'presentingMove'
      }
    },
    presentingMove: {
      on: {
        CONTINUE_MOVE: 'moving',
        STOCK_REQUIRED: 'awaitingStock',
        MOVEMENT_COMPLETE: 'resolvingDestination'
      }
    },
    awaitingStock: {
      on: {
        STOCK_RESOLVED: 'presentingStock'
      }
    },
    presentingStock: {
      on: {
        CONTINUE_MOVE: 'moving',
        MOVEMENT_COMPLETE: 'resolvingDestination'
      }
    },
    resolvingDestination: {
      on: {
        PROPERTY_REQUIRED: 'awaitingProperty',
        UPGRADE_REQUIRED: 'awaitingUpgrade',
        RESULT_REQUIRED: 'awaitingResult',
        LIQUIDATION_REQUIRED: 'awaitingLiquidation',
        BANKRUPTCY_PRESENTATION_REQUIRED: 'presentingBankruptcy',
        FINISHED_PRESENTATION_REQUIRED: 'presentingFinished',
        DESTINATION_PRESENTATION_REQUIRED: 'presentingDestination',
        DESTINATION_COMPLETE: 'turnEnd'
      }
    },
    awaitingProperty: {
      on: {
        PROPERTY_RESOLVED: 'presentingDecision'
      }
    },
    awaitingUpgrade: {
      on: {
        UPGRADE_RESOLVED: 'presentingDecision'
      }
    },
    awaitingResult: {
      on: {
        RESULT_ACKNOWLEDGED: 'turnEnd'
      }
    },
    presentingDecision: {
      on: {
        DECISION_PRESENTED: 'turnEnd'
      }
    },
    presentingDestination: {
      on: {
        DESTINATION_PRESENTED: 'turnEnd'
      }
    },
    awaitingLiquidation: {
      on: {
        LIQUIDATION_COMPLETED: 'presentingLiquidation',
        BANKRUPTCY_PRESENTATION_REQUIRED: 'presentingBankruptcy',
        FINISHED_PRESENTATION_REQUIRED: 'presentingFinished'
      }
    },
    presentingLiquidation: {
      on: {
        LIQUIDATION_PRESENTED: 'turnEnd',
        LIQUIDATION_RESULT_REQUIRED: 'awaitingResult'
      }
    },
    presentingBankruptcy: {
      on: {
        BANKRUPTCY_PRESENTED: 'awaitingHandoff'
      }
    },
    presentingFinished: {
      on: {
        FINISHED_PRESENTED: 'finished'
      }
    },
    turnEnd: {
      on: {
        TURN_ENDED: 'presentingTurnEnd'
      }
    },
    presentingTurnEnd: {
      on: {
        TURN_PRESENTED: 'awaitingHandoff'
      }
    },
    finished: {
      on: {}
    }
  }
});
