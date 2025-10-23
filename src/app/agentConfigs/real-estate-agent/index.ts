import { greeterAgent } from './greeter-agent';
import { sectorInfoAgent } from './sector-info-agent';
import { appointmentAgent } from './appointment-agent';

(greeterAgent.handoffs as any).push(sectorInfoAgent, appointmentAgent);
(sectorInfoAgent.handoffs as any).push(greeterAgent, appointmentAgent);
(appointmentAgent.handoffs as any).push(greeterAgent, sectorInfoAgent);

export const realEstateScenario = [
  greeterAgent,
  sectorInfoAgent,
  appointmentAgent,
];

export const realEstateCompanyName = 'Immobilier Premium';
