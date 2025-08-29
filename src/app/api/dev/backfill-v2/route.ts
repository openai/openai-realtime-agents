import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";

function inputsToSlotsFallback(inputs: Record<string, any>): Slots {
  const grossAnnual = Number.isFinite(inputs?.income_gross_monthly) ? inputs.income_gross_monthly * 12 : undefined;
  const netMonthly = Number.isFinite(inputs?.income_net_monthly) ? inputs.income_net_monthly : undefined;
  const essentials = Number.isFinite(inputs?.essentials_monthly) ? inputs.essentials_monthly : undefined;
  const housingTotal = Number.isFinite(inputs?.housing_total_monthly) ? inputs.housing_total_monthly : undefined;
  const debtPmts = Number.isFinite(inputs?.debt_required_payments_monthly) ? inputs.debt_required_payments_monthly : undefined;
  const liquid = Number.isFinite(inputs?.emergency_savings_liquid) ? inputs.emergency_savings_liquid : undefined;
  const slots: Slots = {} as any;
  if (netMonthly != null) (slots as any).net_income_monthly_self = { value: netMonthly, confidence: 'med' };
  if (grossAnnual != null) (slots as any).gross_income_annual_self = { value: grossAnnual, confidence: 'med' };
  if (essentials != null) (slots as any).essential_expenses_monthly = { value: essentials, confidence: 'med' };
  if (housingTotal != null) (slots as any).rent_monthly = { value: housingTotal, confidence: 'low' };
  if (debtPmts != null) (slots as any).other_debt_payments_monthly_total = { value: debtPmts, confidence: 'med' };
  if (liquid != null) (slots as any).cash_liquid_total = { value: liquid, confidence: 'med' };
  return slots;
}

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const url = new URL(req.url);
  const householdId = url.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId_required' }, { status: 400 });

  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id, created_at, inputs')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return NextResponse.json({ error: 'snapshot_query_failed', detail: String(error?.message || '') }, { status: 500 });
  const latest: any = snaps?.[0] || null;
  if (!latest?.inputs) return NextResponse.json({ error: 'no_inputs' }, { status: 400 });

  const inputs = latest.inputs as any;
  const slots: Slots = inputs?.slots && typeof inputs.slots === 'object' ? inputs.slots as Slots : inputsToSlotsFallback(inputs);
  const { kpis, gates } = computeKpisV2(slots);
  const levels = assignLevelsV2(kpis, gates);

  try {
    const res = await fetch(`${url.origin}/api/prosper/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, inputs, kpis: { ...kpis, engine_version: 'v2', gates }, levels }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: 'persist_failed', detail: j }, { status: 500 });
    return NextResponse.json({ ok: true, id: j.id, created_at: j.created_at, preview: { kpis, gates, levels } });
  } catch (e: any) {
    return NextResponse.json({ error: 'network_error', detail: e?.message || 'failed' }, { status: 500 });
  }
}
