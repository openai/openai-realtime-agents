// ================================================
// FILE: src/app/agentConfigs/chatSupervisor/supervisorAgent.ts
// ================================================
"use client";

import { RealtimeItem, tool } from "@openai/agents/realtime";
import { computeKpis, assignProsperLevels, generateRecommendations } from "@/app/lib/prosperTools";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { normaliseCurrency, conflictCheck } from "@/app/lib/validate";

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
let lastSlots: Slots | null = null;
let lastEntitlements: any = null;
let lastUsage: { free_limit?: number; used?: number; remaining?: number } | null = null;

// ------- v2 helpers: sufficiency + inputs→slots fallback -------
function missingForSufficiencyV2(inputs: Record<string, any>, slots?: any): string[] {
  // Need: income (net or gross), essential_expenses_monthly, housing (total/rent/mortgage), debt repayments, emergency savings
  const m: string[] = [];
  const hasNet = Number.isFinite(inputs?.income_net_monthly) || Number.isFinite(slots?.net_income_monthly_self?.value);
  const hasGross = Number.isFinite(inputs?.income_gross_monthly) || Number.isFinite(slots?.gross_income_annual_self?.value);
  if (!hasNet && !hasGross) m.push('income (net or gross)');

  const hasEss = Number.isFinite(inputs?.essential_expenses_monthly) || Number.isFinite(inputs?.essentials_monthly) || Number.isFinite(slots?.essential_expenses_monthly?.value);
  if (!hasEss) m.push('essential_expenses_monthly');

  const hasHousing = Number.isFinite(inputs?.housing_total_monthly) || Number.isFinite(slots?.rent_monthly?.value) || Number.isFinite(slots?.mortgage_payment_monthly?.value);
  if (!hasHousing) m.push('housing_total_monthly (or rent/mortgage)');

  const hasDebtPmts = Number.isFinite(inputs?.debt_required_payments_monthly) || Number.isFinite(slots?.other_debt_payments_monthly_total?.value);
  if (!hasDebtPmts) m.push('debt_required_payments_monthly');

  const hasEmergency = Number.isFinite(inputs?.emergency_savings_liquid) || Number.isFinite(slots?.cash_liquid_total?.value);
  if (!hasEmergency) m.push('emergency_savings_liquid');

  return m;
}

function inputsToSlotsFallback(inputs: Record<string, any>): Slots {
  // Best-effort mapping from MQS-style inputs to v2 slot schema
  const grossAnnual = Number.isFinite(inputs?.income_gross_monthly) ? inputs.income_gross_monthly * 12 : undefined;
  const netMonthly = Number.isFinite(inputs?.income_net_monthly) ? inputs.income_net_monthly : undefined;
  const essentials = Number.isFinite(inputs?.essentials_monthly) ? inputs.essentials_monthly : undefined;
  const housingTotal = Number.isFinite(inputs?.housing_total_monthly) ? inputs.housing_total_monthly : undefined;
  const debtPmts = Number.isFinite(inputs?.debt_required_payments_monthly) ? inputs.debt_required_payments_monthly : undefined;
  const liquid = Number.isFinite(inputs?.emergency_savings_liquid) ? inputs.emergency_savings_liquid : undefined;

  const slots: Slots = {};
  if (netMonthly != null) slots.net_income_monthly_self = { value: netMonthly, confidence: 'med' } as any;
  if (grossAnnual != null) slots.gross_income_annual_self = { value: grossAnnual, confidence: 'med' } as any;
  if (essentials != null) slots.essential_expenses_monthly = { value: essentials, confidence: 'med' } as any;
  if (housingTotal != null) {
    // Without status, map to rent by default; still useful for HR
    slots.rent_monthly = { value: housingTotal, confidence: 'low' } as any;
  }
  if (debtPmts != null) slots.other_debt_payments_monthly_total = { value: debtPmts, confidence: 'med' } as any;
  if (liquid != null) slots.cash_liquid_total = { value: liquid, confidence: 'med' } as any;
  return slots;
}

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
    else {
      console.info("[persistSnapshot] ok", { created: json?.created_at, id: json?.id });
      try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { id: json?.id, created_at: json?.created_at } })); } catch {}
    }
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
      let args: any = {};
      try {
        args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
      } catch (e) {
        if (addBreadcrumb) addBreadcrumb(`[supervisorAgent] bad tool args for ${fName}`, { raw: toolCall.arguments });
        args = {};
      }
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

          // Prefer slots from tracker; fallback to mapping from lastInputs
          const slotsForCompute: Slots = lastSlots || inputsToSlotsFallback(lastInputs);
          const missing = missingForSufficiencyV2(lastInputs || {}, slotsForCompute);
            if (missing.length > 0) {
              toolRes = { skipped: true, reason: "insufficient_fields", missing };
              if (addBreadcrumb) addBreadcrumb("[supervisorAgent] v2 compute skipped: insufficient", { missing });
              break;
            }
            // ensure slots get persisted inside inputs for traceability
            lastInputs = { ...(lastInputs || {}), slots: slotsForCompute };
          const { kpis, gates, normalized, provisional } = computeKpisV2(slotsForCompute);
          lastKpis = { ...kpis, gates, engine_version: 'v2' };
          lastProvisional = provisional || [];
          const cur = normaliseCurrency((slotsForCompute as any)?.country?.value ?? null);
          (lastInputs as any).currency = cur.code;
          const conflicts = conflictCheck(slotsForCompute);
          toolRes = { kpis: lastKpis, provisional: lastProvisional, slots: slotsForCompute, currency: cur, conflicts };
          const nw = (normalized as any)?.net_worth;
          const extra = Number.isFinite(nw) ? { net_worth_point: { value: nw } } : {};
          await persistSnapshot(extra);
          break;
        }

        case "assignProsperLevels": {
          const kpis = args?.kpis || lastKpis || {};
          if (true) {
            const gates = lastKpis?.gates || {};
            lastLevels = assignLevelsV2(kpis, gates);
            (lastLevels as any).engine_version = 'v2';
          }
          toolRes = lastLevels;
          await persistSnapshot();
          break;
        }

        case "generateRecommendations": {
          const kpis = args?.kpis || lastKpis || {};
          const levels = args?.levels || lastLevels || {};
          const prefs = args?.preferences || {};
          let recs: any;
          if (true) {
            const { generateTwoBestActions } = await import("@/app/lib/recommendationsV2");
            recs = generateTwoBestActions(kpis, (lastKpis?.gates || {}));
          } else {
            recs = generateRecommendations(kpis, levels, prefs);
          }
          toolRes = recs;
          await persistSnapshot({ recommendations: recs });
          break;
        }

        case "saveContact": {
          const email = (args?.email || '').toString().trim();
          const name = (args?.name || '').toString().trim();
          const updates: any = {};
          if (email) updates.email = email;
          if (name) updates.full_name = name;
          if (!lastInputs) lastInputs = {};
          lastInputs = { ...lastInputs, ...updates };
          try {
            if (email) {
              const s: any = (lastInputs as any).slots || {};
              s.email = { value: email, confidence: 'high' };
              (lastInputs as any).slots = s;
            }
          } catch {}
          // Mirror to households table (best-effort)
          try {
            const hh = await getHouseholdIdClient();
            await fetch('/api/household/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ householdId: hh, email, full_name: name }),
            });
          } catch {}
          toolRes = { ok: true, saved: Object.keys(updates) };
          await persistSnapshot();
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
    // Rehydrate once from server so returning users don't start from scratch
    try {
      if (!lastInputs) {
        const hh = await getHouseholdIdClient();
        if (hh) {
          const r = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(hh)}`, { cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            const snap = d?.latestSnapshot || null;
            if (snap) {
              lastInputs = snap.inputs || {};
              lastKpis = snap.kpis || null;
              lastLevels = snap.levels || null;
              if ((lastInputs as any)?.slots) lastSlots = (lastInputs as any).slots as Slots;
            }
            lastEntitlements = d?.entitlements || null;
            lastUsage = d?.usage || null;
          }
        }
      }
    } catch {}

    const knownInputsBlock = `==== Known Inputs So Far ====
${JSON.stringify(lastInputs || {}, null, 2)}\n`;

    // Try to parse a tracker JSON to build slots (v2)
    try {
      const m = relevantContextFromLastUserMessage.match(/tracker\s*=\s*(\{[\s\S]*\})/i);
      if (m) {
        const jsonStr = m[1];
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.slots) {
          lastSlots = parsed.slots as Slots;
        }
      }
    } catch {}

    // Metered paywall: stop if free usage exhausted (requires NEXT_PUBLIC_METERED_PAYWALL=1)
    try {
      const METERED = process?.env?.NEXT_PUBLIC_METERED_PAYWALL === '1';
      if (METERED) {
        const hh = await getHouseholdIdClient();
        if (!lastEntitlements || !lastUsage) {
          const r = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(hh)}`, { cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            lastEntitlements = d?.entitlements || null;
            lastUsage = d?.usage || null;
          }
        }
        const isFree = !lastEntitlements || (lastEntitlements?.plan !== 'premium');
        const remaining = Math.max(0, Number(lastUsage?.remaining ?? 0));
        if (isFree && remaining <= 0) {
          let checkoutUrl = '';
          try {
            const email = (lastInputs as any)?.slots?.email?.value || (lastInputs as any)?.email;
            const res = await fetch('/api/billing/create-checkout-session', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ householdId: hh, email })
            });
            const j = await res.json();
            if (j?.url) checkoutUrl = j.url as string;
          } catch {}
          const premiumPitch = `Premium unlocks full net‑worth history, saved plans, deeper action checklists, and weekly progress reminders.`;
          const notice = checkoutUrl
            ? `I can keep going, but I need you to upgrade to finish a deeper assessment. ${premiumPitch}\nUpgrade here: ${checkoutUrl}`
            : `I can keep going, but I need you to upgrade to finish a deeper assessment. ${premiumPitch} You can upgrade via the Upgrade button on your dashboard.`;
          return notice;
        }
      }
    } catch {}

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
        {
          type: "function",
          name: "saveContact",
          description: "Persist contact details (email, name) to the current household snapshot.",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string" },
              name: { type: "string" }
            },
            additionalProperties: false,
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
1) Extract and normalise household data and compute KPIs/Levels.
2) Call tools in this order when helpful: computeKpis → assignProsperLevels → generateRecommendations.
3) Keep replies concise, in first-person, warm plain English.

ENGINE + DATA FLOW
- Prefer the v2 slot schema when available. The chat agent includes a tracker JSON (tracker={ householdId, slots, locale, currency }) inside the last user message. Use it.
- If v2 slots are not present, fall back to merged inputs (MQS-style) and still call computeKpis.
- NEVER call computeKpis with an empty {inputs:{}}. If you don't have at least one numeric field, ask a direct, specific question instead.
- When calling computeKpis, include the full merged set of known inputs (not just deltas). The tool will attach v2 slots to the snapshot if available.
- If the tool returns { skipped: true, reason: "insufficient_fields", missing: [...] }, do NOT try to compute. Ask for 1–2 of the missing items with short, friendly prompts and a 1‑line “why this helps”.

CONTACT CAPTURE
- After you’ve delivered clear value (e.g., KPIs/level/first actions), prompt gently: “Want me to save this and email your plan? What’s your email?”
- When the user shares an email (or a correction), immediately call saveContact({ email }) to persist it (say a filler phrase first). Confirm the address back verbatim.
- If they share a name correction, call saveContact({ name }).

RECAPS (returning users)
- When ACTION=RECAP or the user asks for a recap, read from the Known Inputs block and provide a brief summary (names/email/country if present; key amounts like income, essentials, housing, cash, debts). If very little is known, say so and suggest starting Quick Pass. Do not call tools during a recap.

SUFFICIENCY (minimal to compute a basic score)
- Need: income (net or gross), essential_expenses_monthly, housing_total_monthly, debt_required_payments_monthly, emergency_savings_liquid.
- Ranges are fine; mark as provisional.

INPUT EXTRACTION (map phrases → keys)
- MQS inputs (fallback path):
  • take-home/net per month → income_net_monthly
  • gross per month/pre-tax → income_gross_monthly
  • rent/mortgage payment → housing_total_monthly
  • essentials → essentials_monthly (exclude housing & debt)
  • debt repayments → debt_required_payments_monthly
  • emergency fund/cash buffer → emergency_savings_liquid
  • investing contributions → investment_contrib_monthly
- v2 slots (preferred when tracker is used):
  • net_income_monthly_self/partner; gross_income_annual_self/partner
  • total_expenses_monthly; essential_expenses_monthly
  • rent_monthly OR mortgage_payment_monthly; housing_running_costs_monthly
  • other_debt_payments_monthly_total; other_debt_balances_total; short_term_liabilities_12m
  • cash_liquid_total; term_deposits_le_3m; investments_ex_home_total; pension_balance_total
  • investment_properties[n]: value, mortgage_balance, net_rent_monthly, payment_monthly
  • life_insurance_sum; income_protection_has; ip_monthly_benefit; sick_pay_months_full/half; home_insured_ok
  • retire_age; birth_year; retire_target_income_annual; state_pension_est_annual; pension_contrib_pct
  • credit_score_normalised_0_1 OR { credit_provider, credit_raw_score, min, max }

NORMALISATION RULES
- Convert weekly → monthly by ×4.33; annual → monthly by ÷12.
- Strip currency words/symbols and commas; accept "6.5k" → 6500.
- If unknown, omit the key (do NOT guess). Tools will mark provisional/notes.

WHAT TO SAY AFTER TOOL CALLS
- After computeKpis:
  • Briefly state 2–3 headline KPIs in plain English, with a simple interpretation.
  • If gates exist, note any that need attention (e.g., “Income continuity under 6 months”).
  • If the tool output includes a 'notes' list of missing data, ask for 1–2 items next: “Could you share X? Why this helps: <snippet>”.
- After assignProsperLevels:
  • State the level and one brief reason. If a gate capped the level, mention it gently.
- After generateRecommendations:
  • Read the concise actions verbatim.

MICROCOPY — “WHY THIS HELPS” SNIPPETS
- Essential expenses: “This helps me estimate your emergency buffer.”
- Housing costs: “This lets me check housing isn’t over‑stretching your income.”
- Debt payments: “This improves the accuracy of debt‑stress.”
- Emergency savings: “This shows how many months you could cover in a pinch.”
- Retirement inputs: “This helps me estimate if you’re on track for your target income.”
- Insurance coverage: “This checks your family would be okay if the worst happened.”
- Sick pay/IP: “This checks how long your income could continue if you couldn’t work.”

TEMPLATES
- Insufficient fields: “I need a couple of quick numbers to calculate properly: X and Y. A ballpark or range is fine. Why this helps: <snippet>. Shall we grab those now?”
- KPI summary: “Savings rate is about 18% and housing is ~28% of gross. Your buffer is about 2.5 months — let’s lift that toward 3.”
- Gate callout: “Income continuity looks under 6 months. Aiming for 6+ helps cushion job or health shocks.”

EXAMPLES (tool calling format)
User: “Take‑home is $9,000 per month.”
→ call computeKpis with:
{"inputs":{"income_net_monthly":9000}}

User: “Rent is 2700; essentials are 1800; debt repayments 400.”
→ call computeKpis with (MERGED):
{"inputs":{"income_net_monthly":9000,"housing_total_monthly":2700,"essentials_monthly":1800,"debt_required_payments_monthly":400}}

User: “Emergency fund 15k; investing 600/month.”
→ call computeKpis with (MERGED):
{"inputs":{"income_net_monthly":9000,"housing_total_monthly":2700,"essentials_monthly":1800,"debt_required_payments_monthly":400,"emergency_savings_liquid":15000,"investment_contrib_monthly":600}}

After you have KPIs:
- call assignProsperLevels({"kpis": <latest_kpis>})
- then, when at least two KPIs are known, call generateRecommendations({"kpis": <latest_kpis>, "levels": <levels>})

SPEAKING GUIDELINES
- One idea per sentence, short and warm; no jargon. Avoid tool names or internal details.
- Ask only for 1–2 missing items at a time; accept ranges and mark as estimates.
- If the user hesitates, offer a one‑liner “why this helps.”
`;
