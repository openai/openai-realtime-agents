import { NextRequest, NextResponse } from "next/server";
import { insertSnapshot, upsertHousehold, upsertNetWorthPoint } from "@/app/lib/prosperDb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      householdId,
      inputs,
      kpis,
      levels,
      recommendations,
      netWorthPoint, // optional: { date: "YYYY-MM", netWorth: number }
      names, // optional: { primary?: string; secondary?: string }
      currency = inputs?.currency || "AUD",
      sessionId = null,
      provisional_keys = [],
    } = body || {};

    if (!householdId || !inputs || !kpis || !levels) {
      return NextResponse.json(
        { ok: false, error: "householdId, inputs, kpis, and levels are required" },
        { status: 400 }
      );
    }

    upsertHousehold(householdId, currency, names);
    const snapshot = insertSnapshot({
      householdId,
      inputs,
      kpis,
      levels,
      recommendations,
      provisional_keys,
      sessionId,
    });

    if (netWorthPoint?.date && Number.isFinite(netWorthPoint?.netWorth)) {
      upsertNetWorthPoint(householdId, netWorthPoint.date, netWorthPoint.netWorth);
    }

    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }
}
