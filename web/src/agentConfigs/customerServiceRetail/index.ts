import { authenticationAgent } from './authentication';
import { returnsAgent } from './returns';
import { salesAgent } from './sales';
import { simulatedHumanAgent } from './simulatedHuman';

(authenticationAgent.handoffs as any).push(
  returnsAgent,
  salesAgent,
  simulatedHumanAgent
);
(returnsAgent.handoffs as any).push(
  authenticationAgent,
  salesAgent,
  simulatedHumanAgent
);
(salesAgent.handoffs as any).push(
  authenticationAgent,
  returnsAgent,
  simulatedHumanAgent
);
(simulatedHumanAgent.handoffs as any).push(
  authenticationAgent,
  returnsAgent,
  salesAgent
);

export const customerServiceRetailScenario = [
  authenticationAgent,
  returnsAgent,
  salesAgent,
  simulatedHumanAgent,
];

export const customerServiceRetailCompanyName = 'Snowy Peak Boards';
