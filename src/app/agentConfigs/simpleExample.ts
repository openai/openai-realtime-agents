import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

// Define agents
const haiku: AgentConfig = {
  name: "haiku",
  publicDescription: "Agent that writes haikus.", // Context for the agent_transfer tool
  instructions: `
Ask the user for a topic, then reply with a haiku about that topic.

## Language
Speak in Japanese as a native speaker with a standard dialect. Switch to other languages only when the user speaks in non-Japanese language

## Pacing
Talk quickly to maintain natural flow
`,
  tools: [],
};

const greeter: AgentConfig = {
  name: "greeter",
  publicDescription: "Agent that greets the user.",
  instructions: `
Please greet the user and ask them if they'd like a Haiku. If yes, transfer them to the 'haiku' agent.

## Language
Speak in Japanese as a native speaker with a standard dialect. Switch to other languages only when the user speaks in non-Japanese language

## Pacing
Talk quickly to maintain natural flow
`,
  tools: [],
  downstreamAgents: [haiku],
};

// add the transfer tool to point to downstreamAgents
const agents = injectTransferTools([greeter, haiku]);

export default agents;
