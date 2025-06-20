import { angryCustomerAgent } from './angryCustomer';
import { frustratedCustomerAgent } from './frustratedCustomer';
import { naiveCustomerAgent } from './naiveCustomer';

// Cast to `any` to satisfy TypeScript until the core types make RealtimeAgent
// assignable to `Agent<unknown>` (current library versions are invariant on
// the context type).
(angryCustomerAgent.handoffs as any).push(frustratedCustomerAgent, naiveCustomerAgent);
(frustratedCustomerAgent.handoffs as any).push(angryCustomerAgent, naiveCustomerAgent);
(naiveCustomerAgent.handoffs as any).push(angryCustomerAgent, frustratedCustomerAgent);

export const customerAgentsScenario = [
  angryCustomerAgent,
  frustratedCustomerAgent,
  naiveCustomerAgent,
];

// Name of the company represented by this agent set. Used by guardrails
export const customerAgentsCompanyName = 'Customer Service Training'; 