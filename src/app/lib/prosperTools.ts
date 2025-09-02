// ================================================
// FILE: src/app/lib/prosperTools.ts
// ================================================

export type MQSInputs = Record<string, any>;
export type KPIs = {
  savings_rate_net?: number;   // 0..1
  dti?: number;                // 0..1 (lower better)
  housing_ratio?: number;      // 0..1 (lower better)
  ef_months?: number;          // months
  retirement_rr?: number;      // 0..1
};

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// tolerant number parser: "$6,500", "AUD 9000", "6.5k" → 6500 / 9000 / 6500
function toNumber(raw: any): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;

  let s = raw.trim().toLowerCase();
  s = s.replace(/aud|usd|eur|gbp|cad|nzd|chf|zar|hkd|¥|₩|₹|₱|₫|₴|₦/g, "");
  s = s.replace(/[\$\£\€\,\s]/g, "");
  let mul = 1;
  if (s.endsWith("k")) { mul = 1_000; s = s.slice(0, -1); }
  if (s.endsWith("m")) { mul = 1_000_000; s = s.slice(0, -1); }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v * mul : undefined;
}

export function computeKpis(inputs: MQSInputs): { kpis: KPIs; provisional_keys: string[] } {
  const prov: string[] = [];
  const get = (k: string, d?: number) => {
    const v = toNumber((inputs as any)?.[k]);
    if (!Number.isFinite(v as number)) { if (d !== undefined) prov.push(k); return d ?? 0; }
    return v as number;
  };

  // MQS-14 (subset)
  const income_net_monthly = get("income_net_monthly", 0);
  const income_gross_monthly = get("income_gross_monthly", income_net_monthly || 0);
  const essentials_monthly = get("essentials_monthly", 0);
  const housing_total_monthly = get("housing_total_monthly", 0);
  const debt_required_payments_monthly = get("debt_required_payments_monthly", 0);
  const emergency_savings_liquid = get("emergency_savings_liquid", 0);
  const investment_contrib_monthly = get("investment_contrib_monthly", 0);
  // optional retirement fields
  const retirement_pot_current = toNumber((inputs as any)?.retirement_pot_current);
  const retirement_target_pot = toNumber((inputs as any)?.retirement_target_pot);

  const monthlyTotalExpenses =
    essentials_monthly + housing_total_monthly + debt_required_payments_monthly;

  const savings_rate_net = income_net_monthly > 0
    ? clamp01((income_net_monthly - monthlyTotalExpenses - investment_contrib_monthly) / income_net_monthly)
    : 0;

  const dtiBase = income_gross_monthly || income_net_monthly;
  const dti = dtiBase > 0 ? clamp01(debt_required_payments_monthly / dtiBase) : 0;

  const housing_ratio = income_net_monthly > 0
    ? clamp01(housing_total_monthly / income_net_monthly)
    : 0;

  const ef_months = monthlyTotalExpenses > 0
    ? emergency_savings_liquid / monthlyTotalExpenses
    : 0;

  const retirement_rr =
    Number.isFinite(retirement_pot_current as number) &&
    Number.isFinite(retirement_target_pot as number) &&
    (retirement_target_pot as number) > 0
      ? clamp01((retirement_pot_current as number) / (retirement_target_pot as number))
      : undefined;

  const kpis: KPIs = { savings_rate_net, dti, housing_ratio, ef_months, retirement_rr };
  return { kpis, provisional_keys: prov };
}

/** Map KPI values into pillar scores/levels and overall. */
export function assignProsperLevels(kpis: KPIs) {
  // pillar scores 0–100
  const spendScore = Math.round(
    ( (1 - (kpis.housing_ratio ?? 0)) * 0.6 + (kpis.savings_rate_net ?? 0) * 0.4 ) * 100
  );

  const saveScore = Math.round(
    clamp01((kpis.ef_months ?? 0) / 6) * 100 // 6 months buffer ⇒ 100
  );

  const borrowScore = Math.round(
    clamp01(1 - (kpis.dti ?? 0)) * 100 // lower DTI is better
  );

  const growScore = Math.round(
    clamp01(kpis.retirement_rr ?? 0) * 100
  );

  // Protect: if you don't compute it yet, keep it provisional and low until you add insurance checks
  const protectScore = 15;

  const scoreToLevel = (s: number) => `L${Math.max(0, Math.min(9, Math.round(s / 10)))}`;

  const pillars = {
    spend:  { score: spendScore,   level: scoreToLevel(spendScore) },
    save:   { score: saveScore,    level: scoreToLevel(saveScore) },
    borrow: { score: borrowScore,  level: scoreToLevel(borrowScore) },
    protect:{ score: protectScore, level: scoreToLevel(protectScore), provisional: true },
    grow:   { score: growScore,    level: scoreToLevel(growScore) },
  };

  // Overall = average of pillars (simple for now)
  const avg = (spendScore + saveScore + borrowScore + protectScore + growScore) / 5;
  const overallLevel = scoreToLevel(avg);

  // Gating pillar = lowest score
  const entries = Object.entries(pillars) as Array<[keyof typeof pillars, any]>;
  const gating = entries.reduce((min, cur) => (cur[1].score < min[1].score ? cur : min), entries[0])[0];

  const levels = {
    overall: { level: overallLevel, provisional: true, points_to_next: "Keep momentum to reach next level." },
    pillars,
    checklist: [
      "Build emergency fund to 3–6 months",
      "Keep housing ≤ 30% of net income",
      "DTI ≤ 36% (prefer < 28% housing + < 8% other)",
    ],
    eta_weeks: 8,
    gating_pillar: gating,
  };

  return levels;
}

/** Produce a small, prioritised action plan from KPIs & levels. */
export function generateRecommendations(kpis: KPIs, levels: any, _preferences: Record<string, any> = {}) {
  const recs: any[] = [];
  const gating = levels?.gating_pillar ?? "spend";

  const add = (r: any) => recs.push({ priority: recs.length + 1, ...r });

  if (gating === "save" || (kpis.ef_months ?? 0) < 3) {
    add({
      pillar: "save",
      title: "Build a 3–6 month emergency fund",
      why: `You currently have ~${(kpis.ef_months ?? 0).toFixed(1)} months of buffer.`,
      how: [
        "Open a separate high-yield savings bucket",
        "Automate a weekly transfer equal to 5–10% of take-home pay",
      ],
      impact: "High",
      effort: "Low",
    });
  }

  if (gating === "spend" || (kpis.housing_ratio ?? 0) > 0.3) {
    add({
      pillar: "spend",
      title: "Keep housing ≤ 30% of net income",
      why: `Current housing ratio ≈ ${(Math.round((kpis.housing_ratio ?? 0) * 1000) / 10).toFixed(1)}%.`,
      how: [
        "Negotiate rent or refinance if feasible",
        "Target a 3–6% expense reduction across utilities/insurance",
      ],
      impact: "Medium",
      effort: "Medium",
    });
  }

  if ((kpis.dti ?? 0) > 0.36) {
    add({
      pillar: "borrow",
      title: "Reduce DTI below 36%",
      why: `Your DTI ≈ ${(Math.round((kpis.dti ?? 0) * 1000) / 10).toFixed(1)}%.`,
      how: [
        "Consolidate high-APR debt",
        "Automate overpayments on the smallest balance (debt snowball)",
      ],
      impact: "High",
      effort: "Medium",
    });
  }

  if ((kpis.savings_rate_net ?? 0) < 0.2) {
    add({
      pillar: "spend",
      title: "Lift savings rate to ≥ 20%",
      why: `Current savings rate ≈ ${(Math.round((kpis.savings_rate_net ?? 0) * 1000) / 10).toFixed(1)}%.`,
      how: [
        "Skim 1–2% from top spending categories",
        "Increase automatic investing by $50–$100/week",
      ],
      impact: "High",
      effort: "Low",
    });
  }

  if ((kpis.retirement_rr ?? 0) < 0.7 && (kpis.retirement_rr ?? 0) >= 0) {
    add({
      pillar: "grow",
      title: "Nudge retirement readiness toward 70%+",
      why: `Trajectory vs target ≈ ${(Math.round((kpis.retirement_rr ?? 0) * 1000) / 10).toFixed(1)}%.`,
      how: [
        "Increase contribution rate by 1–2% of salary",
        "Rebalance to target allocation annually",
      ],
      impact: "Medium",
      effort: "Low",
    });
  }

  // Always return at least one item
  if (recs.length === 0) {
    add({
      pillar: gating,
      title: "Small win this week",
      why: "Quick, confidence-building step unlocks momentum.",
      how: "Cancel one unused subscription and redirect the saving into your emergency fund.",
      impact: "Low",
      effort: "Low",
    });
  }

  return recs;
}
