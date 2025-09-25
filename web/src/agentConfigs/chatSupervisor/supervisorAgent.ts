import { RealtimeItem, tool } from '@openai/agents/realtime';

// Minimal sample data placeholders
const exampleAccountInfo = { account_id: 'ACC-123', balance_usd: 42.5 };
const examplePolicyDocs = [
  {
    id: 'ID-001',
    name: 'Sample Policy',
    topic: 'general',
    content: 'Sample content.',
  },
];
const exampleStoreLocations = [
  { id: 'STORE-1', zip: '98101', name: 'Downtown Store' },
];

export const supervisorAgentInstructions = `You are a supervisor providing guidance.`;

export const supervisorAgentTools = [
  {
    type: 'function',
    name: 'lookupPolicyDocument',
    description: 'Lookup internal documents and policies by topic.',
    parameters: {
      type: 'object',
      properties: { topic: { type: 'string' } },
      required: ['topic'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'getUserAccountInfo',
    description: 'Get user account information.',
    parameters: {
      type: 'object',
      properties: { phone_number: { type: 'string' } },
      required: ['phone_number'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'findNearestStore',
    description: 'Find nearest store by zip.',
    parameters: {
      type: 'object',
      properties: { zip_code: { type: 'string' } },
      required: ['zip_code'],
      additionalProperties: false,
    },
  },
];

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });
  if (!response.ok) return { error: 'Something went wrong.' };
  return response.json();
}

function getToolResponse(name: string) {
  switch (name) {
    case 'getUserAccountInfo':
      return exampleAccountInfo;
    case 'lookupPolicyDocument':
      return examplePolicyDocs;
    case 'findNearestStore':
      return exampleStoreLocations;
    default:
      return { result: true };
  }
}

async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void
) {
  let current = response;
  while (true) {
    if (current?.error) return { error: 'Something went wrong.' };
    const output: any[] = current.output ?? [];
    const functionCalls = output.filter((i) => i.type === 'function_call');
    if (functionCalls.length === 0) {
      const assistantMessages = output.filter((i) => i.type === 'message');
      const final = assistantMessages
        .map((m: any) =>
          (m.content ?? [])
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('')
        )
        .join('\n');
      return final;
    }
    for (const fc of functionCalls) {
      const args = JSON.parse(fc.arguments || '{}');
      const toolRes = getToolResponse(fc.name);
      addBreadcrumb?.(`[supervisorAgent] function call: ${fc.name}`, args);
      addBreadcrumb?.(
        `[supervisorAgent] function call result: ${fc.name}`,
        toolRes
      );
      body.input.push(
        {
          type: 'function_call',
          call_id: fc.call_id,
          name: fc.name,
          arguments: fc.arguments,
        },
        {
          type: 'function_call_output',
          call_id: fc.call_id,
          output: JSON.stringify(toolRes),
        }
      );
    }
    current = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description:
    'Determines the next response using a higher-level supervisor agent.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'Key info from the most recent user message.',
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };
    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;
    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((h) => h.type === 'message');

    const body: any = {
      model: 'gpt-4.1',
      input: [
        {
          type: 'message',
          role: 'system',
          content: supervisorAgentInstructions,
        },
        {
          type: 'message',
          role: 'user',
          content: `History: ${JSON.stringify(
            filteredLogs
          )}\nLast: ${relevantContextFromLastUserMessage}`,
        },
      ],
      tools: supervisorAgentTools,
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) return { error: 'Something went wrong.' };
    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) return { error: 'Something went wrong.' };
    return { nextResponse: finalText as string };
  },
});
