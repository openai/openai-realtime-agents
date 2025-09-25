import { RealtimeAgent } from '@openai/agents/realtime';
import { getNextResponseFromSupervisor } from './supervisorAgent';

export const chatAgent = new RealtimeAgent({
  name: 'chatAgent',
  voice: 'sage',
  instructions: `You are a helpful junior customer service agent. Always defer to the supervisor tool for non-trivial queries.`,
  tools: [getNextResponseFromSupervisor],
});

export const chatSupervisorScenario = [chatAgent];
export const chatSupervisorCompanyName = 'NewTelco';
export default chatSupervisorScenario;
