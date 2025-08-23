import { RealtimeItem, tool } from '@openai/agents/realtime';

/**
 * Supervisor Agent (Prosper)
 * - First-person voice. Chat agent reads my replies verbatim.
 * - Calls domain tools: computeKpis → assignProsperLevels → (optionally) generateRecommendations.
 * - Returns concise, voice-friendly messages.
 */

// ---------- Demo tool outputs (replace with real services in prod) ----------
const demoKpis = {
  savings_rate_net: 0.18,
  savings_rate_gross: 0.14,
  dti: 0.24,
  housing_ratio: 0.27,
  ef_months: 3.5,
  liquidity_ratio: 0.9,
  allocation: { cash: 0.15, bonds: 0.15, equities: 0.65, other: 0.05 },
  retirement: { target_pot: 600000, projected_pot: 420000, rr: 0.70 },
  provisional: { investment_contrib_monthly: false, retirement_spend_annual_desired: true },
};

const demoLevels = {
  pillars: {
    spend:   { score: 45, level: 'L4' },
    save:    { score: 48, level: 'L4' },
    borrow:  { score: 37, level: 'L3', notes: 'High-APR penalty applied' },
    protect: { score: 20, level: 'L2', provisional: true },
    grow:    { score: 43, level: 'L4' },
  },
  overall: { level: 'L3', provisional: true },
  gating_pillar: 'protect',
  checklist: ['Add income protection', 'Set life cover ≈ 10× annual income'],
  eta_weeks: 8,
};

const demoRecs = {
  next_30_days: [
    'Move payday transfers to the morning of payday (+$250/mo; Save +12 → L3→L4)',
    'Request quotes for income protection (Protect +20 → L2→L4)',
  ],
  months_1_to_3: [
    'Refinance 23% APR card to <10% (Borrow +15)',
    'Create sinking fund for known expenses ($150/mo)',
  ],
  months_3_to_12: [
    'Increase contributions by +2–3pp of net income',
    'Fee audit: switch to low-cost trackers (save ~$300/yr)',
  ],
  long_term: [
    'Annual rebalance ±5% bands',
    'Review wills/guardianship once per year',
  ],
};

// Local “router” for demo: swap with real HTTP calls later.
function getToolResponse(name: string): unknown {
  switch (name) {
    case 'computeKpis': return demoKpis;
    case 'assignProsperLevels': return demoLevels;
    case 'generateRecommendations': return demoRecs;
    default: return { ok: true };
  }
}

// ---------- System prompt with first 3 conversation states ----------
export const supervisorAgentInstructions = `I am Prosper, the Supervisor Agent behind the scenes. I generate the numbers and plan while the chat agent keeps the conversation flowing. I always speak in the first person because my words are read verbatim.

# Conversation States (first 3)
[
  {
    "id": "1_discovery_adaptive",
    "description": "Adaptive intake: introductions → getting-to-know-you → MQS-14 financial snapshot.",
    "instructions": [
      "If I’m invoked early and sufficiency is not met, I ask for the smallest missing items (1–2 at a time).",
      "I start with getting-to-know-you, then gather MQS fields with ranges permitted; I label estimates as provisional.",
      "I repeat back names/emails/phone numbers exactly to confirm."
    ],
    "transitions": [
      { "next_step": "2_calculate_kpis", "condition": "Sufficiency met and the couple consents to compute." }
    ]
  },
  {
    "id": "2_calculate_kpis",
    "description": "Compute core KPIs with provisional flags as needed.",
    "instructions": [
      "Call computeKpis with the MQS intake.",
      "Return a short, first-person summary (e.g., savings rate, EF months, DTI, housing).",
      "Flag provisional inputs and invite corrections if needed."
    ],
    "transitions": [
      { "next_step": "3b_level_assignment_5p10l", "condition": "After KPIs are computed." }
    ]
  },
  {
    "id": "3b_level_assignment_5p10l",
    "description": "Assign pillar scores (Spend, Save, Borrow, Protect, Grow) and 10-level mapping; compute overall with gates/boosters.",
    "instructions": [
      "Call assignProsperLevels with the KPIs.",
      "Explain the overall level, the gating pillar, and a small next-level checklist with ETA."
    ],
    "transitions": [
      { "next_step": "4_recommendations", "condition": "On request or if ready for actions." }
    ]
  }
]

# Mission
I give concise, voice-friendly messages in first person. I call tools to compute KPIs, assign Prosper Path levels, and (optionally) generate a short, prioritized action plan. Educational support only—no regulated advice.

# Intake & Proactivity
- If required inputs are missing, I ask for exactly 1–2 items at a time (start with getting-to-know-you before financials). I accept ranges and label estimates as provisional.
- I do NOT call tools with placeholders; I ask for the specific values first.

# Computation & Coaching
- When sufficiency is met: computeKpis → assignProsperLevels → (optionally) generateRecommendations.
- I keep replies to 2–4 sentences, in first person, and read cleanly in voice.

# Outputs
- KPI/Level: “Emergency fund is ~3.5 months; savings rate ~18%. That puts us at Level L3 overall, gated by Protect (provisional). To level up, I suggest…”
- Recommendations: smallest quantified set to lift the gating pillar by ≥10 points.
`;

// ---------- Tool schemas used by the supervisor ----------
export const supervisorAgentTools = [
  {
    type: 'function',
    name: 'computeKpis',
    description: 'Calculate household KPIs from MQS-14 inputs; return values with provisional flags if ranges/heuristics were used.',
    parameters: {
      type: 'object',
      properties: {
        inputs: { type: 'object', additionalProperties: true, description: 'MQS-14 intake object.' },
      },
      required: ['inputs'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'assignProsperLevels',
    description: 'Map KPIs to 5 pillar scores (Spend, Save, Borrow, Protect, Grow) with 10 micro-levels (L0–L9); compute overall level using gates/boosters.',
    parameters: {
      type: 'object',
      properties: {
        kpis: { type: 'object', additionalProperties: true },
      },
      required: ['kpis'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'generateRecommendations',
    description: 'Produce a prioritized action plan linked to the gating pillar, with quantified impact and ETA where possible.',
    parameters: {
      type: 'object',
      properties: {
        kpis: { type: 'object', additionalProperties: true },
        levels: { type: 'object', additionalProperties: true },
        preferences: { type: 'object', additionalProperties: true },
      },
      required: ['kpis', 'levels'],
      additionalProperties: false,
    },
  },
];

// ---------- Responses API wrapper ----------
async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }), // keep sequential tool calls
  });
  if (!response.ok) {
    console.warn('Server returned an error:', response);
    return { error: 'Something went wrong.' };
  }
  return response.json();
}

// ---------- Tool-call resolver loop ----------
async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
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

      // In a real build, dispatch to your services with `args`.
      const toolRes = getToolResponse(fName);

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

// ---------- Public tool exposed to the chat agent ----------
export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description:
    'Determines the next response whenever the chat agent faces a non-trivial decision. Returns a concise first-person message the chat agent should read verbatim.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description:
          "Key information from the most recent user message (the supervisor may not have direct access to it). Keep this concise; it's okay to be empty if nothing new.",
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (
    input: { relevantContextFromLastUserMessage: string },
    details: { context?: { addTranscriptBreadcrumb?: (title: string, data?: any) => void; history?: RealtimeItem[] } },
  ) => {
    const { relevantContextFromLastUserMessage } = input;
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb;

    const history: RealtimeItem[] = details?.context?.history ?? [];
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

==== Relevant Context From Last User Message ===
${relevantContextFromLastUserMessage}
`,
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
