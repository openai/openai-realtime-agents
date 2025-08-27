"use client";
import React from "react";
import { ensureHouseholdId } from "@/app/lib/householdLocal";
import { getProsperLevelLabel } from "@/app/lib/prosperLevelLabels";

/** ===== Types expected from /api/prosper/dashboard ===== */
export type SeriesPoint = { ts: string; value: number };

export type Snapshot = {
  id?: string;
  created_at?: string;
  inputs?: any;
  kpis?: Record<string, any> | null;
  levels?: any;
  recommendations?: any;
  provisional_keys?: string[];
};

export type DashboardPayload = {
  householdId?: string;
  latestSnapshot?: Snapshot | null;
  /** convenience mirrors from latestSnapshot (server may include) */
  kpis?: Record<string, any> | null;
  levels?: any;
  recommendations?: any;
  series?: SeriesPoint[];
};

/** ===== Helpers ===== */
const fmtCurrency = (n: number, currency = "AUD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) =>
  `${(Number.isFinite(n) ? Math.round(n * 1000) / 10 : 0).toFixed(1)}%`;

function kpiOrDash(v: any, kind: "pct" | "num" | "months" = "num") {
  if (v == null || Number.isNaN(Number(v))) return "—";
  if (kind === "pct") return fmtPct(Number(v));
  if (kind === "months") return `${(Math.round(Number(v) * 10) / 10).toFixed(1)} mo`;
  return String(v);
}

/** Minimal sparkline (no deps) */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  const { d, areaD } = React.useMemo(() => {
    if (!points || points.length === 0) return { d: "", areaD: "" };
    const vals = points.map((p) => Number(p.value || 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
    const w = 260;
    const h = 72;
    const step = vals.length > 1 ? w / (vals.length - 1) : w;
    const coords = vals.map((v, i) => [i * step, h - norm(v) * h] as const);
    const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
    const areaPath = `${path} L ${w},${h} L 0,${h} Z`;
    return { d: path, areaD: areaPath };
  }, [points]);

  if (!d) {
    return (
      <div className="h-20 w-full bg-white rounded-md border flex items-center justify-center text-xs text-gray-500">
        <div className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#9CA3AF" /></svg>
          No data
        </div>
      </div>
    );
  }

  return (
    <svg viewBox="0 0 260 72" className="h-20 w-full" role="img" aria-label="Net worth trend">
      <defs>
        <linearGradient id="slope" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#slope)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** ===== Dashboard ===== */
export default function Dashboard() {
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [householdId, setHouseholdId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await ensureHouseholdId();
      setHouseholdId(id);
      const res = await fetch(`/api/prosper/dashboard?householdId=${id}`, { cache: "no-store" });
      const json = (await res.json()) as DashboardPayload & { error?: string };
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const series = data?.series ?? [];
  const latest = data?.latestSnapshot ?? null;
  const kpis = data?.kpis ?? latest?.kpis ?? {};
  const levels = data?.levels ?? latest?.levels ?? {};
  const recs = (data?.recommendations ?? latest?.recommendations) as any;

  const last = series[series.length - 1]?.value;
  const prev = series.length > 1 ? series[series.length - 2]?.value : undefined;
  const delta = last != null && prev != null ? last - prev : undefined;
  const deltaPct = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : undefined;

  const currency = "AUD";
  const overallLevelCode = (levels?.overall?.level as string) || "L0";
  const overallLevelLabel = getProsperLevelLabel(overallLevelCode);
  const overallIdx = Number(overallLevelCode.match(/\d+/)?.[0] ?? 0);

  return (
    <div className="w-full h-full">
      <header className="flex items-start justify-between mb-4 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Household</div>
          <div className="font-mono text-xs break-all text-gray-700">{householdId ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-white hover:bg-gray-50 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
            title="Re-fetch from server"
            aria-label="Refresh dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.343-5.657L20 8" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-live="polite" className="grid grid-cols-1 xl:grid-cols-5 gap-4 animate-pulse">
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-36" />
          <div className="xl:col-span-3 bg-white border rounded-xl shadow-sm h-64" />
          <div className="xl:col-span-2 bg-white border rounded-xl shadow-sm h-64" />
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-28" />
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* ===== Horizontal Progress Ladder (full width, above Net Worth) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600 font-medium">Progress ladder</div>
                <div className="text-xs text-gray-600">Current: {overallLevelCode} — {overallLevelLabel}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2">
                {Array.from({ length: 10 }).map((_, i) => {
                  const label = getProsperLevelLabel(i);
                  const completed = i < overallIdx;
                  const current = i === overallIdx;
                  const stateClass = current
                    ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                    : completed
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-white border-gray-200 text-gray-700";
                  return (
                    <div
                      key={i}
                      className={`rounded-md border p-2 text-center ${stateClass}`}
                      aria-current={current ? "step" : undefined}
                      title={`L${i} — ${label}`}
                    >
                      <div className="text-[11px] font-medium">L{i}</div>
                      <div className="text-xs leading-4">{label}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          {/* Overview / header */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-gray-500 text-sm">Net worth</div>
                  <div className="text-3xl font-semibold leading-tight tracking-tight">
                    {last != null ? fmtCurrency(last, currency) : "—"}
                  </div>
                  {delta != null && deltaPct != null && (
                    <div className={`mt-1 text-xs ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {delta >= 0 ? "▲" : "▼"} {fmtCurrency(Math.abs(delta), currency)} ({deltaPct.toFixed(1)}%)
                    </div>
                  )}
                </div>

                <div className="flex items-stretch gap-6">
                  {/* Level summary */}
                  <div className="text-sm">
                    <div className="text-gray-500">Level</div>
                  <div className="text-2xl font-semibold leading-tight">
                    {overallLevelCode}
                  </div>
                  <div className="text-xs text-gray-700">{overallLevelLabel}</div>
                  <div className="text-xs text-gray-500">
                    {levels?.overall?.points_to_next ?? ""}
                  </div>
                  </div>

                  {/* Gating pillar */}
                    <div className="text-sm min-w-[180px]">
                      <div className="text-gray-500">Gating pillar</div>
                      <div className="inline-flex items-center gap-2">
                        <span className="font-medium">{levels?.gating_pillar ?? "—"}</span>
                        {levels?.overall?.provisional && (
                          <span className="text-[10px] uppercase bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Provisional
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">ETA ~{levels?.eta_weeks ?? 8} weeks</div>
                    </div>

                  {/* Missing info callout */}
                  {!!latest?.provisional_keys?.length && (
                    <div className="text-sm">
                      <div className="text-gray-500">Missing info</div>
                      <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-900 rounded px-2 py-1 max-w-[280px]">
                        I still need:{" "}
                        {latest.provisional_keys.join(", ").replaceAll("_", " ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Net worth sparkline */}
              <div className="mt-4 text-gray-800">
                <Sparkline points={series} />
              </div>
            </Card>
          </div>

          

          {/* ===== KPIs (moved below, full width) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="text-sm text-gray-600 mb-3 font-medium">Key KPIs</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard
                  label="Savings rate (net)"
                  value={kpiOrDash(kpis?.savings_rate_net, "pct")}
                  hint="≥20% is a solid target"
                  tone={numTone(kpis?.savings_rate_net, { good: 0.2, warn: 0.1 })}
                />
                <KpiCard
                  label="Housing ratio"
                  value={kpiOrDash(kpis?.housing_ratio, "pct")}
                  hint="Aim ≤30% of net"
                  tone={numTone(kpis?.housing_ratio, { goodBelow: 0.3, warnBelow: 0.4 })}
                />
                <KpiCard
                  label="Debt-to-income (DTI)"
                  value={kpiOrDash(kpis?.dti, "pct")}
                  hint="Lower is better"
                  tone={numTone(kpis?.dti, { goodBelow: 0.35, warnBelow: 0.45 })}
                />
                <KpiCard
                  label="Emergency fund"
                  value={kpiOrDash(kpis?.ef_months, "months")}
                  hint="3–6 months recommended"
                  tone={numTone(kpis?.ef_months, { good: 6, warn: 3 }, "higher")}
                />
                <KpiCard
                  label="Retirement readiness"
                  value={kpiOrDash(kpis?.retirement_rr, "pct")}
                  hint="Trajectory vs. target"
                  tone={numTone(kpis?.retirement_rr, { good: 0.7, warn: 0.5 })}
                />
                <KpiCard
                  label="Investing / month"
                  value={kpis?.investment_contrib_monthly != null ? fmtCurrency(Number(kpis.investment_contrib_monthly), currency) : "—"}
                  hint=""
                  tone="neutral"
                />
              </div>
            </Card>
          </div>

          {/* Pillars */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="text-sm text-gray-600 mb-3 font-medium">Pillars</div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                {(["spend", "save", "borrow", "protect", "grow"] as const).map((p) => {
                  const item = levels?.pillars?.[p];
                  return (
                    <div key={p} className="border rounded-lg p-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">
                      <div>
                        <div className="text-xs text-gray-500 capitalize">{p}</div>
                        <div className="text-sm font-semibold">{item?.level ?? "L0"}</div>
                      </div>
                      <div
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          (item?.score ?? 0) >= 60
                            ? "bg-emerald-50 text-emerald-700"
                            : (item?.score ?? 0) >= 40
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
            </Card>
          </div>

          {/* ===== Action plan ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="text-sm text-gray-600 mb-3 font-medium">Action plan</div>

              {!recs || (Array.isArray(recs) && recs.length === 0) ? (
                <div className="text-sm text-gray-500">No recommendations yet. Provide more info in chat to unlock your plan.</div>
              ) : Array.isArray(recs) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {recs.map((r: any, i: number) => (
                    <RecommendationCard key={r?.id ?? i} rec={r} />
                  ))}
                </div>
              ) : (
                // If the tool returns an object keyed by buckets
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Object.entries(recs).map(([bucket, arr]: any) => (
                    <div key={bucket} className="border rounded-lg p-3 bg-white">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{bucket}</div>
                      <div className="space-y-2">
                        {(arr ?? []).map((r: any, i: number) => <RecommendationCard key={`${bucket}-${i}`} rec={r} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/** ===== Small presentational components ===== */

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-yellow-200"
      : tone === "bad"
      ? "border-red-200"
      : "border-gray-200";
  const accentClass =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-yellow-500"
      : tone === "bad"
      ? "bg-red-500"
      : "bg-gray-200";

  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className={`h-8 w-1.5 rounded-sm ${accentClass}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-600 truncate">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
          {hint ? <div className="text-[11px] text-gray-500 mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function numTone(
  v: any,
  thresholds: { good?: number; warn?: number; goodBelow?: number; warnBelow?: number },
  direction: "higher" | "lower" = "higher"
): "good" | "warn" | "bad" | "neutral" {
  const n = Number(v);
  if (!Number.isFinite(n)) return "neutral";

  if (thresholds.goodBelow != null || thresholds.warnBelow != null) {
    // lower is better
    if (n <= (thresholds.goodBelow ?? -Infinity)) return "good";
    if (n <= (thresholds.warnBelow ?? -Infinity)) return "warn";
    return "bad";
  }

  // higher is better
  if (n >= (thresholds.good ?? Infinity)) return "good";
  if (n >= (thresholds.warn ?? Infinity)) return "warn";
  return "bad";
}

function RecommendationCard({ rec }: { rec: any }) {
  // Support either a string or a structured object
  if (typeof rec === "string") {
    return (
      <div className="border rounded-lg p-3 bg-white shadow-sm">
        <div className="text-sm">{rec}</div>
      </div>
    );
  }

  const title = rec?.title || rec?.action || rec?.label || "Recommendation";
  const why = rec?.why || rec?.rationale || rec?.reason;
  const how = rec?.how || rec?.steps || rec?.next || rec?.do;
  const impact = rec?.impact ?? rec?.score ?? rec?.benefit;
  const effort = rec?.effort ?? rec?.cost ?? rec?.lift;
  const badge =
    rec?.pillar || rec?.kpi || rec?.category || (rec?.priority ? `P${rec.priority}` : null);

  return (
    <div className="border rounded-lg p-3 bg-white shadow-sm hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium leading-5">{title}</div>
        {badge && <div className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700">{String(badge)}</div>}
      </div>
      {why && <div className="text-xs text-gray-600 mt-1">{why}</div>}
      {how && (
        <div className="text-xs text-gray-800 mt-2">
          {Array.isArray(how) ? (
            <ul className="list-disc pl-4 space-y-1">
              {how.map((h, i) => <li key={i}>{String(h)}</li>)}
            </ul>
          ) : (
            String(how)
          )}
        </div>
      )}
      {(impact != null || effort != null) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
          {impact != null && <span>Impact: <b>{impact}</b></span>}
          {effort != null && <span>• Effort: <b>{effort}</b></span>}
        </div>
      )}
    </div>
  );
}

/** Small card wrapper for consistent styling */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border rounded-xl shadow-sm ${className}`}>{children}</div>;
}
