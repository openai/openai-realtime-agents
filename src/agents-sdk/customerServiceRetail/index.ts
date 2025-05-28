import { authenticationAgent } from './authenticationAgent';
import { returnsAgent } from './returnsAgent';
import { salesAgent } from './salesAgent';
import { simulatedHumanAgent } from './simulatedHuman';

authenticationAgent.handoffs.push(returnsAgent, salesAgent, simulatedHumanAgent);
returnsAgent.handoffs.push(authenticationAgent, salesAgent, simulatedHumanAgent);
salesAgent.handoffs.push(authenticationAgent, returnsAgent, simulatedHumanAgent);
simulatedHumanAgent.handoffs.push(authenticationAgent, returnsAgent, salesAgent);

export const customerServiceRetailScenario = [
  authenticationAgent,
  returnsAgent,
  salesAgent,
  simulatedHumanAgent,
];
