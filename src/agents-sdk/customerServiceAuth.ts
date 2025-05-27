import { RealtimeAgent } from '@openai/agents-core/realtime';
import { returnsAgent } from './customerServiceReturns';

export const authenticationAgent = new RealtimeAgent({
  name: 'authentication',
  handoffDescription: 'Initial agent that greets the user and verifies identity.',
  voice: 'ash',
  instructions:
    'You are the authentication agent for Snowy Peak Boards. Greet the user and collect verification details before handing off to returns or sales.',
  tools: [],
  handoffs: [returnsAgent], // sales will be added later
});
