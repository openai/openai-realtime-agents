import { DEFAULTS } from './config';
import type { Slots } from './schema/slots';
import { normaliseSlots, Normalized } from './normalise';

export type KpisV2 = {
  // Spend
  hr?: number | null; // Housing Ratio
  current_ratio?: number | null; // liquid_assets / short_term_liabilities_12m
  // Save
  sr?: number | null; // Savings Rate
  ef_months?: number | null; // Emergency Fund months
  lanw?: number | null; // Liquid assets / Net worth
  // Borrow
  dti_stock?: number | null;
  dsr_total?: number | null;
  nmdsr?: number | null;
  d_to_a?: number | null; // Debt to Asset
  credit_norm?: number | null; // 0..1
  // Protect (computed for gates, not ratios per se)
  years_cover?: number | null;
  months_covered?: number | null;
  // Grow
  rrr?: number | null; // Retirement readiness ratio (0..∞)
  invnw?: number | null; // Investable NW / NW
  nwm?: number | null; // Investable NW multiple of annual expenses
  pension_contrib_pct?: number | null; // 0..1
  ronw?: number | null; // 12m return on net worth

  // Legacy mirrors to keep the UI working until updated
  savings_rate_net?: number | null;
  housing_ratio?: number | null;
  dti?: number | null;
  retirement_rr?: number | null;
};

export type GatesV2 = {
  life_cover_ok?: boolean;
  income_protection_ok?: boolean;
  home_insured_ok?: boolean | null; // pass-through
  current_ratio_ok?: boolean | null; // hygiene (soft)
  notes?: string[];
};

export function computeKpisV2(slots: Slots, cfg = DEFAULTS): { kpis: KpisV2; gates: GatesV2; normalized: Normalized; provisional: string[] } {
  const nz = (v: number | null | undefined) => (Number.isFinite(v as number) ? (v as number) : null);
  const normalized = normaliseSlots(slots);
  const provisional: string[] = [];
  const notes: string[] = [];

  const ni = nz(normalized.net_income_total_monthly);
  const gi = nz(normalized.gross_income_annual_total);
  const exp = nz(normalized.total_expenses_monthly);
  const ess = nz(normalized.essential_expenses_monthly);
  const liquid = nz(normalized.liquid_assets);
  const invAssets = nz(normalized.investable_assets);
  const nw = nz(normalized.net_worth);
  const mortPay = nz(normalized.mortgage_payment_monthly);
  const rent = nz(normalized.rent_monthly);
  const runCost = nz(normalized.housing_running_costs_monthly) || 0;
  const shortTL = nz((slots.short_term_liabilities_12m as any)?.value);
  const otherDebtPmts = nz((slots.other_debt_payments_monthly_total as any)?.value) || 0;
  const dtiDebt = nz(normalized.total_debt_balance);

  const housingCostMonthly = (rent ?? 0) || (mortPay ?? 0);
  const hr = gi && gi > 0 ? (housingCostMonthly + runCost) / (gi / 12) : null;
  if (hr == null) {
    provisional.push('HR');
    notes.push('Add gross annual income and rent/mortgage to compute Housing Ratio.');
  }

  const current_ratio = shortTL && shortTL > 0 && liquid != null ? liquid / shortTL : null;
  if (current_ratio == null) {
    notes.push('Add liquid savings and short-term liabilities to compute Current Ratio.');
  }

  const sr = ni && ni > 0 && exp != null ? (ni - exp) / ni : null;
  if (sr == null) {
    provisional.push('SR');
    notes.push('Add monthly net income and total monthly expenses to compute Savings Rate.');
  }

  const ef_months = ess && ess > 0 && liquid != null ? liquid / ess : null;
  if (ef_months == null) {
    provisional.push('EF');
    notes.push('Add essential monthly expenses and liquid savings to compute Emergency Fund months.');
  }

  const lanw = nw && nw !== 0 && liquid != null ? liquid / nw : null;
  const invnw = nw && nw !== 0 && invAssets != null ? invAssets / nw : null;
  if (lanw == null || invnw == null) {
    notes.push('Add assets and debts to compute net worth, and savings/investments to compute LANW/INVNW.');
  }

  const dsr_total = ni && ni > 0 ? ((mortPay || 0) + otherDebtPmts + Math.max(0, normalized.inv_prop_payments_total - normalized.net_rent_total)) / ni : null;
  const nmdsr = ni && ni > 0 ? (otherDebtPmts) / ni : null;
  if (dsr_total == null) notes.push('Add monthly net income to compute Debt Servicing Ratio.');

  const dti_stock = gi && gi > 0 && dtiDebt != null ? dtiDebt / gi : null;
  if (dti_stock == null) notes.push('Add total debt balance and gross annual income to compute DTI.');
  const d_to_a = normalized.total_assets && normalized.total_assets > 0 && normalized.total_liabilities != null
    ? normalized.total_liabilities / normalized.total_assets
    : null;
  if (d_to_a == null) notes.push('Add total assets and total liabilities to compute Debt-to-Asset ratio.');

  const annualExp = exp != null ? exp * 12 : null;
  const investable_net_worth = invAssets ?? null; // v1 assumption
  const nwm = annualExp && annualExp > 0 && investable_net_worth != null ? investable_net_worth / annualExp : null;
  if (nwm == null) notes.push('Add annual expenses and investable assets to compute Net-Worth Multiple.');

  // Credit normalization
  let credit_norm: number | null = null;
  const suppliedNorm = nz((slots.credit_score_normalised_0_1 as any)?.value);
  if (suppliedNorm != null) {
    credit_norm = Math.max(0, Math.min(1, suppliedNorm));
  } else if ((slots.credit_raw_score as any)?.value != null) {
    const provider = (slots.credit_provider as any)?.value || 'generic';
    let min = (slots.credit_min as any)?.value ?? null;
    let max = (slots.credit_max as any)?.value ?? null;
    const prov = String(provider || '').toLowerCase();
    if (prov.includes('fico') || prov.includes('vantage')) { min = 300; max = 850; }
    if (prov.includes('experian') && (min == null || max == null)) { min = 0; max = 999; }
    if (prov.includes('equifax') && (min == null || max == null)) { min = 0; max = 1200; }
    if (min != null && max != null && max > min) {
      credit_norm = Math.max(0, Math.min(1, (((slots.credit_raw_score as any).value as number) - min) / (max - min)));
    }
  }

  // RoNW (12m)
  const ronw = nw && nw !== 0
    ? ((((slots.investment_returns_12m as any)?.value ?? null) as number | null || 0) - (((slots.interest_paid_12m as any)?.value ?? null) as number | null || 0)) / nw
    : null;
  if (ronw == null) notes.push('Add net worth (assets and debts) to compute Return on Net Worth.');

  // Pension contrib % (habit)
  const pension_contrib_pct = nz((slots.pension_contrib_pct as any)?.value);

  // Life cover gate
  const dependants = Math.max(0, ((slots.dependants_count as any)?.value ?? 0));
  const depMult = Math.min(2, 1 + 0.3 * dependants);
  const annualNeeds = (ess != null || exp != null)
    ? (Math.max(ess ?? 0, 0.6 * (exp ?? 0)) * 12 * depMult)
    : null;
  const lifeSum = nz((slots.life_insurance_sum as any)?.value) || 0;
  const years_cover = (annualNeeds && annualNeeds > 0)
    ? ((lifeSum + (liquid || 0) - (normalized.total_debt_balance || 0)) / annualNeeds)
    : null;

  // Income protection gate
  const sickFull = nz((slots.sick_pay_months_full as any)?.value) || 0;
  const sickHalf = nz((slots.sick_pay_months_half as any)?.value) || 0;
  let ipMonths = 0;
  const ipMonthly = nz((slots.ip_monthly_benefit as any)?.value);
  if (ipMonthly != null && ess && ess > 0) {
    const capMonths = ((slots.ip_benefit_period_years as any)?.value ?? null) ? Math.max(0, ((slots.ip_benefit_period_years as any).value as number) * 12) : Infinity;
    ipMonths = Math.min(capMonths, ipMonthly / ess);
  }
  const months_covered = sickFull + 0.5 * sickHalf + ipMonths;

  // Retirement Readiness (minimal v1)
  let rrr: number | null = null;
  const retireAge = nz((slots.retire_age as any)?.value);
  const birthYear = nz((slots.birth_year as any)?.value);
  const nowYear = new Date().getFullYear();
  const currentAge = birthYear != null ? nowYear - birthYear : null;
  const horizon = (retireAge != null && currentAge != null) ? Math.max(0, retireAge - currentAge) : null;
  const employerPctTotal = (((slots.employer_pension_pct_self as any)?.value ?? 0) + ((slots.employer_pension_pct_partner as any)?.value ?? 0));
  const giVal = gi ?? 0;
  const contribAnnual = (pension_contrib_pct ?? 0) * giVal + (employerPctTotal) * giVal;
  if (horizon != null) {
    const g = cfg.growth_real;
    const swr = cfg.swr_real;
    const future_pot = (invAssets ?? 0) * Math.pow(1 + g, horizon) + (contribAnnual) * ((Math.pow(1 + g, horizon) - 1) / g);
    const income_from_pot = swr * future_pot;
    const projected = income_from_pot + (((slots.state_pension_est_annual as any)?.value ?? 0) as number);
    const target = ((slots.retire_target_income_annual as any)?.value ?? null) as number | null;
    rrr = (target && target > 0) ? projected / target : null;
  }
  if (rrr == null) notes.push('Add retire age, birth year, investable assets, and target retirement income to compute RRR.');

  const kpis: KpisV2 = {
    hr, current_ratio, sr, ef_months, lanw, dti_stock, dsr_total, nmdsr, d_to_a, credit_norm,
    years_cover, months_covered, rrr, invnw, nwm, pension_contrib_pct, ronw,
    // legacy mirrors
    savings_rate_net: sr, housing_ratio: hr, dti: dti_stock, retirement_rr: rrr,
  };

  // Gates + data notes
  if ((dependants > 0) && years_cover == null) notes.push('Add life cover amount, liquid savings, and debts to assess life cover gate.');
  if (months_covered == null || months_covered === 0) notes.push('Add sick pay months and/or income protection benefit to assess income continuity gate.');

  const gates: GatesV2 = {
    life_cover_ok: (dependants > 0) ? (years_cover != null ? years_cover >= 5 : undefined) : true,
    income_protection_ok: months_covered != null ? months_covered >= 6 : undefined,
    home_insured_ok: ((slots.home_insured_ok as any)?.value ?? undefined) as boolean | undefined,
    current_ratio_ok: current_ratio != null ? current_ratio >= 1 : undefined,
    notes,
  };

  return { kpis, gates, normalized, provisional };
}
