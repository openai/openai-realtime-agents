"use client";

import React, { useMemo, useState } from "react";

/** ------------------------------
 *  Lightweight demo data models
 *  ------------------------------ */
type PillarKey = "spend" | "save" | "borrow" | "protect" | "grow";
type Level = `L${0|1|2|3|4|5|6|7|8|9}`;

type PillarScore = {
  score: number;   // 0–100
  level: Level;    // L0–L9
  delta?: number;  // change since last period
  notes?: string;
  provisional?: boolean;
};
type Pillars = Record<PillarKey, PillarScore>;

type KPIs = {
  savings_rate_net: number;
  dti: number;
  housing_ratio: number;
  ef_months: number;
  liquidity_ratio: number;
  invest_contrib_rate?: number;
};

type LevelsPayload = {
  pillars: Pillars;
  overall: { level: Level; provisional?: boolean };
  gating_pillar: PillarKey;
  eta_weeks?: number;
};

type ActionTask = {
  id: string;
  title: string;
  pillar: PillarKey;
  dueLabel: "This week" | "Next payday" | "This month" | "Later";
  expectedImpact?: string; // e.g., "+12 Save"
  addedToCalendar?: boolean;
  done?: boolean;
};

type NetWorthPoint = { t: string; v: number };

/** ------------------------------
 *  Demo data (matches your screenshot)
 *  ------------------------------ */
const NET_WORTH_SERIES: Record<"3m" | "6m" | "1y" | "all", NetWorthPoint[]> = {
  "3m": [
    { t: "2025-06-01", v: 146200 },
    { t: "2025-07-01", v: 149800 },
    { t: "2025-08-01", v: 151200 },
  ],
  "6m": [
    { t: "2025-03-01", v: 139400 },
    { t: "2025-05-01", v: 144000 },
    { t: "2025-06-01", v: 146200 },
    { t: "2025-07-01", v: 149800 },
    { t: "2025-08-01", v: 151200 },
  ],
  "1y": [
    { t: "2024-09-01", v: 132000 },
    { t: "2024-12-01", v: 136400 },
    { t: "2025-03-01", v: 139400 },
    { t: "2025-05-01", v: 144000 },
    { t: "2025-06-01", v: 146200 },
    { t: "2025-07-01", v: 149800 },
    { t: "2025-08-01", v: 151200 },
  ],
  "all": [
    { t: "2024-02-01", v: 120000 },
    { t: "2024-06-01", v: 128400 },
    { t: "2024-09-01", v: 132000 },
    { t: "2024-12-01", v: 136400 },
    { t: "2025-03-01", v: 139400 },
    { t: "2025-05-01", v: 144000 },
    { t: "2025-06-01", v: 146200 },
    { t: "2025-07-01", v: 149800 },
    { t: "2025-08-01", v: 151200 },
  ],
};

const DEMO_LEVELS: LevelsPayload = {
  pillars: {
    spend:   { score: 45, level: "L4", delta: +3 },
    save:    { score: 48, level: "L4", delta: +2 },
    borrow:  { score: 37, level: "L3", delta: +1 },
    protect: { score: 20, level: "L2", provisional: true, notes: "Income protection missing" },
    grow:    { score: 43, level: "L4", delta: +1 },
  },
  overall: { level: "L3", provisional: true },
  gating_pillar: "protect",
  eta_weeks: 8,
};

const DEMO_KPIS: KPIs = {
  savings_rate_net: 0.18,
  dti: 0.24,
  housing_ratio: 0.27,
  ef_months: 3.5,
  liquidity_ratio: 0.9,
  invest_contrib_rate: 0.17,
};

const DEMO_TASKS: ActionTask[] = [
  {
    id: "t1",
    title: "Move payday transfers (+$250/mo)",
    pillar: "save",
    dueLabel: "Next payday",
    expectedImpact: "+12 Save",
  },
  {
    id: "t2",
    title: "Request quotes for income protection",
    pillar: "protect",
    dueLabel: "This week",
    expectedImpact: "+20 Protect",
  },
  {
    id: "t3",
    title: "Refinance 23% APR card to <10%",
    pillar: "borrow",
    dueLabel: "This month",
    expectedImpact: "+15 Borrow",
  },
  {
    id: "t4",
    title: "Create sinking fund for known expenses",
    pillar: "spend",
    dueLabel: "Later",
    expectedImpact: "+8 Spend",
  },
];

/** ------------------------------
 *  Utilities
 *  ------------------------------ */
const currencyFmt = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pctFmt = (n: number, dp = 0) =>
  `${(n * 100).toFixed(dp)}%`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** ------------------------------
 *  Summary Strip
 *  ------------------------------ */
function SummaryStrip({
  range,
  setRange,
  series,
  levels,
}: {
  range: "3m" | "6m" | "1y" | "all";
  setRange: (r: "3m" | "6m" | "1y" | "all") => void;
  series: NetWorthPoint[];
  levels: LevelsPayload;
}) {
  const latest = series[series.length - 1]?.v ?? 0;
  const prev = series[Math.max(0, series.length - 2)]?.v ?? latest;
  const delta = latest - prev;
  const deltaPct = prev ? (delta / prev) : 0;

  const gating = levels.gating_pillar;
  const nextPoints = 8; // demo value for “points to next level”

  return (
    <div className="sticky top-0 z-10 bg-white/85 backdrop-blur border rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs text-gray-500">Net Worth</div>
          <div className="text-xl font-semibold">{currencyFmt(latest)}</div>
          <div className={`text-xs ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta >= 0 ? "▲" : "▼"} {currencyFmt(Math.abs(delta))} ({(deltaPct * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="border-l pl-6">
          <div className="text-xs text-gray-500">Level</div>
          <div className="text-xl font-semibold">{levels.overall.level}</div>
          <div className="text-xs text-gray-500">{nextPoints} pts to L{Number(levels.overall.level.slice(1)) + 1}</div>
        </div>

        <div className="border-l pl-6">
          <div className="text-xs text-gray-500">Gating pillar</div>
          <div className="inline-flex items-center gap-2">
            <span className="text-sm font-medium capitalize px-2 py-0.5 bg-gray-100 rounded">{gating}</span>
            {levels.overall.provisional && (
              <span className="text-xs text-amber-600 bg-amber-100 rounded px-2 py-0.5">Provisional</span>
            )}
          </div>
          <div className="text-xs text-gray-500">ETA ~{levels.eta_weeks ?? 8} weeks</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {(["3m", "6m", "1y", "all"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`text-xs px-2.5 py-1 rounded-md border ${range === r ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

/** ------------------------------
 *  Simple Area Chart (SVG)
 *  ------------------------------ */
function NetWorthChart({ series }: { series: NetWorthPoint[] }) {
  const w = 880, h = 240, pad = 24;
  const xs = series.map((p) => new Date(p.t).getTime());
  const ys = series.map((p) => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;

  const pts = series.map((p) => {
    const x = pad + ((new Date(p.t).getTime() - minX) / dx) * (w - 2 * pad);
    const y = h - pad - ((p.v - minY) / dy) * (h - 2 * pad);
    return { x, y };
  });

  const dLine = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");
  const dArea =
    pts.length > 1
      ? `${dLine} L ${pts[pts.length - 1].x},${h - pad} L ${pts[0].x},${h - pad} Z`
      : "";

  return (
    <div className="w-full">
      <div className="text-sm font-medium mb-2">Net Worth</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded-lg border bg-white">
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopOpacity="0.25" />
            <stop offset="100%" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill="#fff" />
        {pts.length > 1 && (
          <>
            <path d={dArea} fill="url(#nwFill)" />
            <path d={dLine} fill="none" stroke="#111827" strokeWidth={2} />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#111827" />
            ))}
          </>
        )}
      </svg>
      <div className="mt-2 text-xs text-gray-500">
        {series[0]?.t} — {series[series.length - 1]?.t} · {currencyFmt(series[series.length - 1]?.v || 0)}
      </div>
    </div>
  );
}

/** ------------------------------
 *  Progress Ring
 *  ------------------------------ */
function ProgressRing({ value, total }: { value: number; total: number }) {
  const size = 140, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(total ? value / total : 0, 0, 1);
  const dash = c * pct;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size/2} cy={size/2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke="#111827" strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-900 text-xl font-semibold">
        {value}/{total}
      </text>
    </svg>
  );
}

/** ------------------------------
 *  Level Card
 *  ------------------------------ */
function LevelCard({ levels }: { levels: LevelsPayload }) {
  const overall = levels.overall.level;
  const n = Number(overall.slice(1));
  return (
    <div>
      <div className="text-sm font-medium mb-2">Prosper Level</div>
      <div className="flex items-center gap-4">
        <div className="text-2xl font-semibold px-3 py-1 rounded-lg bg-gray-900 text-white">{overall}</div>
        <div className="text-sm text-gray-600">
          Gating pillar: <span className="capitalize font-medium">{levels.gating_pillar}</span>
          <div>ETA ~{levels.eta_weeks ?? 8} weeks</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {Array.from({ length: 10 }).map((_, i) => {
          const active = i === n;
          return (
            <span
              key={i}
              className={`px-2 py-1 rounded-md border text-xs ${active ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-white"}`}
            >
              L{i}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** ------------------------------
 *  Pillars Overview
 *  ------------------------------ */
const PILLAR_LABEL: Record<PillarKey, string> = {
  spend: "Spend", save: "Save", borrow: "Borrow", protect: "Protect", grow: "Grow"
};

function PillarsOverview({ pillars, gating }: { pillars: Pillars; gating: PillarKey }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">Pillars</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(Object.keys(pillars) as PillarKey[]).map((k) => {
          const p = pillars[k];
          const accent = k === gating;
          return (
            <div key={k} className={`rounded-lg border p-3 ${accent ? "ring-1 ring-gray-900" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm">{PILLAR_LABEL[k]}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${accent ? "bg-gray-900 text-white" : "bg-gray-100"}`}>{p.level}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded">
                <div className="h-2 rounded" style={{ width: `${p.score}%`, background: "#111827" }} />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {p.score}
                {typeof p.delta === "number" && (
                  <span className={`ml-1 ${p.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {p.delta >= 0 ? "↗︎" : "↘︎"} {Math.abs(p.delta)}
                  </span>
                )}
                {p.provisional && <span className="ml-2 text-amber-600">provisional</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ------------------------------
 *  KPI Tiles
 *  ------------------------------ */
function KPI({ label, value, subtitle, status }: { label: string; value: string; subtitle?: string; status: "good" | "warn" | "bad" }) {
  const cls = status === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
              status === "warn" ? "bg-amber-50 text-amber-700 border-amber-100" :
              "bg-rose-50 text-rose-700 border-rose-100";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-xs">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {subtitle && <div className="text-xs opacity-80">{subtitle}</div>}
    </div>
  );
}

function KpiTiles({ kpis }: { kpis: KPIs }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">KPIs</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <KPI label="Savings Rate (net)" value={pctFmt(kpis.savings_rate_net, 0)} subtitle="Target ≥ 20%" status={kpis.savings_rate_net >= 0.2 ? "good" : kpis.savings_rate_net >= 0.1 ? "warn" : "bad"} />
        <KPI label="Emergency Fund" value={`${kpis.ef_months.toFixed(1)} mo`} subtitle="Target 3–6 mo" status={kpis.ef_months >= 3 ? "good" : kpis.ef_months >= 1.5 ? "warn" : "bad"} />
        <KPI label="DTI" value={pctFmt(kpis.dti, 0)} subtitle="Target ≤ 36%" status={kpis.dti <= 0.36 ? "good" : kpis.dti <= 0.43 ? "warn" : "bad"} />
        <KPI label="Housing" value={pctFmt(kpis.housing_ratio, 0)} subtitle="Target 25–30% (gross)" status={kpis.housing_ratio <= 0.30 ? "good" : kpis.housing_ratio <= 0.35 ? "warn" : "bad"} />
        <KPI label="Liquidity Ratio" value={kpis.liquidity_ratio.toFixed(2)} subtitle="Target ≥ 1.0" status={kpis.liquidity_ratio >= 1 ? "good" : kpis.liquidity_ratio >= 0.8 ? "warn" : "bad"} />
        <KPI label="Invest Contrib" value={pctFmt(kpis.invest_contrib_rate ?? 0.17, 0)} subtitle="Target ≥ 15%" status={(kpis.invest_contrib_rate ?? 0.17) >= 0.15 ? "good" : "warn"} />
      </div>
    </div>
  );
}

/** ------------------------------
 *  Action Plan
 *  ------------------------------ */
function ActionPlan() {
  const [tasks, setTasks] = useState<ActionTask[]>(DEMO_TASKS);
  const [tab, setTab] = useState<"thisweek" | "later">("thisweek");

  const progress = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    return { done, total };
  }, [tasks]);

  const filtered = tasks.filter((t) =>
    tab === "thisweek" ? (t.dueLabel === "This week" || t.dueLabel === "Next payday") : (t.dueLabel === "This month" || t.dueLabel === "Later")
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl border p-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <ProgressRing value={progress.done} total={progress.total} />
          <div className="text-sm text-gray-600">Action progress</div>
          <button
            onClick={() => setTab("thisweek")}
            className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
          >
            This week
          </button>
        </div>
      </div>

      <div className="md:col-span-2 rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setTab("thisweek")}
            className={`text-sm px-3 py-1.5 rounded-md border ${tab === "thisweek" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
          >
            This week
          </button>
          <button
            onClick={() => setTab("later")}
            className={`text-sm px-3 py-1.5 rounded-md border ${tab === "later" ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
          >
            Later
          </button>
        </div>

        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="rounded-lg border p-3 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={t.done ?? false}
                  onChange={(e) =>
                    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)))
                  }
                  className="mt-1 h-4 w-4 rounded"
                />
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="capitalize">Pillar: {t.pillar}</span>
                    {t.expectedImpact && <span className="text-gray-400">·</span>}
                    {t.expectedImpact && <span>{t.expectedImpact}</span>}
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600">{t.dueLabel}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50">Add to calendar</button>
                <button className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50">Snooze</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** ------------------------------
 *  Dashboard root
 *  ------------------------------ */
export default function Dashboard() {
  const [range, setRange] = useState<"3m" | "6m" | "1y" | "all">("3m");
  const series = NET_WORTH_SERIES[range];

  return (
    <div className="w-1/2 overflow-auto rounded-xl bg-white p-4">
      <div className="text-lg font-semibold mb-2">Dashboard</div>

      <SummaryStrip range={range} setRange={setRange} series={series} levels={DEMO_LEVELS} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="lg:col-span-2 rounded-xl border p-4">
          <NetWorthChart series={series} />
        </div>
        <div className="rounded-xl border p-4">
          <LevelCard levels={DEMO_LEVELS} />
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-3">
        <PillarsOverview pillars={DEMO_LEVELS.pillars} gating={DEMO_LEVELS.gating_pillar} />
      </div>

      <div className="rounded-xl border p-4 mb-3">
        <KpiTiles kpis={DEMO_KPIS} />
      </div>

      <ActionPlan />
    </div>
  );
}
