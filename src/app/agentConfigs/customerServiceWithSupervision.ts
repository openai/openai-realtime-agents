import { RealtimeAgent, tool } from '@openai/agents-core/realtime';

/*
 * Very lightweight port of the “junior agent + supervisor” pattern.
 *
 * The goal is just to unblock compilation; the real business logic (and
 * high-quality prompting) can be refined later.
 */

// ---------------------------------------------------------------------------
// Supervisor side helper – returns canned responses for now.
// ---------------------------------------------------------------------------

async function runSupervisorLLM(context: string) {
  // Placeholder – in production this would call the /api/responses route
  // with full conversation history and available tool set.
  return {
    message:
      `# Message\nThis is a stubbed supervisor response summarising: '${context.slice(
        0,
        50,
      )}'...`,
  };
}

// Tool exposed to the *junior* agent that invokes the supervisor.
import { z } from 'zod';

const GetNextResponseInput = z.object({
  relevantContextFromLastUserMessage: z.string(),
});

const getNextResponseTool = tool({
  name: 'getNextResponse',
  description:
    'Delegates decision-making to a senior supervisor agent and returns the next assistant response.',
  parameters: GetNextResponseInput,
  strict: true,
  async execute({ relevantContextFromLastUserMessage }) {
    return runSupervisorLLM(relevantContextFromLastUserMessage);
  },
});

export const juniorAgent = new RealtimeAgent({
  name: 'mainAgent',
  voice: 'ash',
  handoffDescription: 'Junior customer-service agent for NewTelco.',
  instructions:
    "You are a brand-new, extremely professional junior customer-service agent for NewTelco.  For non-trivial queries you MUST call getNextResponse (which internally contacts your supervisor) before responding. Greet customers with ‘Hi, you've reached NewTelco, how can I help you?’ and keep answers concise.",
  tools: [getNextResponseTool],
  handoffs: [],
});

// Supervisor is *not* directly exposed to end-users but we still model it so
// that future hand-offs could occur.
export const supervisorAgent = new RealtimeAgent({
  name: 'supervisorAgent',
  voice: 'ash',
  handoffDescription: 'Hidden supervisor that can look up policies and account info.',
  instructions:
    'You are a senior supervisor with access to internal tools and full conversation context.  Provide high-quality answers for the junior agent to relay to the user.',
  tools: [],
  handoffs: [juniorAgent],
});

export const customerServiceWithSupervisionScenario = [juniorAgent, supervisorAgent];
