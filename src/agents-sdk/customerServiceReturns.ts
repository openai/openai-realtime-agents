import { z } from 'zod';
import { RealtimeAgent, tool } from '@openai/agents-core/realtime';

/*
 * Partial migration of the Retail Returns agent – focuses on the lookupOrders
 * function. Additional tools will be ported in subsequent steps.
 */

// -------------------- Tool: lookupOrders --------------------
const LookupOrdersInput = z.object({
  phoneNumber: z.string(),
});

type LookupOrdersInput = z.infer<typeof LookupOrdersInput>;

interface Item {
  item_id: string;
  item_name: string;
  retail_price_usd: number;
}

interface Order {
  order_id: string;
  order_date: string;
  delivered_date: string | null;
  order_status: string;
  subtotal_usd: number;
  total_usd: number;
  items: Item[];
}

const lookupOrdersTool = tool({
    name: 'lookupOrders',
    description:
      'Retrieve detailed order information using the user’s phone number.',
    parameters: LookupOrdersInput,
    strict: true,
    async execute({ phoneNumber }) {
      console.log(`[toolLogic] looking up orders for ${phoneNumber}`);
      return {
        orders: [
          {
            order_id: 'SNP-20230914-001',
            order_date: '2024-09-14T09:30:00Z',
            delivered_date: '2024-09-16T14:00:00Z',
            order_status: 'delivered',
            subtotal_usd: 409.98,
            total_usd: 471.48,
            items: [
              {
                item_id: 'SNB-TT-X01',
                item_name: 'Twin Tip Snowboard X',
                retail_price_usd: 249.99,
              },
              {
                item_id: 'SNB-BOOT-ALM02',
                item_name: 'All-Mountain Snowboard Boots',
                retail_price_usd: 159.99,
              },
            ],
          },
        ],
      };
    },
  },
);

// -------------------- Tool: retrievePolicy --------------------

const RetrievePolicyInput = z.object({
  region: z.string(),
  itemCategory: z.string(),
});

type RetrievePolicyInput = z.infer<typeof RetrievePolicyInput>;

const retrievePolicyTool = tool({
  name: 'retrievePolicy',
  description: 'Retrieve internal store policies; return raw policy text.',
  parameters: RetrievePolicyInput,
  strict: true,
  async execute({ region, itemCategory }) {
    // For now, return a sample text similar to original toolLogic
    return `Return Window: 30 days for region ${region}. Category ${itemCategory} subject to standard restocking fee. Full policy lorem ipsum.`;
  },
});

// -------------------- Tool: checkEligibilityAndPossiblyInitiateReturn --------------------

const CheckEligibilityInput = z.object({
  userDesiredAction: z.string(),
  question: z.string(),
});

type CheckEligibilityInput = z.infer<typeof CheckEligibilityInput>;

const checkEligibilityTool = tool({
  name: 'checkEligibilityAndPossiblyInitiateReturn',
  description: 'Check eligibility of proposed return and initiate if allowed.',
  parameters: CheckEligibilityInput,
  strict: true,
  async execute({ userDesiredAction, question }) {
    console.log('[toolLogic] checking eligibility', userDesiredAction, question);
    // Simplified mock: always eligible
    return {
      eligible: true,
      reason: 'Mock eligibility check passed',
    };
  },
});

// -------------------- Agent definition --------------------

export const returnsAgent = new RealtimeAgent({
  name: 'returns',
  voice: 'ash',
  instructions:
    'You are a returns specialist for Snowy Peak Boards. Begin by understanding the order details and asking for a phone number to look up orders.',
  tools: [lookupOrdersTool, retrievePolicyTool, checkEligibilityTool],
  handoffs: [],
  handoffDescription: 'Customer Service Agent specialized in returns.',
});
