import { assign } from '@xstate/fsm';

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

export interface ConversationContext {
  cameraVerified: boolean;
}

export interface ConversationStateDef {
  id: ConversationStateValue;
  description: string;
  on: Record<string, any>;
}

export const conversationStates: ConversationStateDef[] = [
  {
    id: '1_greeting',
    description:
      'Marlene cumprimenta e começa a entender a necessidade do cliente.',
    on: {
      NAME_DETECTED: '2_identify_need',
      PURPOSE_DETECTED: '2_identify_need',
      BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
      BENEFIT_PROVIDED: '4_benefit_verification',
      VALUE_PROVIDED: '4_benefit_verification',
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '2_identify_need',
    description:
      'Coleta nome, forma de tratamento e finalidade do empréstimo.',
    on: {
      BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
      BENEFIT_PROVIDED: '4_benefit_verification',
      VALUE_PROVIDED: '4_benefit_verification',
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '4_benefit_verification',
    description: 'Confirma número do benefício e consulta limites.',
    on: {
      BENEFIT_AND_VALUE_PROVIDED: '6_loan_simulation',
      BENEFIT_CONFIRMED: [
        { cond: (ctx: ConversationContext) => ctx.cameraVerified, target: '6_loan_simulation' },
        { target: '5_camera_verification' }
      ],
      VALUE_PROVIDED: [
        { cond: (ctx: ConversationContext) => ctx.cameraVerified, target: '6_loan_simulation' },
        { target: '5_camera_verification' }
      ],
      CAMERA_VERIFIED: {
        target: '6_loan_simulation',
        actions: assign({ cameraVerified: () => true })
      },
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '5_camera_verification',
    description: 'Verifica identidade por câmera antes de simular valores.',
    on: {
      CAMERA_VERIFIED: {
        target: '6_loan_simulation',
        actions: assign({ cameraVerified: () => true })
      },
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '6_loan_simulation',
    description: 'Apresenta opções de empréstimo conforme dados coletados.',
    on: {
      SIMULATION_PRESENTED: '7_understanding_check',
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '7_understanding_check',
    description:
      'Usa verify_understanding para garantir que o cliente compreendeu.',
    on: {
      UNDERSTOOD: '8_confirmation',
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '8_confirmation',
    description:
      'Registra a intenção de contratar e gera documentação acessível.',
    on: {
      CONFIRMED: '9_closing',
      EARLY_EXIT: '10_early_exit'
    }
  },
  {
    id: '9_closing',
    description: 'Encerra o atendimento de forma cordial.',
    on: {
      RESET: {
        target: '1_greeting',
        actions: assign({ cameraVerified: () => false })
      }
    }
  },
  {
    id: '10_early_exit',
    description: 'Caminho para quando o usuário desiste ou não tem interesse.',
    on: {
      RESET: {
        target: '1_greeting',
        actions: assign({ cameraVerified: () => false })
      }
    }
  }
];

export function buildMachineStates(states: ConversationStateDef[]) {
  const result: Record<ConversationStateValue, { on: Record<string, any> }> = {} as any;
  for (const state of states) {
    result[state.id] = { on: state.on };
  }
  return result;
}

export function generateConversationStatesSection(): string {
  return conversationStates
    .map(s => `- **${s.id}** – ${s.description}`)
    .join('\n');
}
