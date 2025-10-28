import { greeterAgent } from "./greeter-agent";
import { appointmentAgent } from "./appointment-agent";
import { complexTaskAgent } from "./complex-task-agent";
import { contactHumanAgent } from "./contact-human-agent";
(greeterAgent.handoffs as any).push(contactHumanAgent, appointmentAgent, complexTaskAgent);
(contactHumanAgent.handoffs as any).push(greeterAgent, appointmentAgent, complexTaskAgent);
(appointmentAgent.handoffs as any).push(greeterAgent, contactHumanAgent, complexTaskAgent);
(complexTaskAgent.handoffs as any).push(greeterAgent, contactHumanAgent, appointmentAgent);

export const realEstateScenario = [
  greeterAgent,
  contactHumanAgent,
  appointmentAgent,
  complexTaskAgent,
];
