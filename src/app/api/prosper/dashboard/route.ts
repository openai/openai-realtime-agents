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

  // Household billing state (optional – table may not have these columns yet)
  let subscription_status: string | null = null;
  let current_period_end: string | null = null;
  try {
    const { data: hh } = await supabase
      .from('households')
      .select('subscription_status,current_period_end')
      .eq('id', householdId)
      .maybeSingle();
    subscription_status = (hh as any)?.subscription_status ?? null;
    current_period_end = (hh as any)?.current_period_end ?? null;
  } catch {}

  // Net worth series (last 180 points; entitlements may further cap on server)
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

  // Usage: count snapshots to drive metered paywall (free limit configurable)
  let used = 0;
  try {
    const { count } = await supabase
      .from('snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId);
    used = count ?? 0;
  } catch {}
  const freeLimit = Number(process.env.FREE_SNAPSHOT_LIMIT || 3);

  // Entitlements: premium if active/trialing and not expired
  const now = Date.now();
  const periodEndMs = current_period_end ? Date.parse(current_period_end) : 0;
  const isPremium = !!subscription_status && ['active','trialing','past_due'].includes(subscription_status) && (periodEndMs === 0 || periodEndMs > now);

  // If free, cap series to ~90 days worth (by date)
  let shapedSeries = series || [];
  if (!isPremium && shapedSeries?.length) {
    const lastTs = Date.parse(shapedSeries[shapedSeries.length-1].ts);
    const cutoff = lastTs - 90*24*60*60*1000;
    shapedSeries = shapedSeries.filter(p => Date.parse(p.ts) >= cutoff);
  }

  // Shape mirrors previous payload while adding convenient mirrors
  const payload: any = {
    householdId,
    latestSnapshot,
    series: shapedSeries,
    entitlements: {
      plan: isPremium ? 'premium' : 'free',
      subscription_status: subscription_status || undefined,
      current_period_end: current_period_end || undefined,
    },
    usage: { free_limit: freeLimit, used, remaining: Math.max(0, freeLimit - used) }
  };

  if (latestSnapshot) {
    payload.kpis = latestSnapshot.kpis;
    payload.levels = latestSnapshot.levels;
    payload.recommendations = latestSnapshot.recommendations;
  }

  return NextResponse.json(payload, { status: 200 });
}
