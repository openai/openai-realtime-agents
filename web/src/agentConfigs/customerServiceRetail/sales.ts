import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const salesAgent = new RealtimeAgent({
  name: 'salesAgent',
  voice: 'sage',
  handoffDescription: 'Handles sales inquiries and promotions.',
  instructions: 'Provide product recommendations and promos (placeholder).',
  tools: [
    tool({
      name: 'lookupNewSales',
      description: 'List current sales for a category',
      parameters: {
        type: 'object',
        properties: { category: { type: 'string' } },
        required: ['category'],
        additionalProperties: false,
      },
      execute: async () => ({ sales: [] }),
    }),
  ],
  handoffs: [],
});
