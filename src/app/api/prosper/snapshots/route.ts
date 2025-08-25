import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";

type Body = {
  householdId?: string;
  inputs?: any;
  kpis?: any;
  levels?: any;
  recommendations?: any;
  provisional_keys?: string[];
  sessionId?: string | null;
  net_worth_point?: { ts?: string; value?: number } | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const cookieStore = await cookies();
  const cookieId = cookieStore.get("pp_household_id")?.value;
  const householdId = body.householdId || cookieId;

  if (!householdId) {
    return NextResponse.json({ error: "household_id_required" }, { status: 400 });
  }

  // Ensure household row exists
  const { data: hhCheck, error: hhErr } = await supabase
    .from("households")
    .select("id")
    .eq("id", householdId)
    .maybeSingle();

  if (hhErr) {
    return NextResponse.json({ error: "household_check_failed" }, { status: 500 });
  }
  if (!hhCheck) {
    const { error: hhInsErr } = await supabase.from("households").insert({ id: householdId });
    if (hhInsErr) {
      return NextResponse.json({ error: "household_insert_failed" }, { status: 500 });
    }
  }

  // Insert snapshot
  const { data: snap, error: snapErr } = await supabase
    .from("snapshots")
    .insert({
      household_id: householdId,
      inputs: body.inputs ?? {},
      kpis: body.kpis ?? {},
      levels: body.levels ?? {},
      recommendations: body.recommendations ?? null,
      provisional_keys: body.provisional_keys ?? [],
    })
    .select("id, created_at")
    .single();

  if (snapErr || !snap) {
    console.error("snapshot insert error", snapErr);
    return NextResponse.json({ error: "snapshot_insert_failed" }, { status: 500 });
  }

  // Optional NW point
  if (body.net_worth_point?.value != null) {
    const ts = body.net_worth_point.ts || new Date().toISOString();
    await supabase.from("net_worth_points").insert({
      household_id: householdId,
      ts,
      value: body.net_worth_point.value,
    });
  }

  return NextResponse.json({ ok: true, id: snap.id, created_at: snap.created_at });
}
