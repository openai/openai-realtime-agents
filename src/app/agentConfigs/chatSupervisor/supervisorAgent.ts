// ================================================
// FILE: src/app/agentConfigs/chatSupervisor/supervisorAgent.ts
// ================================================
"use client";

import { RealtimeItem, tool } from "@openai/agents/realtime";
import { computeKpis, assignProsperLevels, generateRecommendations } from "@/app/lib/prosperTools";

/** Always prefer the server cookie so writes == reads */
async function getHouseholdIdClient(): Promise<string> {
  try {
    const res = await fetch("/api/household/init", { cache: "no-store" });
    const data = await res.json();
    if (data?.id) {
      try { localStorage.setItem("pp_household_id", data.id); } catch {}
      return data.id as string;
    }
  } catch {}
  // Fallback to localStorage; generate a uuid if needed
  let id = "";
  try { id = localStorage.getItem("pp_household_id") || ""; } catch {}
  if (!id) {
    id = (typeof crypto !== "undefined" && (crypto as any).randomUUID?.())
      || Math.random().toString(36).slice(2);
    try { localStorage.setItem("pp_household_id", id); } catch {}
  }
  return id;
}

// ---------- Responses API wrapper ----------
async function fetchResponsesMessage(body: any) {
  const response = await fetch("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });
  if (!response.ok) return { error: "Something went wrong." };
  return response.json();
}

let lastInputs: Record<string, any> | null = null;
let lastKpis: any = null;
let lastLevels: any = null;
let lastProvisional: string[] = [];

// Persist snapshot (skip if we still have no inputs)
async function persistSnapshot(extra: any = {}) {
  if (!lastInputs || Object.keys(lastInputs).length === 0) {
    console.info("[persistSnapshot] skipped (no inputs yet)");
    return;
  }
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
    const res = await fetch("/api/prosper/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) console.error("[persistSnapshot] failed", json);
    else console.info("[persistSnapshot] ok", { created: json?.created_at, id: json?.id });
  } catch (err) {
    console.error("[persistSnapshot] network error", err);
  }
}

async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
  lastUserText?: string
) {
  let currentResponse = response;
  while (true) {
    if (currentResponse?.error) return { error: "Something went wrong." } as any;

    const outputItems: any[] = currentResponse.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === "function_call");

    if (functionCalls.length === 0) {
      const assistantMessages = outputItems.filter((item) => item.type === "message");
      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === "output_text")
            .map((c: any) => c.text)
            .join("");
        })
        .join("\n");
      return finalText;
    }

    for (const toolCall of functionCalls) {
      const fName = toolCall.name as string;
      const args = JSON.parse(toolCall.arguments || "{}");
      let toolRes: any = {};

      switch (fName) {
        case "computeKpis": {
          // MERGE rather than overwrite
          const incoming: Record<string, any> = args?.inputs || {};
          lastInputs = { ...(lastInputs || {}), ...incoming };

          if (Object.keys(lastInputs).length === 0) {
            // Guard: never persist an empty inputs snapshot
            if (addBreadcrumb) addBreadcrumb("[supervisorAgent] computeKpis skipped: no inputs", { incoming, lastUserText });
            toolRes = { skipped: true, reason: "no_inputs" };
            break;
          }

          const res = computeKpis(lastInputs);
          lastKpis = res.kpis;
          lastProvisional = res.provisional_keys || [];
          toolRes = { kpis: lastKpis, provisional: lastProvisional, inputs: lastInputs };
          await persistSnapshot();
          break;
        }

        case "assignProsperLevels": {
          const kpis = args?.kpis || lastKpis || {};
          lastLevels = assignProsperLevels(kpis);
          toolRes = lastLevels;
          await persistSnapshot();
          break;
        }

        case "generateRecommendations": {
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
        { type: "function_call", call_id: toolCall.call_id, name: toolCall.name, arguments: toolCall.arguments },
        { type: "function_call_output", call_id: toolCall.call_id, output: JSON.stringify(toolRes) }
      );
    }

    currentResponse = await fetchResponsesMessage(body);
  }
}

// Expose a single tool the chat agent calls each turn
export const getNextResponseFromSupervisor = tool({
  name: "getNextResponseFromSupervisor",
  description: "Returns the next message for the chat agent to read verbatim.",
  parameters: {
    type: "object",
    properties: {
      relevantContextFromLastUserMessage: { type: "string" },
    },
    required: ["relevantContextFromLastUserMessage"],
    additionalProperties: false,
  },
  execute: async (input: any, details: any) => {
    const relevantContextFromLastUserMessage: string =
      (input && input.relevantContextFromLastUserMessage) || "";

    const addBreadcrumb =
      details?.context?.addTranscriptBreadcrumb as
        | ((title: string, data?: any) => void)
        | undefined;

    const history: RealtimeItem[] = (details?.context?.history ?? []) as RealtimeItem[];
    const filteredLogs = history.filter((log) => log.type === "message");

    // Include known inputs so the model *always* sends the merged map
    const knownInputsBlock = `==== Known Inputs So Far ====
${JSON.stringify(lastInputs || {}, null, 2)}\n`;

    const body: any = {
      model: "gpt-4.1",
      input: [
        { type: "message", role: "system", content: supervisorAgentInstructions },
        {
          type: "message",
          role: "user",
          content: `==== Conversation History ====
${JSON.stringify(filteredLogs, null, 2)}

${knownInputsBlock}
==== Most Recent User Message ====
${relevantContextFromLastUserMessage}`,
        },
      ],
      tools: [
        {
          type: "function",
          name: "computeKpis",
          description: "Calculate household KPIs from MQS-14 inputs",
          parameters: {
            type: "object",
            properties: { inputs: { type: "object", additionalProperties: true } },
            required: ["inputs"],
          },
        },
        {
          type: "function",
          name: "assignProsperLevels",
          description: "Map KPIs to pillar scores and overall level",
          parameters: {
            type: "object",
            properties: { kpis: { type: "object", additionalProperties: true } },
            required: ["kpis"],
          },
        },
        {
          type: "function",
          name: "generateRecommendations",
          description: "Generate prioritized actions based on gating pillar",
          parameters: {
            type: "object",
            properties: {
              kpis: { type: "object", additionalProperties: true },
              levels: { type: "object", additionalProperties: true },
              preferences: { type: "object", additionalProperties: true },
            },
            required: ["kpis", "levels"],
          },
        },
      ],
    };

    const response = await fetchResponsesMessage(body);
    return await handleToolCalls(body, response, addBreadcrumb, relevantContextFromLastUserMessage);
  },
});

/** Beefed-up instructions (stateful + examples, and “never send empty inputs”) */
export const supervisorAgentInstructions = `
You are Prosper's Supervisor Agent. Your job is to:
1) Extract and normalise household inputs from natural language into MQS-14 keys.
2) Call tools in this order when helpful: computeKpis → assignProsperLevels → generateRecommendations.
3) Keep spoken replies concise and first-person.

IMPORTANT:
- NEVER call computeKpis with an empty {inputs:{}}. If you don't have at least one numeric field, ask a direct, specific question instead.
- When you call computeKpis, ALWAYS include the full merged set of known inputs (not just the new field).

## Input extraction (map user phrases → keys)
- "take-home pay", "net per month" → income_net_monthly (AUD/month)
- "gross per month", "pre-tax monthly" → income_gross_monthly (AUD/month)
- "rent", "mortgage payment" → housing_total_monthly (AUD/month)
- "essentials", "food+transport+utilities" → essentials_monthly (AUD/month, exclude housing & debt)
- "debt repayments" (credit cards, loans) → debt_required_payments_monthly (AUD/month)
- "emergency fund", "cash buffer" → emergency_savings_liquid (AUD)
- "investing contributions" → investment_contrib_monthly (AUD/month)
- "retirement pot now" → retirement_pot_current (AUD)
- "target retirement pot" → retirement_target_pot (AUD)

## Normalisation rules
- Convert weekly → monthly by ×4.33; annual → monthly by ÷12.
- Strip currency words/symbols and commas; accept "6.5k" → 6500.
- If unknown, omit the key (do NOT guess). Tools will mark provisional keys.

## Tool call EXAMPLES (follow the JSON exactly)
User: "Take-home is $9,000 per month."
→ call computeKpis with:
{"inputs":{"income_net_monthly":9000}}

User: "Rent is 2700; essentials are 1800; debt repayments 400."
→ call computeKpis with (MERGED):
{"inputs":{"income_net_monthly":9000,"housing_total_monthly":2700,"essentials_monthly":1800,"debt_required_payments_monthly":400}}

User: "Emergency fund 15k; investing 600/month."
→ call computeKpis with (MERGED):
{"inputs":{"income_net_monthly":9000,"housing_total_monthly":2700,"essentials_monthly":1800,"debt_required_payments_monthly":400,"emergency_savings_liquid":15000,"investment_contrib_monthly":600}}

After you have KPIs:
- call assignProsperLevels({"kpis": <latest_kpis>})
- then, when at least two KPIs are known, call generateRecommendations({"kpis": <latest_kpis>, "levels": <levels>})

## How to speak
- After each tool call, briefly tell the user what changed (e.g., "Your savings rate looks ~22% and housing is ~28% of net income.").
- Ask only for missing 'provisional' fields next, one or two at a time.
- Never mention tool names or internal details.
`;
