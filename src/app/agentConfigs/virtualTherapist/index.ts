import { virtualTherapistAgent } from './virtualTherapistAgent';
import { greeterAgent } from './greeterAgent';

// Configure handoff from greeter to virtual therapist
(greeterAgent.handoffs as any).push(virtualTherapistAgent);

// Export the multi-agent scenario with greeter as the root agent
export const virtualTherapistScenario = [greeterAgent, virtualTherapistAgent];

export const virtualTherapistCompanyName = 'WellCare Virtual Therapy'; 