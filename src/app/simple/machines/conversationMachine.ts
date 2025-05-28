import { createMachine } from '@xstate/fsm';
import {
  conversationStates,
  buildMachineStates,
  ConversationStateValue,
  ConversationContext
} from '@/app/agentConfigs/marlene/conversationStates';

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
  states: buildMachineStates(conversationStates)
});
