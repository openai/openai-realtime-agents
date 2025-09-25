import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const returnsAgent = new RealtimeAgent({
  name: 'returns',
  voice: 'sage',
  handoffDescription: 'Handles return initiations and policy checks.',
  instructions: 'You handle return questions. This is a slimmed placeholder.',
  tools: [
    tool({
      name: 'lookupOrders',
      description: 'Lookup orders by phone number',
      parameters: {
        type: 'object',
        properties: { phoneNumber: { type: 'string' } },
        required: ['phoneNumber'],
        additionalProperties: false,
      },
      execute: async () => ({ orders: [] }),
    }),
  ],
  handoffs: [],
});
