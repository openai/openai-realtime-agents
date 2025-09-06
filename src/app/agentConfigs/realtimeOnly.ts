"use client";

import { RealtimeAgent, RealtimeItem, tool } from "@openai/agents/realtime";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateRecommendations } from "@/app/lib/prosperTools";
import type { Slots } from "@/app/lib/schema/slots";

// -------------------- lightweight client helpers --------------------
async function getHouseholdIdClient(): Promise<string> {
  try {
    const res = await fetch("/api/household/init", { cache: "no-store" });
    const data = await res.json();
    if (data?.id) {
      try { localStorage.setItem("pp_household_id", data.id); } catch {}
      return data.id as string;
    }
  } catch {}
  let id = "";
  try { id = localStorage.getItem("pp_household_id") || ""; } catch {}
  if (!id) {
    id = (typeof crypto !== "undefined" && (crypto as any).randomUUID?.())
      || Math.random().toString(36).slice(2);
    try { localStorage.setItem("pp_household_id", id); } catch {}
  }
  return id;
}

// -------------------- session-local state --------------------
let lastInputs: Record<string, any> | null = null;
let lastSlots: Slots | null = null;
let lastKpis: any = null;
let lastGates: any = null;
let lastLevels: any = null;
let lastPersistFingerprint: string | null = null;
let lastRecommendations: any = null;

// Minimal sufficiency check to avoid empty computes
function missingForSufficiency(slots?: any, inputs?: Record<string, any>): string[] {
  const m: string[] = [];
  const hasNet = Number.isFinite(slots?.net_income_monthly_self?.value) || Number.isFinite(inputs?.income_net_monthly);
  const hasGross = Number.isFinite(slots?.gross_income_annual_self?.value) || Number.isFinite(inputs?.income_gross_monthly);
  if (!hasNet && !hasGross) m.push("income (net or gross)");
  const hasEss = Number.isFinite(slots?.essential_expenses_monthly?.value) || Number.isFinite(inputs?.essential_expenses_monthly) || Number.isFinite(inputs?.essentials_monthly);
  if (!hasEss) m.push("essential_expenses_monthly");
  const hasHousing = Number.isFinite(slots?.rent_monthly?.value) || Number.isFinite(slots?.mortgage_payment_monthly?.value) || Number.isFinite(inputs?.housing_total_monthly);
  if (!hasHousing) m.push("housing_total_monthly (or rent/mortgage)");
  const hasDebtPmts = Number.isFinite(slots?.other_debt_payments_monthly_total?.value) || Number.isFinite(inputs?.debt_required_payments_monthly);
  if (!hasDebtPmts) m.push("debt_required_payments_monthly");
  const hasEmergency = Number.isFinite(slots?.cash_liquid_total?.value) || Number.isFinite(inputs?.emergency_savings_liquid);
  if (!hasEmergency) m.push("emergency_savings_liquid");
  return m;
}

// -------------------- tools --------------------
export const get_thinker_response = tool({
  name: "get_thinker_response",
  description: "Internal planning/thinking helper. Returns the provided context back for the agent to rephrase for speech.",
  parameters: {
    type: "object",
    properties: { context: { type: "string" } },
    required: ["context"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const ctx = (input?.context || "").toString();
    return (ctx.length > 2000 ? ctx.slice(0, 2000) + "…" : ctx);
  },
});

export const rehydrate = tool({
  name: "rehydrate",
  description: "Load latest saved snapshot and entitlements for this browser household.",
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  execute: async () => {
    try {
      const hh = await getHouseholdIdClient();
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
        return { ok: true, householdId: hh, exists: !!snap, entitlements: d?.entitlements || null };
      }
    } catch (e) {
      return { ok: false };
    }
    return { ok: false };
  }
});

export const update_profile = tool({
  name: "update_profile",
  description: "Apply updates to the current profile. Prefer v2 slot keys (e.g., cash_liquid_total). Accepts either a single key/value or a batch of slots.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string" },
      value: { type: ["number", "string", "boolean", "null"] as any },
      confidence: { type: "string" },
      slots: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: { value: { type: ["number", "string", "boolean", "null"] as any }, confidence: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      },
      inputs: { type: "object", additionalProperties: true },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    // Merge raw inputs (MQS-style) if provided
    if (input?.inputs && typeof input.inputs === 'object') {
      lastInputs = { ...(lastInputs || {}), ...(input.inputs as any) };
    }
    // Merge batch slot updates
    if (input?.slots && typeof input.slots === 'object') {
      lastSlots = { ...(lastSlots || {}) } as any;
      for (const [k, v] of Object.entries(input.slots as Record<string, any>)) {
        (lastSlots as any)[k] = { value: (v as any)?.value ?? null, confidence: (v as any)?.confidence ?? 'med' };
      }
    }
    // Single key/value update convenience
    if (typeof input?.key === 'string') {
      const conf = input?.confidence || 'med';
      lastSlots = { ...(lastSlots || {}) } as any;
      (lastSlots as any)[input.key] = { value: input?.value ?? null, confidence: conf };
    }
    // Keep slots inside inputs for persistence
    if (lastSlots) lastInputs = { ...(lastInputs || {}), slots: lastSlots };
    if (addBreadcrumb) addBreadcrumb('function call: updateProfile', { updatedKeys: Object.keys((input?.slots || {})) });
    return { ok: true };
  },
});

export const apply_delta_and_persist = tool({
  name: "apply_delta_and_persist",
  description: "Atomically merge slot/input changes, compute KPIs/levels, persist snapshot + net worth point, and return the full snapshot.",
  parameters: {
    type: "object",
    properties: {
      inputs: { type: "object", additionalProperties: true },
      slots: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: { value: { type: ["number", "string", "boolean", "null"] as any }, confidence: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    try {
      const res = await fetch('/api/prosper/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: input?.inputs || {}, slots: input?.slots || {} }),
      });
      const j = await res.json();
      if (!res.ok || !j?.snapshot) return { ok: false, error: j?.error || 'apply_failed' };
      const snap = j.snapshot as any;
      lastInputs = snap.inputs || {};
      lastSlots = (lastInputs as any)?.slots || null;
      lastKpis = snap.kpis || null;
      lastLevels = snap.levels || null;
      lastRecommendations = snap.recommendations || null;
      lastPersistFingerprint = JSON.stringify({ i: lastInputs, k: lastKpis, l: lastLevels, a: lastRecommendations });
      try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { via: 'apply' } })); } catch {}
      if (addBreadcrumb) addBreadcrumb('Saving your details…');
      return { ok: true, snapshot: snap };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  },
});

export const apply_slot_deltas = tool({
  name: "apply_slot_deltas",
  description: "Apply additive deltas to multiple slots in one transaction (e.g., move 500 from cash to investments = cash:-500, investments:+500). Persists and returns the snapshot.",
  parameters: {
    type: "object",
    properties: {
      deltas: {
        type: "object",
        additionalProperties: { type: "number" },
      },
      confidences: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
    required: ["deltas"],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    try {
      const res = await fetch('/api/prosper/delta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltas: input?.deltas || {}, confidences: input?.confidences || {} }),
      });
      const j = await res.json();
      if (!res.ok || !j?.snapshot) return { ok: false, error: j?.error || 'delta_failed' };
      const snap = j.snapshot as any;
      lastInputs = snap.inputs || {};
      lastSlots = (lastInputs as any)?.slots || null;
      lastKpis = snap.kpis || null;
      lastLevels = snap.levels || null;
      lastRecommendations = snap.recommendations || null;
      lastPersistFingerprint = JSON.stringify({ i: lastInputs, k: lastKpis, l: lastLevels, a: lastRecommendations });
      try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { via: 'delta' } })); } catch {}
      if (addBreadcrumb) addBreadcrumb('Saving your details…');
      return { ok: true, snapshot: snap };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  },
});

export const compute_kpis = tool({
  name: "compute_kpis",
  description: "Compute Prosper KPIs, gates and normalised ledger from provided profile JSON (prefers slots).",
  parameters: {
    type: "object",
    properties: {
      profile_json: { type: "object", additionalProperties: true },
    },
    required: ["profile_json"],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    const p = (input?.profile_json || {}) as Record<string, any>;
    // Merge new inputs into session state
    lastInputs = { ...(lastInputs || {}), ...p };
    const incomingSlots: Slots | undefined = (p?.slots as Slots) || undefined;
    if (incomingSlots) lastSlots = { ...(lastSlots || {}), ...incomingSlots } as any;

    const missing = missingForSufficiency(lastSlots, lastInputs || {});
    if (missing.length > 0) {
      return { skipped: true, reason: "insufficient_fields", missing };
    }

    if (!lastSlots) {
      return { skipped: true, reason: "no_slots", message: "Provide v2 slots to compute KPIs." };
    }

    const { kpis, gates, normalized, provisional } = computeKpisV2(lastSlots);
    lastKpis = kpis;
    lastGates = gates;
    if (addBreadcrumb) addBreadcrumb('function call: computeKpis');
    return { kpis, gates, normalized, provisional };
  },
});

export const assign_levels = tool({
  name: "assign_levels",
  description: "Assign Prosper levels from KPIs and gates.",
  parameters: {
    type: "object",
    properties: {
      kpis: { type: "object", additionalProperties: true },
      gates: { type: "object", additionalProperties: true },
    },
    required: ["kpis"],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    const k = (input?.kpis || lastKpis) as any;
    const g = (input?.gates || lastGates) as any;
    if (!k) return { skipped: true, reason: "no_kpis" };
    const levels = assignLevelsV2(k, g || {});
    lastLevels = levels;
    if (addBreadcrumb) addBreadcrumb('function call: assignProsperLevels');
    // Autosave snapshot to keep dashboard/review in sync (toggle via NEXT_PUBLIC_AUTOSAVE=0)
    try {
      const AUTOSAVE = (process?.env?.NEXT_PUBLIC_AUTOSAVE ?? '1') !== '0';
      if (AUTOSAVE) {
        const fingerprint = JSON.stringify({ i: lastInputs || {}, k: lastKpis || {}, l: lastLevels || {} });
        if (fingerprint && fingerprint !== lastPersistFingerprint) {
          const hh = await getHouseholdIdClient();
          const payload: any = {
            householdId: hh,
            inputs: lastInputs || {},
            kpis: { ...(lastKpis || {}), engine_version: 'v2', gates: lastGates || {} },
            levels: lastLevels || {},
            provisional_keys: [],
          };
          const res = await fetch('/api/prosper/snapshots', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          if (res.ok) {
            lastPersistFingerprint = fingerprint;
            try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { autosave: true } })); } catch {}
            try { addBreadcrumb && addBreadcrumb('Saving your details…'); } catch {}
          }
        }
      }
    } catch {}
    return { levels };
  },
});

export const map_triggers = tool({
  name: "map_triggers",
  description: "Apply Prosper trigger rules to select actions. Returns prioritized items with reasons.",
  parameters: {
    type: "object",
    properties: {
      kpis: { type: "object", additionalProperties: true },
      levels: { type: "object", additionalProperties: true },
      preferences: { type: "object", additionalProperties: true },
    },
    required: ["kpis"],
    additionalProperties: false,
  },
  execute: async (input: any, details?: any) => {
    const addBreadcrumb = details?.context?.addTranscriptBreadcrumb as undefined | ((t: string, d?: any) => void);
    const k = (input?.kpis || lastKpis) as any;
    const lv = (input?.levels || lastLevels) as any;
    const prefs = (input?.preferences || {}) as any;
    if (!k) return { skipped: true, reason: "no_kpis" };
    const actions = generateRecommendations(k, lv || {}, prefs);
    lastRecommendations = actions;
    if (addBreadcrumb) addBreadcrumb('function call: generateRecommendations');
    // Autosave snapshot including recommendations (toggle via NEXT_PUBLIC_AUTOSAVE=0)
    try {
      const AUTOSAVE = (process?.env?.NEXT_PUBLIC_AUTOSAVE ?? '1') !== '0';
      if (AUTOSAVE) {
        const fingerprint = JSON.stringify({ i: lastInputs || {}, k: lastKpis || {}, l: lastLevels || {}, a: lastRecommendations || {} });
        if (fingerprint && fingerprint !== lastPersistFingerprint) {
          const hh = await getHouseholdIdClient();
          const payload: any = {
            householdId: hh,
            inputs: lastInputs || {},
            kpis: { ...(lastKpis || {}), engine_version: 'v2', gates: lastGates || {} },
            levels: lastLevels || {},
            recommendations: lastRecommendations || [],
            provisional_keys: [],
          };
          const res = await fetch('/api/prosper/snapshots', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          if (res.ok) {
            lastPersistFingerprint = fingerprint;
            try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { autosave: true } })); } catch {}
            try { addBreadcrumb && addBreadcrumb('Saving your details…'); } catch {}
          }
        }
      }
    } catch {}
    return { actions };
  },
});

export const build_action_plan = tool({
  name: "build_action_plan",
  description: "Produce a 3–5 item plan using Learn/Live/Stick structure based on selected actions and profile.",
  parameters: {
    type: "object",
    properties: {
      triggers: { type: "object", additionalProperties: true },
      profile_json: { type: "object", additionalProperties: true },
    },
    required: ["triggers"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const list = Array.isArray(input?.triggers?.actions) ? input.triggers.actions : [];
    const top = list.slice(0, 5).map((a: any, i: number) => ({
      priority: i + 1,
      code: a.code || a.pillar || 'GENERAL',
      title: a.title,
      why: a.why,
      learn: a.why || 'Why it matters for your situation.',
      live: Array.isArray(a.how) && a.how.length ? a.how.slice(0, 3) : ['Open a dedicated savings pot', 'Automate a weekly transfer'],
      stick: 'Automate, review weekly for 4 weeks, then monthly.',
    }));
    return { plan: top };
  },
});

export const retrieve_benchmarks = tool({
  name: "retrieve_benchmarks",
  description: "Fetch peer benchmarks to contextualise ratios.",
  parameters: {
    type: "object",
    properties: {
      cohort: { type: "object", additionalProperties: true },
      metrics: { type: "array", items: { type: "string" } },
    },
    required: ["cohort"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const c = input?.cohort || {};
    const params = new URLSearchParams();
    if (c.country) params.set('country', String(c.country));
    if (c.age) params.set('age', String(c.age));
    if (c.homeownership) params.set('home', String(c.homeownership));
    if (c.income_band) params.set('income', String(c.income_band));
    if (c.dependants) params.set('dependants', String(c.dependants));
    if (Array.isArray(input?.metrics) && input.metrics.length) params.set('metrics', input.metrics.join(','));
    const r = await fetch(`/api/v1/benchmarks?${params.toString()}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false };
    return { ok: true, ...j };
  },
});

export const persist_snapshot = tool({
  name: "persist_snapshot",
  description: "Persist the current snapshot (inputs + kpis + levels).",
  parameters: {
    type: "object",
    properties: {
      extra: { type: "object", additionalProperties: true },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const hh = await getHouseholdIdClient();
      const payload: any = {
        household_id: hh,
        inputs: lastInputs || {},
        kpis: lastKpis || {},
        levels: lastLevels || {},
        provisional_keys: [],
        ...(input?.extra || {}),
      };
      const res = await fetch("/api/prosper/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json };
      try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { id: json?.id, created_at: json?.created_at } })); } catch {}
      return { ok: true, id: json?.id };
    } catch (e) {
      return { ok: false };
    }
  },
});

export const store_user_profile = tool({
  name: "store_user_profile",
  description: "Save PII profile updates (email, full_name) after user consent.",
  parameters: {
    type: "object",
    properties: {
      updates: { type: "object", additionalProperties: true },
    },
    required: ["updates"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const hh = await getHouseholdIdClient();
      const { email, full_name } = input.updates || {};
      const res = await fetch('/api/household/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: hh, email, full_name }),
      });
      if (!res.ok) return { ok: false };
      return { ok: true };
    } catch { return { ok: false }; }
  },
});

export const complete_action = tool({
  name: "complete_action",
  description: "Mark an action as completed so it won’t be suggested again.",
  parameters: {
    type: "object",
    properties: { title: { type: "string" }, action_id: { type: "string" } },
    required: ["title"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const hh = await getHouseholdIdClient();
      const res = await fetch('/api/actions/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: hh, title: input?.title, action_id: input?.action_id }),
      });
      if (!res.ok) return { ok: false };
      return { ok: true };
    } catch { return { ok: false }; }
  },
});

// Optional stubs (not yet backed by APIs)
export const send_summary = tool({
  name: "send_summary",
  description: "Email a summary report (stub).",
  parameters: { type: "object", properties: { email: { type: "string" }, report: { type: "object", additionalProperties: true } }, required: ["email", "report"], additionalProperties: false },
  execute: async () => ({ ok: false, error: "not_implemented" }),
});
export const schedule_checkin = tool({
  name: "schedule_checkin",
  description: "Schedule a check-in reminder (stub).",
  parameters: { type: "object", properties: { when: { type: "string" }, channel: { type: "string" } }, required: ["when", "channel"], additionalProperties: false },
  execute: async () => ({ ok: false, error: "not_implemented" }),
});
export const finish_session = tool({
  name: "finish_session",
  description: "Finish the session (client may close audio).",
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  execute: async () => ({ ok: true }),
});
export const escalate_to_human = tool({
  name: "escalate_to_human",
  description: "Escalate to a human advisor (stub).",
  parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
  execute: async () => ({ ok: false, error: "not_implemented" }),
});

// -------------------- Agent Definition --------------------
const systemPrompt = `
You are Prosper, an audio-first money coach using Prosper Path. You:
- Diagnose: gather inputs, compute measures/ratios, determine level.
- Classify: map ratios to colour bands.
- Trigger: apply pathway rules to select actions.
- Coach: deliver stepwise guidance (Learn → Live → Stick).
- Reinforce: encourage habits and track progress with consent.

Success = the user gets clear numbers, a short plan for today, and (with consent) a saved profile and a scheduled check-in.

Personality: Warm, calm, non-judgemental, competent, approachable. British English only. One thought per sentence. 1–3 short sentences per turn. Vary openings and fillers; don’t repeat within 6 turns.

Boundaries: Educational content only. Do not provide personalised financial, legal, tax, credit, or investment advice. Never recommend specific securities/products. Suggest licensed professionals when requested.

Speech rules: Spell IDs character-by-character with hyphens. Money in natural speech. Dates plain. Percentages clear. Ranges: round first; offer exacts on request. If audio unclear: one brief clarifier; after two unclear tries, repeat last question more simply.

Couples: Use both names when provided. Confirm joint vs individual figures. Summarise per person where relevant.

Global tool behaviour:
- Proactive tools: compute_kpis, map_triggers, build_action_plan, retrieve_benchmarks, finish_session.
- Confirmation-first tools: store_user_profile, send_summary, schedule_checkin.
- Preambles: say one neutral filler (“One moment…”, “Let me check that…”) before any tool call. After return, summarise in ≤2 sentences and ask a simple confirmation/choice.
- On error: apologise once, say what failed, offer next-best step or escalation (escalate_to_human).

Flow:
1) Greeting & consent: set educational boundary and ask if saving details as you go is OK.
2) Discover context: household makeup, ages, location, goals (1–3), risk comfort; confirm joint vs individual.
3) Money in: net monthly income per person; capture irregular income.
4) Money out: essentials, lifestyle, debt outflows (min vs actual).
5) Balance sheet: cash, emergency savings, investments, property, pensions; debts by type, rates, balances.
6) Compute & classify: call compute_kpis then explain 2–3 headline ratios and colour bands plainly; call retrieve_benchmarks when helpful.
7) Trigger & plan: call map_triggers then build_action_plan; present 3–5 actions (Learn/Live/Stick) with a brief “why”.
8) Reinforce & next steps: offer to send summary, save profile, and schedule a check-in.

Sufficiency to compute: need at least (net OR gross income), essential_expenses_monthly, housing (rent or mortgage or total), debt_required_payments_monthly, emergency_savings_liquid. If missing, ask for 1–2 specific items with a short “why this helps”. Accept ranges; mark as estimates.

Tool sequencing:
- First compute: rehydrate → collect/confirm → compute_kpis → assign_levels → map_triggers → build_action_plan.
- After any change affecting cash, debts, pensions, or savings: compute again.
- Persist only with user consent using persist_snapshot and store_user_profile.

Returning users: If the first user content contains ACTION=RECAP or RETURNING_USER=TRUE, say a neutral filler, call rehydrate, then provide a brief recap of known details (names/email/country if present; key amounts like income, essentials, housing, cash, debts). Ask: “Would you like to update anything, or continue?” Do not re‑ask confirmed basics.

Rephrase Supervisor: When get_thinker_response returns text, start with “Thanks for waiting—” or “All set—”, then deliver the gist (≤2 sentences) suitable for speech.

Update policy:
- When the user supplies a new number or change (e.g., “I was gifted £1,000 cash”, “rent is now 1050”, “I’m contributing 8%”), call apply_delta_and_persist with the specific slot(s). Read numbers back from the snapshot it returns. Example:
  • apply_delta_and_persist({ slots: { cash_liquid_total: { value: 1800, confidence: 'med' } } })
- For transfers between categories, use apply_slot_deltas with additive changes so both sides move together. Examples:
  • “I invested £500” → apply_slot_deltas({ deltas: { cash_liquid_total: -500, investments_ex_home_total: +500 } })
  • “Moved £300 into a term deposit” → apply_slot_deltas({ deltas: { cash_liquid_total: -300, term_deposits_le_3m: +300 } })
  • “Paid £200 off my credit card” → apply_slot_deltas({ deltas: { cash_liquid_total: -200, other_debt_balances_total: -200 } })
- Personal details examples:
  • “I was born in 1989” → apply_delta_and_persist({ slots: { birth_year: { value: 1989 } } })
  • “We’re renting now” → apply_delta_and_persist({ slots: { housing_status: { value: 'rent' } } })
  • “I live in the UK” → apply_delta_and_persist({ slots: { country: { value: 'UK' } } })
- Prefer apply_delta_and_persist / apply_slot_deltas for real updates (they save and refresh the dashboard). Only use update_profile for temporary, in-session notes.
`;

export const realtimeOnlyAgent = new RealtimeAgent({
  name: 'prosper_realtime',
  voice: 'sage',
  instructions: systemPrompt,
  tools: [
    // Thinker / orchestration
    get_thinker_response,
    // State + compute
    rehydrate,
    // Update profile values before computing
    update_profile,
    apply_delta_and_persist,
    apply_slot_deltas,
    compute_kpis,
    assign_levels,
    map_triggers,
    build_action_plan,
    retrieve_benchmarks,
    // Persistence + actions
    store_user_profile,
    persist_snapshot,
    complete_action,
    // Utilities / stubs
    send_summary,
    schedule_checkin,
    finish_session,
    escalate_to_human,
  ],
});

export const realtimeOnlyScenario = [realtimeOnlyAgent];
export const realtimeOnlyCompanyName = 'Prosper Path';
export default realtimeOnlyScenario;
