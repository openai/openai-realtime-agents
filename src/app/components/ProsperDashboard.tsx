"use client";

import React, { useEffect, useMemo, useState } from "react";

type SeriesPoint = { date: string; netWorth: number };
type PillarScore = { pillar: string; score: number; level: string };

type DashboardData = {
  householdId: string;
  currency: string;
  netWorthSeries: SeriesPoint[];
  overallLevel: string;
  gatingPillar: string;
  pillarScores: PillarScore[];
  kpis: Record<string, number>;
  actionPlan: {
    next_30_days?: string[];
    months_1_to_3?: string[];
    months_3_to_12?: string[];
    long_term?: string[];
  };
};

function formatMoney(n?: number, currency = "AUD") {
  if (typeof n !== "number") return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

function percent(n?: number) {
  if (typeof n !== "number") return "-";
  return `${Math.round(n * 100)}%`;
}

function LevelLadder({ current }: { current: string }) {
  const levels = Array.from({ length: 10 }, (_, i) => `L${i}`);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-semibold mb-1">Prosper Level</div>
      <div className="grid grid-cols-5 gap-1">
        {levels.map((lvl) => {
          const active = lvl === current;
          return (
            <div
              key={lvl}
              className={
                "rounded-lg border px-2 py-1 text-center text-sm " +
                (active ? "bg-emerald-100 border-emerald-300 font-semibold" : "bg-white border-gray-200")
              }
              title={lvl}
            >
              {lvl}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-500 mt-1">Current: {current}</div>
    </div>
  );
}

function MiniBar({ label, score, level }: { label: string; score: number; level: string }) {
  const width = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-xs text-gray-600 capitalize">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded">
        <div className="h-2 bg-gray-800 rounded" style={{ width: `${width}%` }} />
      </div>
      <div className="w-10 text-xs text-right">{width}</div>
      <div className="w-10 text-xs text-right">{level}</div>
    </div>
  );
}

function NetWorthChart({ data, currency }: { data: SeriesPoint[]; currency: string }) {
  const { points, minY, maxY } = useMemo(() => {
    if (!data?.length) return { points: "", minY: 0, maxY: 0 };
    const xs = data.map((_, i) => i);
    const ys = data.map((p) => p.netWorth);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = 280;
    const height = 120;
    const pad = 8;
    const scaleX = (i: number) => {
      if (xs.length <= 1) return pad;
      return pad + (i / (xs.length - 1)) * (width - pad * 2);
    };
    const scaleY = (v: number) => {
      if (maxY === minY) return height / 2;
      return height - pad - ((v - minY) / (maxY - minY)) * (height - pad * 2);
    };
    const points = data.map((p, i) => `${scaleX(i)},${scaleY(p.netWorth)}`).join(" ");
    return { points, minY, maxY };
  }, [data]);

  const last = data?.[data.length - 1];

  return (
    <div>
      <div className="text-sm font-semibold mb-1">Net Worth</div>
      <svg width="100%" viewBox="0 0 300 140" className="bg-white border border-gray-200 rounded-lg">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <div>{data?.[0]?.date ?? "-"}</div>
        <div>{last ? `${last.date} • ${formatMoney(last.netWorth, currency)}` : "-"}</div>
      </div>
    </div>
  );
}

export default function ProsperDashboard({
  householdId,
  initial,
}: {
  householdId: string;
  initial?: DashboardData;
}) {
  const [data, setData] = useState<DashboardData | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!initial);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`);
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!initial) load();
    return () => {
      cancelled = true;
    };
  }, [householdId, initial]);

  if (loading || !data) {
    return (
      <div className="w-1/2 bg-white rounded-xl p-4">
        <div className="animate-pulse text-sm text-gray-500">Loading dashboard…</div>
      </div>
    );
  }

  const { currency, kpis, pillarScores, actionPlan, netWorthSeries, overallLevel, gatingPillar } = data;

  return (
    <div className="w-1/2 overflow-auto rounded-xl bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Dashboard</div>
        <div className="text-xs text-gray-500">{data.householdId}</div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <NetWorthChart data={netWorthSeries} currency={currency} />

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-3">
            <LevelLadder current={overallLevel} />
            <div className="text-xs text-gray-500 mt-2">
              Gating pillar: <span className="capitalize font-medium">{gatingPillar}</span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Pillars</div>
            <div className="flex flex-col gap-2">
              {pillarScores.map((p) => (
                <MiniBar key={p.pillar} label={p.pillar} score={p.score} level={p.level} />
              ))}
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">KPIs</div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            {"savings_rate_net" in kpis && (
              <div> Savings Rate: <span className="font-medium">{percent(kpis.savings_rate_net)}</span></div>
            )}
            {"ef_months" in kpis && (
              <div> Emergency Fund: <span className="font-medium">{kpis.ef_months?.toFixed?.(1)} months</span></div>
            )}
            {"dti" in kpis && (
              <div> DTI: <span className="font-medium">{percent(kpis.dti)}</span></div>
            )}
            {"housing_ratio" in kpis && (
              <div> Housing Ratio: <span className="font-medium">{percent(kpis.housing_ratio)}</span></div>
            )}
            {"retirement_rr" in kpis && (
              <div> Retirement Readiness: <span className="font-medium">{percent(kpis.retirement_rr)}</span></div>
            )}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Action Plan</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(actionPlan || {}).map(([bucket, items]) => {
              if (!Array.isArray(items) || items.length === 0) return null;
              return (
                <div key={bucket}>
                  <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
                    {bucket.replaceAll("_", " ")}
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {items.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
