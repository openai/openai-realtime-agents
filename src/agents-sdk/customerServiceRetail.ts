import { authenticationAgent } from './customerServiceAuth';
import { returnsAgent } from './customerServiceReturns';
import { salesAgent } from './customerServiceSales';

// Establish handoffs
authenticationAgent.handoffs.push(returnsAgent, salesAgent);
returnsAgent.handoffs.push(authenticationAgent, salesAgent);
salesAgent.handoffs.push(authenticationAgent, returnsAgent);

export const customerServiceRetailScenario = [
  authenticationAgent,
  returnsAgent,
  salesAgent,
];
