import { authenticationAgent } from './authenticationAgent';
import { returnsAgent } from './returnsAgent';
import { salesAgent } from './salesAgent';

// Set up hand-offs exactly like the legacy downstreamAgents mapping.
authenticationAgent.handoffs.push(returnsAgent, salesAgent);
returnsAgent.handoffs.push(authenticationAgent, salesAgent);
salesAgent.handoffs.push(authenticationAgent, returnsAgent);

export const customerServiceRetailScenario = [
  authenticationAgent,
  returnsAgent,
  salesAgent,
];
