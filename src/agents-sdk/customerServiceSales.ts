import { RealtimeAgent, tool } from '@openai/agents-core/realtime';
import { z } from 'zod';

// Simple lookupNewSales tool stub (matches original sales agent behaviour)

const LookupNewSalesInput = z.object({
  category: z.string(),
});

const lookupNewSalesTool = tool<typeof LookupNewSalesInput, unknown, { items: string[] }>(
  {
    name: 'lookupNewSales',
    description: 'Retrieve current promotions or sale items for a given category.',
    parameters: LookupNewSalesInput,
    strict: true,
    async execute({ category }) {
      console.log('[toolLogic] calling lookupNewSales()', category);
      return {
        items: [`50% off demo board in ${category}`],
      };
    },
  },
);

export const salesAgent = new RealtimeAgent({
  name: 'sales',
  voice: 'ash',
  handoffDescription: 'Sales specialist for gear recommendations.',
  instructions:
    'You are a sales specialist. Identify user needs and suggest the best gear and promotions.',
  tools: [lookupNewSalesTool],
  handoffs: [], // to be wired later
});
