import { setup } from 'xstate';

export interface FlowContext {
  pendingPresentationCount: number;
  lastError: string | null;
}

export type FlowEvent =
  | { type: 'ROLL_REQUEST' }
  | { type: 'PROPERTY_DECISION_REQUIRED' }
  | { type: 'PRESENTATION_QUEUED'; count: number }
  | { type: 'PRESENTATION_DONE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'SKIP_PROPERTY' }
  | { type: 'TURN_SETTLED' }
  | { type: 'FAIL'; message: string };

export const technicalSliceFlowMachine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvent
  }
}).createMachine({
  id: 'technicalSliceFlow',
  initial: 'turnReady',
  context: { pendingPresentationCount: 0, lastError: null },
  states: {
    turnReady: {
      on: { ROLL_REQUEST: 'rolling' }
    },
    rolling: {
      on: {
        PRESENTATION_QUEUED: 'presentingMovement',
        FAIL: 'error'
      }
    },
    presentingMovement: {
      on: {
        PROPERTY_DECISION_REQUIRED: 'awaitingPropertyDecision',
        PRESENTATION_DONE: 'resolvingDestination',
        FAIL: 'error'
      }
    },
    resolvingDestination: {
      on: {
        PROPERTY_DECISION_REQUIRED: 'awaitingPropertyDecision',
        TURN_SETTLED: 'turnReady',
        FAIL: 'error'
      }
    },
    awaitingPropertyDecision: {
      on: {
        BUY_PROPERTY: 'presentingDecision',
        SKIP_PROPERTY: 'presentingDecision',
        FAIL: 'error'
      }
    },
    presentingDecision: {
      on: {
        PRESENTATION_DONE: 'turnReady',
        FAIL: 'error'
      }
    },
    error: {
      on: { TURN_SETTLED: 'turnReady' }
    }
  }
});
