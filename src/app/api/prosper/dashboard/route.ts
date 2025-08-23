import { NextRequest, NextResponse } from "next/server";
import { getLatestSnapshot, getNetWorthSeries, seedDemoIfEmpty } from "@/app/lib/prosperDb";

export async function GET(req: NextRequest) {
  try {
    seedDemoIfEmpty();

    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get("householdId") || "PP-HH-0001";

    const latest = getLatestSnapshot(householdId);
    const series = getNetWorthSeries(householdId);

    if (!latest) {
      return NextResponse.json(
        {
          householdId,
          currency: "AUD",
          netWorthSeries: [],
          overallLevel: "L0",
          gatingPillar: "protect",
          pillarScores: [],
          kpis: {},
          actionPlan: {},
        },
        { status: 200 }
      );
    }

    const pillarScores = Object.entries(latest.levels?.pillars || {}).map(
      ([pillar, obj]: any) => ({
        pillar,
        score: obj?.score ?? 0,
        level: obj?.level ?? "L0",
      })
    );

    const payload = {
      householdId,
      currency: latest.inputs?.currency || "AUD",
      netWorthSeries: series.map((p) => ({ date: p.as_of_date, netWorth: p.net_worth })),
      overallLevel: latest.levels?.overall?.level ?? "L0",
      gatingPillar: latest.levels?.gating_pillar ?? "protect",
      pillarScores,
      kpis: latest.kpis || {},
      actionPlan: latest.recommendations || {},
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }
}
