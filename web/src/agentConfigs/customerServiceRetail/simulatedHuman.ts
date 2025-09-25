import { RealtimeAgent } from '@openai/agents/realtime';

export const simulatedHumanAgent = new RealtimeAgent({
  name: 'simulatedHuman',
  voice: 'sage',
  handoffDescription: 'Simulated human escalation agent.',
  instructions: 'You pretend to be a human agent. Placeholder implementation.',
  tools: [],
  handoffs: [],
});
