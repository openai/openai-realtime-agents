import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateRecommendations } from "@/app/lib/prosperTools";

type SlotDelta = { value: any; confidence?: 'low'|'med'|'high' };

function canonicalSlotKey(k: string): string {
  const s = (k || '').toLowerCase();
  const map: Record<string, string> = {
    cash: 'cash_liquid_total',
    cash_total: 'cash_liquid_total',
    savings: 'cash_liquid_total',
    term_deposit: 'term_deposits_le_3m',
    term_deposits: 'term_deposits_le_3m',
    fixed_savings: 'term_deposits_le_3m',
    investments: 'investments_ex_home_total',
    investments_total: 'investments_ex_home_total',
    investment_total: 'investments_ex_home_total',
    stocks_total: 'investments_ex_home_total',
    pension_balance: 'pension_balance_total',
    pension_total: 'pension_balance_total',
    pension_contribution: 'pension_contrib_pct',
    pension_pct: 'pension_contrib_pct',
    rent: 'rent_monthly',
    mortgage_payment: 'mortgage_payment_monthly',
    essential_expenses: 'essential_expenses_monthly',
    total_expenses: 'total_expenses_monthly',
    other_debt_payments: 'other_debt_payments_monthly_total',
    other_debt_total: 'other_debt_balances_total',
    debts_total: 'debts_total',
    credit_score: 'credit_score_normalised_0_1',
    credit_score_normalized: 'credit_score_normalised_0_1',
    // Personal details
    birthyear: 'birth_year',
    year_of_birth: 'birth_year',
    date_of_birth: 'birth_year',
    dob: 'birth_year',
    born: 'birth_year',
    age: 'birth_year', // will be converted in coerce
    names: 'full_name',
    name: 'full_name',
    email_address: 'email',
    country_code: 'country',
    zip: 'postcode',
    postal_code: 'postcode',
    zip_code: 'postcode',
    has_partner: 'partner',
    dependants: 'dependants_count',
    dependents: 'dependants_count',
    kids: 'dependants_count',
    employment: 'employment_status',
    job_status: 'employment_status',
    tenancy: 'housing_status',
    // Sick pay
    sick_pay: 'sick_pay_months_full',
    sickpay: 'sick_pay_months_full',
    sick_pay_months: 'sick_pay_months_full',
    sickpay_months: 'sick_pay_months_full',
    sick_pay_full: 'sick_pay_months_full',
    sick_full: 'sick_pay_months_full',
    full_sick_pay_months: 'sick_pay_months_full',
    sick_pay_half: 'sick_pay_months_half',
    sick_half: 'sick_pay_months_half',
    half_sick_pay_months: 'sick_pay_months_half',
  };
  return map[s] || k;
}

function coerceSlotValue(slot: string, raw: any): any {
  const k = slot;
  // Birth year: accept YYYY or full dates
  if (k === 'birth_year') {
    if (typeof raw === 'string') {
      const m = raw.match(/(19\d{2}|20\d{2})/);
      if (m) return Number(m[1]);
    }
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    return null;
  }
  // Booleans
  if (k === 'home_insured_ok' || k === 'income_protection_has' || k === 'partner' || k === 'homeowner') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw ?? '').toLowerCase();
    if (['yes','true','y','1'].includes(s)) return true;
    if (['no','false','n','0'].includes(s)) return false;
    return null;
  }
  // Percent as 0..1
  if (k === 'pension_contrib_pct') {
    if (typeof raw === 'number') return raw > 1 ? raw / 100 : raw;
    const s = String(raw ?? '').trim();
    if (s.endsWith('%')) {
      const n = Number(s.slice(0, -1));
      return Number.isFinite(n) ? (n > 1 ? n / 100 : n) : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? (n > 1 ? n / 100 : n) : null;
  }
  // Sick pay months (full/half) and dependants count: coerce numeric from text
  if (k === 'sick_pay_months_full' || k === 'sick_pay_months_half' || k === 'dependants_count') {
    if (typeof raw === 'number') return Math.max(0, Math.floor(raw));
    const m = String(raw ?? '').match(/\d+/);
    if (m) return Math.max(0, parseInt(m[0], 10));
    return null;
  }
  // Age -> birth_year
  if (k === 'birth_year') {
    const nowYear = new Date().getFullYear();
    if (typeof raw === 'number') {
      if (raw <= 150) return nowYear - Math.max(0, Math.floor(raw)); // treat as age
      if (raw >= 1900 && raw <= 2100) return Math.floor(raw);
    }
    if (typeof raw === 'string') {
      // Accept simple age or a full date string containing YYYY
      const ageMatch = raw.trim().match(/^(\d{1,3})\s*(years?|yrs?)?/i);
      if (ageMatch) {
        const age = parseInt(ageMatch[1], 10);
        if (Number.isFinite(age)) return nowYear - Math.max(0, Math.floor(age));
      }
      const yMatch = raw.match(/(19\d{2}|20\d{2})/);
      if (yMatch) return parseInt(yMatch[1], 10);
    }
    return null;
  }
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const cookieStore = await cookies();
    const cookieId = cookieStore.get('pp_household_id')?.value;
    const householdId: string | undefined = body.householdId || cookieId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Ensure household exists (FK)
    try {
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .eq('id', householdId)
        .maybeSingle();
      if (hhErr) throw hhErr;
      if (!hh) {
        const { error: insErr } = await supabase.from('households').insert({ id: householdId });
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'household_insert_failed', detail: e?.message || 'failed' }, { status: 500 });
    }

    // Load latest inputs
    const { data: snaps } = await supabase
      .from('snapshots')
      .select('id, created_at, inputs')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = snaps?.[0] || null;
    const existingInputs = (latest?.inputs as any) || {};
    const existingSlots = (existingInputs?.slots as Slots | undefined) || ({} as any);

    // Merge incoming
    const incomingInputs = (body.inputs && typeof body.inputs === 'object') ? body.inputs : {};
    const rawSlots = (body.slots && typeof body.slots === 'object') ? body.slots as Record<string, SlotDelta> : {};
    const incomingSlotsRaw: Record<string, SlotDelta> = {};
    for (const [key, v] of Object.entries(rawSlots)) {
      incomingSlotsRaw[canonicalSlotKey(key)] = v as SlotDelta;
    }

    const mergedSlots: any = { ...existingSlots };
    for (const [k, v] of Object.entries(incomingSlotsRaw)) {
      const valRaw = (v as any)?.value;
      const val = coerceSlotValue(k, valRaw);
      const conf = (v as any)?.confidence ?? 'med';
      mergedSlots[k] = { value: val, confidence: conf };
    }
    const mergedInputs = { ...existingInputs, ...incomingInputs, slots: mergedSlots };

    // Compute
    const { kpis, gates, normalized } = computeKpisV2(mergedSlots as Slots);
    const levels = assignLevelsV2(kpis, gates);
    const recommendations = generateRecommendations(kpis as any, levels as any, {});

    // Persist snapshot
    const { data: snap, error: snapErr } = await supabase
      .from('snapshots')
      .insert({
        household_id: householdId,
        inputs: mergedInputs,
        kpis: { ...kpis, engine_version: 'v2', gates },
        levels,
        recommendations,
        provisional_keys: [],
      })
      .select('id, created_at')
      .single();
    if (snapErr) return NextResponse.json({ error: 'snapshot_insert_failed', detail: snapErr.message }, { status: 500 });

    // Net worth point
    const nw = normalized?.net_worth;
    if (typeof nw === 'number' && Number.isFinite(nw)) {
      try { await supabase.from('net_worth_points').insert({ household_id: householdId, ts: new Date().toISOString(), value: nw }); } catch {}
    }

    const snapshot = {
      id: snap?.id,
      created_at: snap?.created_at,
      inputs: mergedInputs,
      kpis: { ...kpis, engine_version: 'v2', gates },
      levels,
      recommendations,
    };
    return NextResponse.json({ ok: true, snapshot });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}
