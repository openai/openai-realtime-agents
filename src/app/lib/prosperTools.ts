/**
 * Simple domain tools for Prosper MVP.
 * All functions are deterministic and handle missing inputs by marking provisional keys.
 */

export type MQSInputs = Record<string, any>;

export function computeKpis(inputs: MQSInputs) {
  const prov: string[] = [];
  const get = (k: string, d?: number) => {
    const raw = (inputs as any)?.[k];
    const v = typeof raw === "string" ? Number(raw) : raw;
    if (!Number.isFinite(v)) { if (d !== undefined) prov.push(k); return d ?? 0; }
    return v as number;
  };

  const income_net_monthly = get("income_net_monthly", 0);
  const income_gross_monthly = get("income_gross_monthly", income_net_monthly || 0);
  const essentials_monthly = get("essentials_monthly", 0);
  const housing_total_monthly = get("housing_total_monthly", 0);
  const debt_required_payments_monthly = get("debt_required_payments_monthly", 0);
  const emergency_savings_liquid = get("emergency_savings_liquid", 0);
  const investment_contrib_monthly = get("investment_contrib_monthly", 0);

  const monthlyTotalExpenses = essentials_monthly + housing_total_monthly + debt_required_payments_monthly;

  const savings_rate_net = income_net_monthly > 0
    ? Math.max(0, Math.min(1, (income_net_monthly - monthlyTotalExpenses - investment_contrib_monthly) / income_net_monthly))
    : 0;

  const dti = (income_gross_monthly || income_net_monthly) > 0
    ? Math.max(0, Math.min(1, debt_required_payments_monthly / (income_gross_monthly || income_net_monthly)))
    : 0;

  const housing_ratio = income_net_monthly > 0
    ? Math.max(0, Math.min(1, housing_total_monthly / income_net_monthly))
    : 0;

  const ef_months = monthlyTotalExpenses > 0
    ? emergency_savings_liquid / monthlyTotalExpenses
    : 0;

  const pot = Number((inputs as any)?.retirement_pot_current);
  const target = Number((inputs as any)?.retirement_target_pot);
  const retirement_rr = Number.isFinite(pot) && Number.isFinite(target) && target > 0
    ? Math.max(0, Math.min(1, pot / target))
    : undefined;

  const kpis: Record<string, number | undefined> = {
    savings_rate_net,
    dti,
    housing_ratio,
    ef_months,
    retirement_rr,
  };

  return { kpis, provisional_keys: prov };
}

type PillarInfo = { score: number; level: string; provisional?: boolean };

export function assignProsperLevels(kpis: Record<string, any>) {
  // Map KPI → 0..100 scores
  const toScore = (val: number, good: number, bad: number) => {
    if (!Number.isFinite(val)) return 0;
    // linear scale: val==good => 85, val==bad => 15
    const minv = Math.min(good, bad);
    const maxv = Math.max(good, bad);
    const clamped = Math.max(minv, Math.min(maxv, val));
    const t = (clamped - bad) / (good - bad);
    return Math.round(15 + t * 70);
  };

  const spend = toScore(1 - (kpis.savings_rate_net ?? 0), 0.2, 0.6); // lower spend better
  const save  = toScore(kpis.ef_months ?? 0, 6, 0);                  // 6+ months good
  const borrow= toScore(1 - (kpis.dti ?? 0), 0.8, 0.2);              // lower DTI better
  const protect = toScore(kpis.insurance_coverage_index ?? 0, 1, 0); // placeholder
  const grow = toScore(kpis.retirement_rr ?? 0, 1, 0.3);

  const pillars: Record<string, PillarInfo> = {
    spend:   { score: spend,  level: toLevel(spend)  },
    save:    { score: save,   level: toLevel(save)   },
    borrow:  { score: borrow, level: toLevel(borrow) },
    protect: { score: protect,level: toLevel(protect), provisional: true },
    grow:    { score: grow,   level: toLevel(grow)   },
  };

  const entries = Object.entries(pillars) as [string, PillarInfo][];
  const gating = entries.reduce((min, cur) => (cur[1].score < min[1].score ? cur : min));
  const overallScore = Math.min(...entries.map(([, v]) => v.score));

  const checklist = [
    "Build emergency fund to 3–6 months",
    "Keep housing ≤ 30% of net income",
    "DTI ≤ 36% (prefer < 28% housing + < 8% other)",
  ];

  const levels = {
    pillars,
    overall: { level: toLevel(overallScore), provisional: true },
    gating_pillar: gating[0],
    checklist,
    eta_weeks: 8,
  };

  return levels;
}

export function generateRecommendations(kpis: Record<string, any>, levels: any, preferences?: Record<string, any>) {
  const gating: string = levels?.gating_pillar || "protect";
  const plan: Record<string, string[]> = {
    next_30_days: [],
    months_1_to_3: [],
    months_3_to_12: [],
  };

  if (gating === "save") {
    plan.next_30_days.push("Move payday transfers to the morning of payday (+$250/mo)");
    plan.months_1_to_3.push("Set up automatic transfers to emergency fund until 3 months");
  } else if (gating === "borrow") {
    plan.next_30_days.push("Refinance any APR > 20% to < 10%");
    plan.months_1_to_3.push("Snowball smallest balance while paying minimums on others");
  } else if (gating === "protect") {
    plan.next_30_days.push("Request quotes for income protection");
    plan.months_1_to_3.push("Set life cover ≈ 10× annual income (if dependents)");
  } else if (gating === "spend") {
    plan.next_30_days.push("Create a weekly essentials cap and track it");
  } else if (gating === "grow") {
    plan.months_1_to_3.push("Increase retirement contributions by +2–3pp of net income");
  }

  return plan;
}

function toLevel(score: number) {
  // 0..100 → L0..L9 (each 10 points)
  const idx = Math.max(0, Math.min(9, Math.floor((score ?? 0) / 10)));
  return `L${idx}`;
}