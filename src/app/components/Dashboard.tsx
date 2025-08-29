"use client";
import React from "react";
import { ensureHouseholdId } from "@/app/lib/householdLocal";
import { getProsperLevelLabel } from "@/app/lib/prosperLevelLabels";
import { normaliseCurrency } from "@/app/lib/validate";

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
  entitlements?: { plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string };
  usage?: { free_limit?: number; used?: number; remaining?: number };
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
  const [billingInterval, setBillingInterval] = React.useState<'monthly'|'annual'>('monthly');

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

  // Auto-refresh when a snapshot is saved via chat
  React.useEffect(() => {
    const onSaved = () => load();
    window.addEventListener('pp:snapshot_saved', onSaved as any);
    return () => window.removeEventListener('pp:snapshot_saved', onSaved as any);
  }, [load]);

  const series = data?.series ?? [];
  const latest = data?.latestSnapshot ?? null;
  const kpis = data?.kpis ?? latest?.kpis ?? {};
  const levels = data?.levels ?? latest?.levels ?? {};
  const recs = (data?.recommendations ?? latest?.recommendations) as any;
  const entitlements = data?.entitlements ?? { plan: 'free' } as any;
  const isV2 = (kpis as any)?.engine_version === 'v2' || (kpis as any)?.gates != null;
  const gates = (kpis as any)?.gates as any | undefined;

  const last = series[series.length - 1]?.value;
  const prev = series.length > 1 ? series[series.length - 2]?.value : undefined;
  const delta = last != null && prev != null ? last - prev : undefined;
  const deltaPct = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : undefined;

  const currency = React.useMemo(() => {
    const cur = (latest as any)?.inputs?.currency as string | undefined;
    if (cur) return cur;
    const iso = (latest as any)?.inputs?.slots?.country?.value as string | undefined;
    if (iso) return normaliseCurrency(iso).code;
    return "AUD";
  }, [latest]);
  const name: string | null = React.useMemo(() => {
    const inputs = (latest as any)?.inputs || {};
    const slots = inputs?.slots || {};
    const cand = [
      slots?.full_name?.value,
      slots?.names?.value,
      inputs?.full_name,
      inputs?.names,
    ].filter(Boolean);
    let n: any = cand[0] ?? null;
    if (Array.isArray(n)) n = n.filter(Boolean).join(' & ');
    if (typeof n === 'string') {
      const s = n.trim();
      return s.length > 0 ? s : null;
    }
    return null;
  }, [latest]);
  const overallLevelCode = (levels?.overall?.level as string) || "L0";
  const overallLevelLabel = getProsperLevelLabel(overallLevelCode);
  const overallIdx = Number(overallLevelCode.match(/\d+/)?.[0] ?? 0);

  return (
    <div className="w-full h-full">
      <header className="flex items-start justify-between mb-4 gap-3">
        <div />
        <div className="flex items-center gap-2">
          {/* Free uses left nudge */}
          {data?.usage && entitlements?.plan !== 'premium' && (
            <div className="text-xs text-gray-600 mr-2">
              Free uses left: <b>{Math.max(0, Number((data?.usage as any)?.remaining ?? 0))}</b>
            </div>
          )}
          {/* Billing interval toggle */}
          <div className="hidden md:flex items-center text-xs border rounded-lg overflow-hidden">
            <button
              className={`px-2 py-1 ${billingInterval==='monthly' ? 'bg-gray-900 text-white' : 'bg-white'}`}
              onClick={() => setBillingInterval('monthly')}
              aria-pressed={billingInterval==='monthly'}
            >
              Monthly
            </button>
            <button
              className={`px-2 py-1 ${billingInterval==='annual' ? 'bg-gray-900 text-white' : 'bg-white'}`}
              onClick={() => setBillingInterval('annual')}
              aria-pressed={billingInterval==='annual'}
            >
              Annual
            </button>
          </div>
          {householdId && (
            entitlements?.plan === 'premium' ? (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/billing/create-portal-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
                    const j = await res.json();
                    if (j?.url) window.location.href = j.url;
                  } catch {}
                }}
                className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-white hover:bg-gray-50 text-xs shadow-sm"
              >
                Manage plan
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const email = (latest as any)?.inputs?.slots?.email?.value || (latest as any)?.inputs?.email;
                    const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email, interval: billingInterval }) });
                    const j = await res.json();
                    if (j?.url) window.location.href = j.url;
                  } catch {}
                }}
                className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-gray-900 text-white hover:bg-gray-800 text-xs shadow-sm"
              >
                Upgrade
              </button>
            )
          )}
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
          {/* ===== Hero: Status + Highlights ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">{name ? "Welcome" : "Household"}</div>
                  <div className="text-sm font-medium text-gray-900">{name ? name : (householdId ?? "—")}</div>
                </div>
                <div className="text-xs text-gray-500"></div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 bg-white">
                  <div className="text-xs text-gray-500">Level</div>
                  <div className="text-2xl font-semibold leading-tight">{overallLevelCode}</div>
                  <div className="text-xs text-gray-700">{overallLevelLabel}</div>
                  <div className="text-[11px] text-gray-600 mt-1">{levels?.overall?.points_to_next ?? ""}</div>
                  <div className="text-[11px] text-gray-600 mt-1">Gating: {levels?.gating_pillar ?? "—"} · ETA ~{levels?.eta_weeks ?? 8}w</div>
                </div>
                <UrgentKpis kpis={kpis as any} />
              </div>
            </Card>
          </div>

          {/* ===== Next Up (Actions) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <div className="text-sm text-gray-600 mb-3 font-medium">Next up</div>
              <NextActions recs={recs} />
            </Card>
          </div>
          {/* ===== Gates & Data (v2 only) ===== */}
          {isV2 && (
            <div className="xl:col-span-5">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600 font-medium">Gates & Data Readiness</div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  <Gate status={normBool(gates?.life_cover_ok)} label="Life cover (if dependants)" />
                  <Gate status={normBool(gates?.income_protection_ok)} label="Income continuity ≥ 6 mo" />
                  <Gate status={normBool(gates?.home_insured_ok)} label="Home insurance adequacy" />
                  <Gate status={normBool(gates?.current_ratio_ok)} label="Current ratio ≥ 1.0" />
                </div>
                {!!(gates?.notes?.length) && (
                  <div>
                    <div className="text-xs text-gray-600 mb-2">What to add next</div>
                    <div className="flex flex-wrap gap-2">
                      {(gates.notes as string[]).map((n: string, i: number) => (
                        <button
                          key={i}
                          className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                          title="Open in chat"
                          onClick={() => {
                            const text = `Can you help me with: ${n}?`;
                            try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text } })); } catch {}
                            try { navigator.clipboard.writeText(text); } catch {}
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ===== Net Worth ===== */}
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

              <div className="mt-4 text-gray-800">
                <RangeNetWorth series={series} entitlements={entitlements} onUpgrade={async () => {
                  if (!householdId) return;
                  try {
                    const email = (latest as any)?.inputs?.slots?.email?.value || (latest as any)?.inputs?.email;
                    const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email, interval: billingInterval }) });
                    const j = await res.json();
                    if (j?.url) window.location.href = j.url;
                  } catch {}
                }} />
              </div>
            </Card>
          </div>

          {/* ===== KPI Grid (by pillar, sorted by urgency) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-4">
              <KpiGrid kpis={kpis} />
            </Card>
          </div>

          {/* ===== Progress Ladder (mid‑page) ===== */}
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
          {/* Remove legacy Pillars and Action plan sections per new layout */}
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

function Gate({ status, label }: { status: boolean | undefined; label: string }) {
  const tone = status === true ? 'pass' : status === false ? 'fail' : 'unknown';
  const cls =
    tone === 'pass'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : tone === 'fail'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-gray-50 border-gray-200 text-gray-700';
  const dot =
    tone === 'pass' ? 'bg-emerald-500' : tone === 'fail' ? 'bg-red-500' : 'bg-gray-400';
  const text = tone === 'pass' ? 'Pass' : tone === 'fail' ? 'Needs attention' : 'Unknown';
  return (
    <div className={`rounded-md border p-2 text-xs ${cls}`} title={`${label}: ${text}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}

function normBool(v: any): boolean | undefined {
  if (v === true) return true;
  if (v === false) return false;
  return undefined;
}

function V2KpiBar({
  label,
  value,
  target,
  dir,
  format = "pct",
  subtitle,
  tooltip,
}: {
  label: string;
  value: number | null | undefined;
  target: number;
  dir: "higher" | "lower";
  format?: "pct" | "months" | "ratio";
  subtitle?: string;
  tooltip?: string;
}) {
  const raw = Number.isFinite(value as number) ? (value as number) : null;
  const meets = raw == null ? undefined : dir === "higher" ? raw >= target : raw <= target;
  let progress = 0;
  if (raw != null && target > 0) {
    progress = dir === "higher" ? raw / target : target / Math.max(raw, 1e-9);
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;
  }
  const tone = meets === true ? "good" : raw == null ? "unknown" : progress >= 0.7 ? "warn" : "bad";
  const barColor = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-yellow-500" : tone === "unknown" ? "bg-gray-300" : "bg-red-500";
  const fmt = (v: number | null) => {
    if (v == null) return "—";
    if (format === "pct") return fmtPct(v);
    if (format === "months") return `${(Math.round(v * 10) / 10).toFixed(1)} mo`;
    return String((Math.round(v * 100) / 100).toFixed(2));
  };
  const targetText = format === "pct" ? fmtPct(target) : format === "months" ? `${target} mo` : String(target);

  return (
    <div className="border rounded-lg p-3 bg-white" title={tooltip || undefined}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="flex items-baseline justify-between mt-0.5">
        <div className="text-lg font-semibold">{fmt(raw)}</div>
        <div className="text-[11px] text-gray-500">{subtitle ?? (dir === "higher" ? `Target ≥ ${targetText}` : `Target ≤ ${targetText}`)}</div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-gray-200">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

/** ===== Helpers: New mini components ===== */
function UrgentKpis({ kpis }: { kpis: any }) {
  // Build urgency list for v2 metrics; show compact progress bars
  const specs = [
    { key: 'ef_months', label: 'Emergency fund', value: kpis?.ef_months, target: 3, dir: 'higher' as const, format: 'months' as const },
    { key: 'sr', label: 'Savings rate', value: kpis?.sr, target: 0.20, dir: 'higher' as const, format: 'pct' as const },
    { key: 'dsr_total', label: 'Debt servicing', value: kpis?.dsr_total, target: 0.20, dir: 'lower' as const, format: 'pct' as const },
    { key: 'hr', label: 'Housing ratio', value: kpis?.hr, target: 0.40, dir: 'lower' as const, format: 'pct' as const },
  ];
  const urgency = (v: number | null | undefined, t: number, dir: 'higher' | 'lower') => {
    if (!Number.isFinite(v as number)) return -1;
    const n = v as number;
    return dir === 'higher' ? (n >= t ? 0 : (t - n) / Math.max(t, 1e-9)) : (n <= t ? 0 : (n - t) / Math.max(t, 1e-9));
  };
  const top = (specs as any[])
    .map((s: any) => ({ ...s, u: urgency(s.value, s.target, s.dir) }))
    .sort((a, b) => b.u - a.u)
    .slice(0, 3);
  const formatVal = (v: number | null | undefined, f: 'pct'|'months'|'ratio') => {
    if (!Number.isFinite(v as number)) return '—';
    const n = v as number;
    if (f === 'pct') return fmtPct(n);
    if (f === 'months') return `${(Math.round(n * 10) / 10).toFixed(1)} mo`;
    return String(Math.round(n * 100) / 100);
  };
  const progressPct = (v: number | null | undefined, t: number, dir: 'higher'|'lower') => {
    if (!Number.isFinite(v as number)) return 0;
    const n = v as number;
    let p = dir === 'higher' ? n / Math.max(t, 1e-9) : Math.min(1, Math.max(0, t / Math.max(n, 1e-9)));
    if (p > 1) p = 1; if (p < 0) p = 0; return p * 100;
  };
  return (
    <>
      {top.map((s) => (
        <div key={s.key} className="border rounded-lg p-3 bg-white">
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-gray-600">{s.label}</div>
            <div className="text-[11px] text-gray-500">Target {s.dir === 'higher' ? '≥' : '≤'} {s.format === 'pct' ? fmtPct(s.target) : s.format === 'months' ? `${s.target} mo` : String(s.target)}</div>
          </div>
          <div className="mt-0.5 text-lg font-semibold">{formatVal(s.value, s.format)}</div>
          <div className="mt-2 h-1 w-full rounded bg-gray-200">
            <div className="h-1 rounded bg-gray-700" style={{ width: `${Math.round(progressPct(s.value, s.target, s.dir))}%` }} />
          </div>
        </div>
      ))}
    </>
  );
}

function NextActions({ recs }: { recs: any }) {
  let arr: any[] = [];
  if (Array.isArray(recs)) arr = recs;
  else if (recs && typeof recs === 'object') arr = Object.values(recs).flat();
  const top = (arr || []).slice(0, 2);
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };
  if (!top || top.length === 0) {
    return <div className="text-sm text-gray-500">No recommendations yet. Provide more info in chat to unlock your plan.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {top.map((r, i) => {
        const title = r?.title || r?.action || r?.label || `Action ${i+1}`;
        const why = r?.why || r?.rationale || r?.reason;
        const how = r?.how || r?.steps || r?.next || r?.do;
        const prompt = typeof how === 'string' ? how : Array.isArray(how) ? how.join('\n') : title;
        const unlocks = r?.unlocks || r?.moves_to || r?.next_level || null;
        return (
          <div key={i} className="border rounded-lg p-3 bg-white">
            <div className="font-medium">{title}</div>
            {why && <div className="text-xs text-gray-600 mt-1">{why}</div>}
            {how && (
              <div className="text-xs text-gray-800 mt-2">
                {Array.isArray(how) ? (
                  <ul className="list-disc pl-4 space-y-1">{how.map((h: any, j: number) => <li key={j}>{String(h)}</li>)}</ul>
                ) : String(how)}
              </div>
            )}
            {unlocks && (
              <div className="mt-2 text-[11px] text-gray-600">Unlocks: {String(unlocks)}</div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => copyText(`Can you help me with: ${title}?\n${prompt}`)} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50">Copy prompt</button>
              <button
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => {
                  const text = `Can you help me with: ${title}?\n${prompt}`;
                  try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text } })); } catch {}
                }}
              >
                Open in chat
              </button>
              <button className="text-xs px-2 py-1 rounded border bg-gray-100 text-gray-400 cursor-not-allowed" disabled>Mark done</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SortedV2Kpis({ kpis }: { kpis: any }) {
  const specs = [
    { label: 'Savings rate', key: 'sr', value: kpis?.sr, target: 0.20, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 20%', tooltip: 'Shows cashflow surplus to fund goals.' },
    { label: 'Emergency fund', key: 'ef_months', value: kpis?.ef_months, target: 3, dir: 'higher' as const, format: 'months' as const, subtitle: 'Target ≥ 3 mo (next 6 mo)', tooltip: 'Helps estimate your shock buffer.' },
    { label: 'Housing ratio', key: 'hr', value: kpis?.hr, target: 0.40, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 40% (next 35%)', tooltip: 'Checks housing isn’t over‑stretching income.' },
    { label: 'Debt servicing (DSR)', key: 'dsr_total', value: kpis?.dsr_total, target: 0.20, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 20%', tooltip: 'Measures total debt payment pressure.' },
    { label: 'Non‑mortgage DSR', key: 'nmdsr', value: kpis?.nmdsr, target: 0.10, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 10%', tooltip: 'Highlights consumer‑debt pressure.' },
    { label: 'DTI (stock)', key: 'dti_stock', value: kpis?.dti_stock, target: 0.35, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.35', tooltip: 'Debt load vs annual income.' },
    { label: 'Debt / Asset', key: 'd_to_a', value: kpis?.d_to_a, target: 0.60, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.60', tooltip: 'Balance‑sheet solvency.' },
    { label: 'Retirement readiness', key: 'rrr', value: kpis?.rrr, target: 0.60, dir: 'higher' as const, format: 'ratio' as const, subtitle: 'Target ≥ 0.60 (next 1.00)', tooltip: 'Are you on track for target income?' },
    { label: 'Investable NW / NW', key: 'invnw', value: kpis?.invnw, target: 0.40, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 40%', tooltip: 'Share of wealth working toward goals.' },
    { label: 'Pension contribution', key: 'pension_contrib_pct', value: kpis?.pension_contrib_pct, target: 0.10, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 10%', tooltip: 'Long‑horizon saving habit.' },
  ];
  const urgency = (v: number | null | undefined, t: number, dir: 'higher'|'lower') => {
    if (!Number.isFinite(v as number)) return -1; // unknown -> push to end
    const n = v as number;
    if (dir === 'higher') return n >= t ? 0 : (t - n) / Math.max(t, 1e-9);
    return n <= t ? 0 : (n - t) / Math.max(t, 1e-9);
  };
  const sorted = specs.sort((a, b) => (urgency(b.value, b.target, b.dir) - urgency(a.value, a.target, a.dir)));
  return (
    <>
      {sorted.map(s => (
        <V2KpiBar key={s.key} label={s.label} value={s.value} target={s.target} dir={s.dir} format={s.format} subtitle={s.subtitle} tooltip={s.tooltip} />
      ))}
    </>
  );
}

function RangeNetWorth({ series, entitlements, onUpgrade }: { series: SeriesPoint[]; entitlements?: any; onUpgrade?: () => void }) {
  const [range, setRange] = React.useState<'1m'|'3m'|'1y'|'all'>('3m');
  const filtered = React.useMemo(() => {
    if (!series?.length) return [] as SeriesPoint[];
    if (range === 'all') return series;
    const now = new Date(series[series.length-1].ts).getTime();
    const delta = range === '1m' ? 30 : range === '3m' ? 90 : 365;
    return series.filter(p => {
      const t = new Date(p.ts).getTime();
      return (now - t) <= delta*24*60*60*1000;
    });
  }, [series, range]);
  const isPremium = entitlements?.plan === 'premium';
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
        {(['1m','3m','1y','all'] as const).map(r => {
          const gated = (r === '1y' || r === 'all') && !isPremium;
          return (
            <button
              key={r}
              onClick={() => gated ? (onUpgrade && onUpgrade()) : setRange(r)}
              className={`px-2 py-1 rounded border ${range===r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'} ${gated ? 'opacity-60' : ''}`}
              title={gated ? 'Upgrade to view full history' : undefined}
            >
              {r.toUpperCase()}
            </button>
          );
        })}
      </div>
      <Sparkline points={filtered} />
      {(!isPremium) && (
        <div className="mt-2 text-[11px] text-gray-600">Viewing last 3 months. <button className="underline" onClick={() => onUpgrade && onUpgrade()}>Upgrade</button> to see 1y and all‑time.</div>
      )}
    </div>
  );
}

/** KPI Grid with pillar filters */
function KpiGrid({ kpis }: { kpis: any }) {
  const [filter, setFilter] = React.useState<'all'|'spend'|'save'|'borrow'|'protect'|'grow'>('all');
  const specs = [
    { label: 'Savings rate', key: 'sr', value: kpis?.sr, target: 0.20, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 20%', tooltip: 'Shows cashflow surplus to fund goals.', pillar: 'save' },
    { label: 'Emergency fund', key: 'ef_months', value: kpis?.ef_months, target: 3, dir: 'higher' as const, format: 'months' as const, subtitle: 'Target ≥ 3 mo (next 6 mo)', tooltip: 'Helps estimate your shock buffer.', pillar: 'save' },
    { label: 'Housing ratio', key: 'hr', value: kpis?.hr, target: 0.40, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 40% (next 35%)', tooltip: 'Checks housing isn’t over‑stretching income.', pillar: 'spend' },
    { label: 'Debt servicing (DSR)', key: 'dsr_total', value: kpis?.dsr_total, target: 0.20, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 20%', tooltip: 'Measures total debt payment pressure.', pillar: 'borrow' },
    { label: 'Non‑mortgage DSR', key: 'nmdsr', value: kpis?.nmdsr, target: 0.10, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 10%', tooltip: 'Highlights consumer‑debt pressure.', pillar: 'borrow' },
    { label: 'DTI (stock)', key: 'dti_stock', value: kpis?.dti_stock, target: 0.35, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.35', tooltip: 'Debt load vs annual income.', pillar: 'borrow' },
    { label: 'Debt / Asset', key: 'd_to_a', value: kpis?.d_to_a, target: 0.60, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.60', tooltip: 'Balance‑sheet solvency.', pillar: 'borrow' },
    { label: 'Retirement readiness', key: 'rrr', value: kpis?.rrr, target: 0.60, dir: 'higher' as const, format: 'ratio' as const, subtitle: 'Target ≥ 0.60 (next 1.00)', tooltip: 'Are you on track for target income?', pillar: 'grow' },
    { label: 'Investable NW / NW', key: 'invnw', value: kpis?.invnw, target: 0.40, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 40%', tooltip: 'Share of wealth working toward goals.', pillar: 'grow' },
    { label: 'Pension contribution', key: 'pension_contrib_pct', value: kpis?.pension_contrib_pct, target: 0.10, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 10%', tooltip: 'Long‑horizon saving habit.', pillar: 'grow' },
  ];
  const urgency = (v: number | null | undefined, t: number, dir: 'higher'|'lower') => {
    if (!Number.isFinite(v as number)) return -1;
    const n = v as number;
    return dir === 'higher' ? (n >= t ? 0 : (t - n) / Math.max(t, 1e-9)) : (n <= t ? 0 : (n - t) / Math.max(t, 1e-9));
  };
  const sorted = specs.sort((a, b) => (urgency(b.value, b.target, b.dir) - urgency(a.value, a.target, a.dir)));
  const filtered = filter === 'all' ? sorted : sorted.filter(s => s.pillar === filter);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600 font-medium">KPI Grid</div>
        <div className="text-xs text-gray-500">Sorted by urgency</div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {(['all','spend','save','borrow','protect','grow'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-2 py-1 rounded border ${filter===p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s => (
          <V2KpiBar key={s.key} label={s.label} value={s.value} target={s.target} dir={s.dir} format={s.format} subtitle={s.subtitle} tooltip={s.tooltip} />
        ))}
      </div>
    </div>
  );
}
