import { greeterAgent } from "./greeter-agent";
import { sectorInfoAgent } from "./sector-info-agent";
import { appointmentAgent } from "./appointment-agent";
import { complexTaskAgent } from "./complex-task-agent";
(greeterAgent.handoffs as any).push(sectorInfoAgent, appointmentAgent, complexTaskAgent);
(sectorInfoAgent.handoffs as any).push(greeterAgent, appointmentAgent, complexTaskAgent);
(appointmentAgent.handoffs as any).push(greeterAgent, sectorInfoAgent, complexTaskAgent);
(complexTaskAgent.handoffs as any).push(greeterAgent, sectorInfoAgent, appointmentAgent);

export const realEstateScenario = [
  greeterAgent,
  sectorInfoAgent,
  appointmentAgent,
  complexTaskAgent,
];
