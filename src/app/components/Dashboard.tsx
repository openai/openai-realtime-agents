"use client";
import React from "react";

// Basic shapes expected from /api/prosper/dashboard
export type SeriesPoint = { ts: string; value: number };
export type Snapshot = {
  id?: string;
  created_at?: string;
  inputs?: any;
  kpis?: any;
  levels?: any;
  recommendations?: any;
  provisional_keys?: string[];
};

export type DashboardPayload = {
  householdId?: string;
  latestSnapshot?: Snapshot | null;
  series?: SeriesPoint[];
  // mirrors supplied by the route for convenience
  kpis?: any;
  levels?: any;
  recommendations?: any;
};

// Small sparkline (no external libs)
function Sparkline({ points }: { points: SeriesPoint[] }) {
  const { d } = React.useMemo(() => {
    if (!points || points.length === 0) return { d: "" };
    const vals = points.map((p) => Number(p.value || 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
    const w = 260; // width of viewbox
    const h = 72;  // height of viewbox
    const step = vals.length > 1 ? w / (vals.length - 1) : w;
    const path = vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${h - norm(v) * h}`)
      .join(" ");
    return { d: path };
  }, [points]);

  if (!d) {
    return (
      <div className="h-20 w-full bg-gray-50 rounded-md border flex items-center justify-center text-xs text-gray-500">
        No data
      </div>
    );
  }

  return (
    <svg viewBox="0 0 260 72" className="h-20 w-full">
      <defs>
        <linearGradient id="slope" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#111827" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="#111827" strokeWidth="2" />
      <path d={`${d} L260,72 L0,72 Z`} fill="url(#slope)" stroke="none" />
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/prosper/dashboard", { cache: "no-store" });
        const json = (await res.json()) as DashboardPayload & { error?: string };
        if (!mounted) return;
        if ((json as any).error) throw new Error((json as any).error);
        setData(json);
      } catch (e: any) {
        setError(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const series = data?.series ?? [];
  const latest = data?.latestSnapshot ?? null;
  const kpis = data?.kpis ?? latest?.kpis ?? {};
  const levels = data?.levels ?? latest?.levels ?? {};

  const last = series[series.length - 1]?.value;
  const prev = series[series.length - 2]?.value;
  const delta = last != null && prev != null ? last - prev : null;
  const deltaPct = last != null && prev ? ((last - prev) / prev) * 100 : null;
  const currency = latest?.inputs?.currency || "USD";

  return (
    // Ensure the right column fills and scrolls within its area
    <div className="min-w-0 min-h-0 h-[calc(100vh-160px)] overflow-auto">
      <div className="bg-white border rounded-xl shadow-sm p-4 min-w-0">
        <div className="text-lg font-semibold mb-3">Dashboard</div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 min-w-0">
            {/* Summary card spans 3 on small, 2 on xl */}
            <div className="xl:col-span-3 2xl:col-span-2 min-w-0">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-500">Net Worth</div>
                <div className="mt-1 text-2xl font-semibold">
                  {last != null
                    ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(last)
                    : "—"}
                </div>
                {delta != null && deltaPct != null && (
                  <div className={`mt-1 text-xs ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {delta >= 0 ? "▲" : "▼"}{" "}
                    {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Math.abs(delta))}
                    {" "}({deltaPct.toFixed(1)}%)
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-6">
                  <div className="text-sm">
                    <div className="text-gray-500">Level</div>
                    <div className="text-xl font-semibold leading-tight">{levels?.overall?.level ?? "L0"}</div>
                    <div className="text-xs text-gray-500">{levels?.overall?.points_to_next ?? ""}</div>
                  </div>
                  <div className="text-sm min-w-[180px]">
                    <div className="text-gray-500">Gating pillar</div>
                    <div className="inline-flex items-center gap-2">
                      <span className="font-medium">{levels?.gating_pillar ?? "—"}</span>
                      {levels?.overall?.provisional && (
                        <span className="text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Provisional</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">ETA ~{levels?.eta_weeks ?? 8} weeks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Worth chart */}
            <div className="xl:col-span-2 min-w-0">
              <div className="border rounded-lg p-4 h-full">
                <div className="text-sm text-gray-600 mb-2">Net Worth</div>
                <Sparkline points={series} />
                {last != null && (
                  <div className="mt-2 text-xs text-gray-500">
                    {series[0]?.ts?.slice(0, 10)} – {series[series.length - 1]?.ts?.slice(0, 10)} · {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(last)}
                  </div>
                )}
              </div>
            </div>

            {/* Level card */}
            <div className="xl:col-span-1 min-w-0">
              <div className="border rounded-lg p-4 h-full grid grid-rows-[auto_1fr]">
                <div className="text-sm text-gray-600 mb-2">Prosper Level</div>
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xl font-bold">
                    {levels?.overall?.level ?? "L0"}
                  </div>
                  <div className="text-xs text-gray-600 leading-5 min-w-0">
                    <div><span className="text-gray-800">Gating pillar:</span> {levels?.gating_pillar ?? "—"}</div>
                    <div>ETA ~{levels?.eta_weeks ?? 8} weeks</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`text-[10px] px-2 py-1 rounded border text-center ${
                        (levels?.overall?.level || "L0") === `L${i}`
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      L{i}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pillars */}
            <div className="xl:col-span-3 min-w-0">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-3">Pillars</div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 min-w-0">
                  {(["spend", "save", "borrow", "protect", "grow"] as const).map((p) => {
                    const item = levels?.pillars?.[p];
                    return (
                      <div key={p} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 capitalize">{p}</div>
                          <div className="text-sm font-semibold">{item?.level ?? "L0"}</div>
                        </div>
                        <div
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            item?.score >= 60
                              ? "bg-emerald-50 text-emerald-700"
                              : item?.score >= 40
                              ? "bg-yellow-50 text-yellow-800"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {Math.round(item?.score ?? 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
