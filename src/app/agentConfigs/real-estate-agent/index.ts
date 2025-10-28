import { greeterAgent } from "./greeter-agent";
import { appointmentAgent } from "./appointment-agent";
import { complexTaskAgent } from "./complex-task-agent";
import { contactHumanAgent } from "./contact-human-agent";
import { sendTestMailAgent } from "./send-test-mail-agent";
(greeterAgent.handoffs as any).push(contactHumanAgent, appointmentAgent, complexTaskAgent, sendTestMailAgent);
(contactHumanAgent.handoffs as any).push(greeterAgent, appointmentAgent, complexTaskAgent, sendTestMailAgent);
(appointmentAgent.handoffs as any).push(greeterAgent, contactHumanAgent, complexTaskAgent, sendTestMailAgent);
(complexTaskAgent.handoffs as any).push(greeterAgent, contactHumanAgent, appointmentAgent, sendTestMailAgent);
(sendTestMailAgent.handoffs as any).push(greeterAgent, contactHumanAgent, appointmentAgent, complexTaskAgent);

export const realEstateScenario = [
  greeterAgent,
  contactHumanAgent,
  appointmentAgent,
  complexTaskAgent,
  sendTestMailAgent,
];
