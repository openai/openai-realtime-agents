// Lightweight in-memory "DB" for demo purposes.
// In production, replace with Postgres/Prisma or your preferred DB layer.

type Json = Record<string, any>;

type Snapshot = {
  id: string;
  createdAt: string; // ISO
  householdId: string;
  sessionId?: string | null;
  inputs: Json;
  kpis: Json;
  levels: Json;
  recommendations?: Json;
  provisional_keys?: string[];
};

type NetWorthPoint = {
  householdId: string;
  as_of_date: string; // YYYY-MM
  net_worth: number;
};

type Household = {
  id: string;
  primary_name?: string;
  secondary_name?: string;
  currency: string;
  created_at: string;
};

type DB = {
  households: Map<string, Household>;
  snapshots: Snapshot[];
  netWorthSeries: NetWorthPoint[];
};

declare global {
  // eslint-disable-next-line no-var
  var __PROSPER_DB__: DB | undefined;
}

function getDb(): DB {
  if (!globalThis.__PROSPER_DB__) {
    globalThis.__PROSPER_DB__ = {
      households: new Map(),
      snapshots: [],
      netWorthSeries: [],
    };
  }
  return globalThis.__PROSPER_DB__;
}

export function upsertHousehold(householdId: string, currency = "AUD", names?: { primary?: string; secondary?: string }) {
  const db = getDb();
  const existing = db.households.get(householdId);
  if (existing) return existing;
  const row: Household = {
    id: householdId,
    primary_name: names?.primary,
    secondary_name: names?.secondary,
    currency,
    created_at: new Date().toISOString(),
  };
  db.households.set(householdId, row);
  return row;
}

export function insertSnapshot(payload: {
  householdId: string;
  inputs: Json;
  kpis: Json;
  levels: Json;
  recommendations?: Json;
  provisional_keys?: string[];
  sessionId?: string | null;
}) {
  const db = getDb();
  const row: Snapshot = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    householdId: payload.householdId,
    sessionId: payload.sessionId ?? null,
    inputs: payload.inputs,
    kpis: payload.kpis,
    levels: payload.levels,
    recommendations: payload.recommendations,
    provisional_keys: payload.provisional_keys ?? [],
  };
  db.snapshots.push(row);
  return row;
}

export function upsertNetWorthPoint(householdId: string, as_of_date: string, net_worth: number) {
  const db = getDb();
  // Unique by (householdId, as_of_date)
  const idx = db.netWorthSeries.findIndex(
    (p) => p.householdId === householdId && p.as_of_date === as_of_date
  );
  if (idx >= 0) {
    db.netWorthSeries[idx].net_worth = net_worth;
    return db.netWorthSeries[idx];
  }
  const row: NetWorthPoint = { householdId, as_of_date, net_worth };
  db.netWorthSeries.push(row);
  return row;
}

export function getLatestSnapshot(householdId: string) {
  const db = getDb();
  const rows = db.snapshots
    .filter((s) => s.householdId === householdId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return rows[rows.length - 1] || null;
}

export function getNetWorthSeries(householdId: string) {
  const db = getDb();
  return db.netWorthSeries
    .filter((p) => p.householdId === householdId)
    .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));
}

export function seedDemoIfEmpty() {
  const db = getDb();
  if (db.snapshots.length > 0) return;

  const householdId = "PP-HH-0001";
  upsertHousehold(householdId, "AUD", { primary: "Maya", secondary: "Daniel" });

  insertSnapshot({
    householdId,
    inputs: {
      currency: "AUD",
      income_net_monthly: 10500,
      essentials_monthly: 5200,
      housing_total_monthly: 3200,
      debt_required_payments_monthly: 1100,
      emergency_savings_liquid: 18000,
      investment_contrib_monthly: 1800,
    },
    kpis: { savings_rate_net: 0.18, dti: 0.24, housing_ratio: 0.27, ef_months: 3.5, retirement_rr: 0.7 },
    levels: {
      pillars: {
        spend: { score: 45, level: "L4" },
        save: { score: 48, level: "L4" },
        borrow: { score: 37, level: "L3" },
        protect: { score: 20, level: "L2" },
        grow: { score: 43, level: "L4" },
      },
      overall: { level: "L3", provisional: true },
      gating_pillar: "protect",
      checklist: ["Add income protection", "Set life cover ≈ 10× annual income"],
      eta_weeks: 8,
    },
    recommendations: {
      next_30_days: [
        "Move payday transfers to the morning of payday (+$250/mo; Save +12 → L3→L4)",
        "Request quotes for income protection (Protect +20 → L2→L4)",
      ],
      months_1_to_3: [
        "Refinance 23% APR card to <10% (Borrow +15)",
        "Create sinking fund for known expenses ($150/mo)",
      ],
      months_3_to_12: [
        "Increase contributions by +2–3pp of net income",
        "Fee audit: switch to low-cost trackers (save ~$300/yr)",
      ],
    },
  });

  const series: Array<[string, number]> = [
    ["2025-05", 120000],
    ["2025-06", 125500],
    ["2025-07", 127200],
    ["2025-08", 129100],
  ];
  series.forEach(([as_of_date, net_worth]) =>
    upsertNetWorthPoint(householdId, as_of_date, net_worth)
  );
}
