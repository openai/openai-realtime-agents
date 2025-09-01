import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateTwoBestActions } from "@/app/lib/recommendationsV2";

type Body = {
  householdId?: string;
  key: string;
  value: any;
  kind?: 'money'|'percent'|'number'|'bool'|'text';
};

function parseValue(raw: any, kind?: string): any {
  if (kind === 'bool') return raw === true || raw === 'true' || raw === 'yes' || raw === '1';
  if (kind === 'text') return String(raw ?? '').trim();
  let s = String(raw ?? '').trim();
  if (kind === 'percent') {
    // Accept "10%" or "0.10"
    if (s.endsWith('%')) s = s.slice(0, -1);
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n > 1 ? n / 100 : n;
  }
  // money/number: strip commas and currency symbols
  s = s.replace(/[,\s]/g, '');
  s = s.replace(/[^0-9.\-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const cookieStore = await cookies();
    const cookieId = cookieStore.get('pp_household_id')?.value;
    const householdId = body.householdId || cookieId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Ensure household row exists (FK on snapshots)
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
    } catch (e) {
      return NextResponse.json({ error: 'household_insert_failed', detail: (e as any)?.message || 'failed' }, { status: 500 });
    }

    const key = body.key;
    if (!key) return NextResponse.json({ error: 'key_required' }, { status: 400 });
    const val = parseValue(body.value, body.kind);
    if (val == null && body.kind !== 'text') return NextResponse.json({ error: 'invalid_value' }, { status: 400 });

    // Load latest snapshot to merge existing inputs/slots
    const { data: snaps } = await supabase
      .from('snapshots')
      .select('id, created_at, inputs')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = snaps?.[0] || null;
    const inputs = (latest?.inputs as any) || {};
    const slots = (inputs?.slots as any) || {};
    slots[key] = { value: val, confidence: 'high' };
    const mergedInputs = { ...inputs, slots };

    // Compute v2 KPIs and levels
    const { kpis, gates, normalized } = computeKpisV2(slots as any);
    const levels = assignLevelsV2(kpis, gates);
    const recommendations = generateTwoBestActions(kpis as any, gates as any);

    // Persist new snapshot
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

    // Persist net worth point for the chart if available
    const nw = normalized.net_worth;
    if (typeof nw === 'number' && Number.isFinite(nw)) {
      try {
        await supabase.from('net_worth_points').insert({ household_id: householdId, ts: new Date().toISOString(), value: nw });
      } catch {}
    }

    return NextResponse.json({ ok: true, id: snap?.id, created_at: snap?.created_at, kpis, gates, levels, recommendations });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}
