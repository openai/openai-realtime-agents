import { simpleExampleScenario } from './simpleHandoff';
import { customerServiceRetailScenario } from './customerServiceRetail';
import { chatSupervisorScenario } from './chatSupervisor';


import { AllAgentConfigsType } from '@/app/types';


import { scenarioToLegacy } from '@/app/agentConfigs/legacyAdapter';

export const allAgentSets: AllAgentConfigsType = {
  simpleExample: scenarioToLegacy(simpleExampleScenario),
  customerServiceRetail: scenarioToLegacy(customerServiceRetailScenario),
  chatSupervisor: scenarioToLegacy(chatSupervisorScenario),
};

export const defaultAgentSetKey = 'simpleExample';
