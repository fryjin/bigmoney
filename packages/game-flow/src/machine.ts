import { setup } from 'xstate';

export type FlowPhase =
  | 'turnReady'
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
  | 'turnEnd'
  | 'presentingTurnEnd';

export type FlowMachineEvent =
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
  id: 'bigmoneyPhase11Flow',
  initial: 'turnReady',
  states: {
    turnReady: {
      on: {
        ROLL_STARTED: 'presentingRoll'
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
    turnEnd: {
      on: {
        TURN_ENDED: 'presentingTurnEnd'
      }
    },
    presentingTurnEnd: {
      on: {
        TURN_PRESENTED: 'turnReady'
      }
    }
  }
});
