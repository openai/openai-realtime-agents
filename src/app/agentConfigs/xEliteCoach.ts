import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

/* ─── leaf coaches ─── */

const mindsetCoach: AgentConfig = {
  name: "mindsetCoach",
  publicDescription: "Helps the creator unblock limiting beliefs.",
  instructions: `
You are a warm, no‑nonsense farm mentor.  
• Ask the user to state ONE obstacle in growing their X account.  
• Give a 30‑sec actionable mindset reframe.  
• Then offer to transfer them to Monetization.  
If they say anything like "money", "offer", "pricing", call \`agent_transfer\` to "monetizationCoach".
`,
  tools: [],               // none for now
};

const monetizationCoach: AgentConfig = {
  name: "monetizationCoach",
  publicDescription: "Turns traction into cash offers.",
  instructions: `
You are a savvy copy chief.  
• Ask what product / expertise the user could sell in <20 words.  
• Outline a simple offer + one tweet hook.  
• If the user says "summarize" or "recap", transfer to "summaryCoach".
`,
  tools: [],
};

const summaryCoach: AgentConfig = {
  name: "summaryCoach",
  publicDescription: "Wrap‑up agent that recaps insights in ≤90 sec.",
  instructions: `Briefly recap the main takeaways and wish the user luck. End the call.`,
  tools: [],
};

/* ─── entry agent ─── */

const greeter: AgentConfig = {
  name: "greeter",
  publicDescription: "Welcomes the user and routes the call.",
  instructions: `
Welcome the user in Jairo's friendly farm vibe.  
Ask: "Do you need help with Mindset, Monetization, or just a quick Summary?"  
When they choose, transfer to the matching agent.
`,
  downstreamAgents: [mindsetCoach, monetizationCoach, summaryCoach],
  tools: [],               // injectTransferTools will add the transfer tool
};

/* ─── wire them up ─── */
const agents = injectTransferTools([
  greeter,
  mindsetCoach,
  monetizationCoach,
  summaryCoach,
]);

export default agents;
