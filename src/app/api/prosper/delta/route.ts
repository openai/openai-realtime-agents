import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateRecommendations } from "@/app/lib/prosperTools";

type DeltaBody = {
  householdId?: string;
  deltas: Record<string, number>; // slotName -> delta amount (can be negative)
  confidences?: Record<string, 'low'|'med'|'high'>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DeltaBody;
    const cookieStore = await cookies();
    const cookieId = cookieStore.get('pp_household_id')?.value;
    const householdId = body.householdId || cookieId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Ensure household exists
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

    // Load latest snapshot
    const { data: snaps } = await supabase
      .from('snapshots')
      .select('id, created_at, inputs')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = snaps?.[0] || null;
    const inputs = (latest?.inputs as any) || {};
    const slots: any = (inputs?.slots as any) || {};

    // Apply deltas
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
        // Personal & sick pay for rare delta usage
        birthyear: 'birth_year',
        year_of_birth: 'birth_year',
        date_of_birth: 'birth_year',
        dob: 'birth_year',
        born: 'birth_year',
        age: 'birth_year',
        dependants: 'dependants_count',
        dependents: 'dependants_count',
        kids: 'dependants_count',
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

    const deltasRaw = body?.deltas || {};
    const deltas: Record<string, number> = {};
    for (const [key, v] of Object.entries(deltasRaw)) {
      deltas[canonicalSlotKey(key)] = Number(v as any);
    }
    const confs = body?.confidences || {};
    for (const [slot, delta] of Object.entries(deltas)) {
      const cur = Number(((slots as any)[slot]?.value ?? 0) as number) || 0;
      let next = cur + Number(delta || 0);
      if (!Number.isFinite(next)) next = cur;
      if (next < 0) next = 0; // clamp to zero for now
      slots[slot] = { value: next, confidence: confs[slot] ?? 'med' };
    }

    const mergedInputs = { ...inputs, slots };

    // Compute & persist
    const { kpis, gates, normalized } = computeKpisV2(slots as Slots);
    const levels = assignLevelsV2(kpis, gates);
    const recommendations = generateRecommendations(kpis as any, levels as any, {});

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
