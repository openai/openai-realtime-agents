import { AllAgentConfigsType } from '@/app/types';

import {
  simpleExampleScenario,
  customerServiceRetailScenario,
  frontDeskAuthenticationScenario,
  customerServiceWithSupervisionScenario,
} from '@/agents-sdk';

import { scenarioToLegacy } from '@/agents-sdk/legacyAdapter';

export const allAgentSets: AllAgentConfigsType = {
  simpleExample: scenarioToLegacy(simpleExampleScenario),
  customerServiceRetail: scenarioToLegacy(customerServiceRetailScenario),
  frontDeskAuthentication: scenarioToLegacy(frontDeskAuthenticationScenario),
  customerServiceWithSupervision: scenarioToLegacy(
    customerServiceWithSupervisionScenario,
  ),
};

export const defaultAgentSetKey = 'simpleExample';
