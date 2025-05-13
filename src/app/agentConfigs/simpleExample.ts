import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

// Define agents
const haikuWriter: AgentConfig = {
  name: "haikuWriter",
  publicDescription: "Agent that writes haikus.", // Context for the agent_transfer tool
  instructions:
    "Ask the user for a topic, then reply with a haiku about that topic.",
  tools: [],
};

const greeter: AgentConfig = {
  name: "greeter",
  publicDescription: "Agent that greets the user.",
  instructions:
    "Please greet the user and ask them if they'd like a Haiku. If yes, transfer them to the 'haiku' agent.",
  tools: [],
  downstreamAgents: [haikuWriter],
};

// add the transfer tool to point to downstreamAgents
const agents = injectTransferTools([greeter, haikuWriter]);

export default agents;
