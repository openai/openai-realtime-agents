import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateRecommendations } from "@/app/lib/prosperTools";

type SlotDelta = { value: any; confidence?: 'low'|'med'|'high' };

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
    const incomingSlotsRaw = (body.slots && typeof body.slots === 'object') ? body.slots as Record<string, SlotDelta> : {};

    const mergedSlots: any = { ...existingSlots };
    for (const [k, v] of Object.entries(incomingSlotsRaw)) {
      const val = (v as any)?.value;
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

