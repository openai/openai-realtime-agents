import { RealtimeItem, tool } from '@openai/agents/realtime';
import { computeKpis, assignProsperLevels, generateRecommendations } from '@/app/lib/prosperTools';

async function getHouseholdIdClient(): Promise<string> {
  try {
    const fromLS = localStorage.getItem("pp_household_id");
    if (fromLS) return fromLS;
  } catch {}
  try {
    const res = await fetch("/api/household/init", { cache: "no-store" });
    const data = await res.json();
    if (data?.id) {
      try { localStorage.setItem("pp_household_id", data.id); } catch {}
      return data.id;
    }
  } catch {}
  return "PP-HH-0001"; // final fallback
}

// ---------- Responses API wrapper ----------
async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });
  if (!response.ok) return { error: 'Something went wrong.' };
  return response.json();
}

let lastInputs: any = null;
let lastKpis: any = null;
let lastLevels: any = null;
let lastProvisional: string[] = [];

// Persist snapshot
async function persistSnapshot(extra: any = {}) {
  const householdId = await getHouseholdIdClient();
  const payload = {
    householdId,
    inputs: lastInputs || {},
    kpis: lastKpis || {},
    levels: lastLevels || {},
    provisional_keys: lastProvisional || [],
    ...extra,
  };
  try {
    await fetch('/api/prosper/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

async function handleToolCalls(body: any, response: any, addBreadcrumb?: (title: string, data?: any) => void) {
  let currentResponse = response;
  while (true) {
    if (currentResponse?.error) return { error: 'Something went wrong.' } as any;

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      const assistantMessages = outputItems.filter((item) => item.type === 'message');
      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');
      return finalText;
    }

    for (const toolCall of functionCalls) {
      const fName = toolCall.name as string;
      const args = JSON.parse(toolCall.arguments || '{}');
      let toolRes: any = {};

      switch (fName) {
        case 'computeKpis': {
          lastInputs = args?.inputs || {};
          const res = computeKpis(lastInputs);
          lastKpis = res.kpis;
          lastProvisional = res.provisional_keys || [];
          toolRes = { kpis: lastKpis, provisional: lastProvisional };
          await persistSnapshot();
          break;
        }
        case 'assignProsperLevels': {
          const kpis = args?.kpis || lastKpis || {};
          lastLevels = assignProsperLevels(kpis);
          toolRes = lastLevels;
          await persistSnapshot();
          break;
        }
        case 'generateRecommendations': {
          const kpis = args?.kpis || lastKpis || {};
          const levels = args?.levels || lastLevels || {};
          const prefs = args?.preferences || {};
          const recs = generateRecommendations(kpis, levels, prefs);
          toolRes = recs;
          await persistSnapshot({ recommendations: recs });
          break;
        }
        default:
          toolRes = { ok: true };
      }

      if (addBreadcrumb) addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      if (addBreadcrumb) addBreadcrumb(`[supervisorAgent] function call result: ${fName}`, toolRes);

      body.input.push(
        { type: 'function_call', call_id: toolCall.call_id, name: toolCall.name, arguments: toolCall.arguments },
        { type: 'function_call_output', call_id: toolCall.call_id, output: JSON.stringify(toolRes) },
      );
    }

    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description: 'Returns the next message for the chat agent to read verbatim.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: { type: 'string' },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input: any, details: any) => {
    const relevantContextFromLastUserMessage: string =
      (input && input.relevantContextFromLastUserMessage) || '';

    const addBreadcrumb =
      details?.context?.addTranscriptBreadcrumb as
        | ((title: string, data?: any) => void)
        | undefined;

    const history: RealtimeItem[] = (details?.context?.history ?? []) as RealtimeItem[];
    const filteredLogs = history.filter((log) => log.type === 'message');

    const body: any = {
      model: 'gpt-4.1',
      input: [
        { type: 'message', role: 'system', content: supervisorAgentInstructions },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
${JSON.stringify(filteredLogs, null, 2)}

==== Most Recent User Message ====
${relevantContextFromLastUserMessage}`,
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'computeKpis',
          description: 'Calculate household KPIs from MQS-14 inputs',
          parameters: { type: 'object', properties: { inputs: { type: 'object', additionalProperties: true } }, required: ['inputs'] },
        },
        {
          type: 'function',
          name: 'assignProsperLevels',
          description: 'Map KPIs to pillar scores and overall level',
          parameters: { type: 'object', properties: { kpis: { type: 'object', additionalProperties: true } }, required: ['kpis'] },
        },
        {
          type: 'function',
          name: 'generateRecommendations',
          description: 'Generate prioritized actions based on gating pillar',
          parameters: {
            type: 'object',
            properties: {
              kpis: { type: 'object', additionalProperties: true },
              levels: { type: 'object', additionalProperties: true },
              preferences: { type: 'object', additionalProperties: true },
            },
            required: ['kpis', 'levels'],
          },
        },
      ],
    };

    const response = await fetchResponsesMessage(body);
    return await handleToolCalls(body, response, addBreadcrumb);
  },
});

export const supervisorAgentInstructions = `I am Prosper, the Supervisor Agent behind the scenes. I compute KPIs, assign levels, and draft short, prioritized actions. I always speak in first person because the chat agent reads my words verbatim.`;
