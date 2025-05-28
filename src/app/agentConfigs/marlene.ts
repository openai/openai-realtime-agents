// src/app/agentConfigs/marlene.ts
import { AgentConfig } from '@/app/types';
import {
  injectTransferTools,
  animateValueTool,
  openCameraTool,
  closeCameraTool,
  verifyUnderstandingTool,
  simplifyFinancialExplanationTool,
  includeCompanionTool,
  handleCameraErrorTool,
  createAccessibleDocumentationTool,
  consultBenefitTool,
  timeGreetingTool,
  sayGreetingTool
} from './utils';
import { marlenePrompt } from './marlene/prompt';
import toolLogic from './marlene/toolLogic';

const marlene: AgentConfig = {
  name: 'marlene',
  publicDescription: 'Marlene, atendente de voz da Credmais para crédito consignado.',
  instructions: marlenePrompt,
  tools: [
    animateValueTool,
    openCameraTool,
    closeCameraTool,
    verifyUnderstandingTool,
    simplifyFinancialExplanationTool,
    includeCompanionTool,
    handleCameraErrorTool,
    createAccessibleDocumentationTool,
    consultBenefitTool,
    timeGreetingTool,
    sayGreetingTool
  ],
  toolLogic,
  downstreamAgents: []
};

export default injectTransferTools([marlene]);
