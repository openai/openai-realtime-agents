import { createMachine, assign } from '@xstate/fsm';

export type ConversationStateValue =
  | '1_greeting'
  | '2_identify_need'
  | '4_benefit_verification'
  | '5_camera_verification'
  | '6_loan_simulation'
  | '7_understanding_check'
  | '8_confirmation'
  | '9_closing'
  | '10_early_exit';

interface ConversationContext {
  cameraVerified: boolean;
}

export type ConversationEvent =
  | { type: 'NAME_DETECTED' }
  | { type: 'PURPOSE_DETECTED' }
  | { type: 'BENEFIT_PROVIDED' }
  | { type: 'VALUE_PROVIDED' }
  | { type: 'BENEFIT_AND_VALUE_PROVIDED' }
  | { type: 'BENEFIT_CONFIRMED' }
  | { type: 'CAMERA_VERIFIED' }
  | { type: 'SIMULATION_PRESENTED' }
  | { type: 'UNDERSTOOD' }
  | { type: 'CONFIRMED' }
  | { type: 'EARLY_EXIT' }
  | { type: 'RESET' };

export const conversationMachine = createMachine<
  ConversationContext,
  ConversationEvent,
  { value: ConversationStateValue; context: ConversationContext }
>({
  id: 'conversation',
  initial: '1_greeting',
  context: { cameraVerified: false },
  states: {
    '1_greeting': {
      on: {
        NAME_DETECTED: '2_identify_need',
        PURPOSE_DETECTED: '2_identify_need',
        BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
        BENEFIT_PROVIDED: '4_benefit_verification',
        VALUE_PROVIDED: '4_benefit_verification',
        EARLY_EXIT: '10_early_exit'
      }
    },
    '2_identify_need': {
      on: {
        BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
        BENEFIT_PROVIDED: '4_benefit_verification',
        VALUE_PROVIDED: '4_benefit_verification',
        EARLY_EXIT: '10_early_exit'
      }
    },
    '4_benefit_verification': {
      on: {
        BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
        BENEFIT_CONFIRMED: [
          { cond: ctx => ctx.cameraVerified, target: '6_loan_simulation' },
          { target: '5_camera_verification' }
        ],
        VALUE_PROVIDED: [
          { cond: ctx => ctx.cameraVerified, target: '6_loan_simulation' },
          { target: '5_camera_verification' }
        ],
        CAMERA_VERIFIED: {
          target: '6_loan_simulation',
          actions: assign({ cameraVerified: () => true })
        },
        EARLY_EXIT: '10_early_exit'
      }
    },
    '5_camera_verification': {
      on: {
        CAMERA_VERIFIED: {
          target: '6_loan_simulation',
          actions: assign({ cameraVerified: () => true })
        },
        EARLY_EXIT: '10_early_exit'
      }
    },
    '6_loan_simulation': {
      on: {
        SIMULATION_PRESENTED: '7_understanding_check',
        EARLY_EXIT: '10_early_exit'
      }
    },
    '7_understanding_check': {
      on: {
        UNDERSTOOD: '8_confirmation',
        EARLY_EXIT: '10_early_exit'
      }
    },
    '8_confirmation': {
      on: {
        CONFIRMED: '9_closing',
        EARLY_EXIT: '10_early_exit'
      }
    },
    '9_closing': {
      on: {
        RESET: {
          target: '1_greeting',
          actions: assign({ cameraVerified: () => false })
        }
      }
    },
    '10_early_exit': {
      on: {
        RESET: {
          target: '1_greeting',
          actions: assign({ cameraVerified: () => false })
        }
      }
    }
  }
});
