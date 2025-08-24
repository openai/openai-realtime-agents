import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qId = url.searchParams.get("householdId");
  const cookieStore = await cookies();
  const cId = cookieStore.get("pp_household_id")?.value;
  const householdId = qId || cId;

  if (!householdId) {
    return NextResponse.json({ error: "household_id_required" }, { status: 400 });
  }

  // Latest snapshot
  const { data: snaps, error: sErr } = await supabase
    .from("snapshots")
    .select("id, created_at, inputs, kpis, levels, recommendations, provisional_keys")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (sErr) {
    console.error("snapshots query error", sErr);
    return NextResponse.json({ error: "snapshot_query_failed" }, { status: 500 });
  }

  const latestSnapshot = snaps?.[0] || null;

  // Net worth series (last 180 points)
  const { data: series, error: nErr } = await supabase
    .from("net_worth_points")
    .select("ts, value")
    .eq("household_id", householdId)
    .order("ts", { ascending: true })
    .limit(180);

  if (nErr) {
    console.error("nw series query error", nErr);
    return NextResponse.json({ error: "series_query_failed" }, { status: 500 });
  }

  // Shape mirrors previous payload while adding convenient mirrors
  const payload: any = {
    householdId,
    latestSnapshot,
    series,
  };

  if (latestSnapshot) {
    payload.kpis = latestSnapshot.kpis;
    payload.levels = latestSnapshot.levels;
    payload.recommendations = latestSnapshot.recommendations;
  }

  return NextResponse.json(payload, { status: 200 });
}
