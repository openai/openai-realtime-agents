import { NextRequest, NextResponse } from "next/server";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import type { Slots } from "@/app/lib/schema/slots";
import type { KpisV2, GatesV2 } from "@/app/lib/kpiEngine";

function scenarioA(): Slots {
  // Renter starter
  return {
    net_income_monthly_self: { value: 4000, confidence: 'med' },
    net_income_monthly_partner: { value: 0, confidence: 'med' },
    total_expenses_monthly: { value: 3000, confidence: 'med' },
    essential_expenses_monthly: { value: 2000, confidence: 'med' },

    housing_status: { value: 'rent', confidence: 'high' },
    rent_monthly: { value: 1500, confidence: 'med' },
    housing_running_costs_monthly: { value: 200, confidence: 'low' },

    cash_liquid_total: { value: 3000, confidence: 'med' },
    term_deposits_le_3m: { value: 0, confidence: 'med' },
    investments_ex_home_total: { value: 20000, confidence: 'med' },
    pension_balance_total: { value: 10000, confidence: 'med' },

    other_debt_payments_monthly_total: { value: 250, confidence: 'med' },
    other_debt_balances_total: { value: 4000, confidence: 'med' },
    short_term_liabilities_12m: { value: 2000, confidence: 'med' },

    gross_income_annual_self: { value: 65000, confidence: 'med' },

    retire_age: { value: 65, confidence: 'med' },
    birth_year: { value: new Date().getFullYear() - 35, confidence: 'med' },
    retire_target_income_annual: { value: 40000, confidence: 'med' },
    state_pension_est_annual: { value: 12000, confidence: 'low' },
    pension_contrib_pct: { value: 0.05, confidence: 'low' },
  };
}

function scenarioB(): Slots {
  // Homeowner buffer (aiming L5–L6)
  return {
    net_income_monthly_self: { value: 7000, confidence: 'med' },
    net_income_monthly_partner: { value: 3000, confidence: 'med' },
    total_expenses_monthly: { value: 7000, confidence: 'med' },
    essential_expenses_monthly: { value: 4200, confidence: 'med' },

    housing_status: { value: 'own', confidence: 'high' },
    home_value: { value: 800000, confidence: 'med' },
    mortgage_payment_monthly: { value: 2800, confidence: 'med' },
    mortgage_balance: { value: 450000, confidence: 'med' },
    housing_running_costs_monthly: { value: 500, confidence: 'med' },

    cash_liquid_total: { value: 20000, confidence: 'med' },
    term_deposits_le_3m: { value: 10000, confidence: 'med' },
    investments_ex_home_total: { value: 120000, confidence: 'med' },
    pension_balance_total: { value: 90000, confidence: 'med' },

    other_debt_payments_monthly_total: { value: 300, confidence: 'med' },
    other_debt_balances_total: { value: 6000, confidence: 'med' },
    short_term_liabilities_12m: { value: 5000, confidence: 'med' },

    gross_income_annual_self: { value: 110000, confidence: 'med' },
    gross_income_annual_partner: { value: 40000, confidence: 'med' },

    dependants_count: { value: 1, confidence: 'med' },
    life_insurance_sum: { value: 150000, confidence: 'low' },
    home_insured_ok: { value: true, confidence: 'high' },

    retire_age: { value: 65, confidence: 'med' },
    birth_year: { value: new Date().getFullYear() - 42, confidence: 'med' },
    retire_target_income_annual: { value: 60000, confidence: 'med' },
    state_pension_est_annual: { value: 14000, confidence: 'low' },
    pension_contrib_pct: { value: 0.10, confidence: 'low' },
  };
}

function scenarioC(): Slots {
  // Resilient/Secure: likely L7–L8
  return {
    net_income_monthly_self: { value: 11000, confidence: 'high' },
    net_income_monthly_partner: { value: 6000, confidence: 'high' },
    total_expenses_monthly: { value: 9000, confidence: 'med' },
    essential_expenses_monthly: { value: 5200, confidence: 'med' },

    housing_status: { value: 'own', confidence: 'high' },
    home_value: { value: 1200000, confidence: 'med' },
    mortgage_payment_monthly: { value: 3500, confidence: 'med' },
    mortgage_balance: { value: 300000, confidence: 'med' },
    housing_running_costs_monthly: { value: 600, confidence: 'med' },

    cash_liquid_total: { value: 60000, confidence: 'med' },
    term_deposits_le_3m: { value: 20000, confidence: 'med' },
    investments_ex_home_total: { value: 600000, confidence: 'med' },
    pension_balance_total: { value: 400000, confidence: 'med' },

    other_debt_payments_monthly_total: { value: 200, confidence: 'med' },
    other_debt_balances_total: { value: 3000, confidence: 'med' },
    short_term_liabilities_12m: { value: 8000, confidence: 'med' },

    gross_income_annual_self: { value: 180000, confidence: 'med' },
    gross_income_annual_partner: { value: 90000, confidence: 'med' },

    dependants_count: { value: 2, confidence: 'med' },
    life_insurance_sum: { value: 500000, confidence: 'med' },
    income_protection_has: { value: true, confidence: 'med' },
    ip_monthly_benefit: { value: 4000, confidence: 'med' },
    sick_pay_months_full: { value: 2, confidence: 'low' },
    sick_pay_months_half: { value: 2, confidence: 'low' },
    home_insured_ok: { value: true, confidence: 'high' },

    retire_age: { value: 60, confidence: 'med' },
    birth_year: { value: new Date().getFullYear() - 45, confidence: 'med' },
    retire_target_income_annual: { value: 80000, confidence: 'med' },
    state_pension_est_annual: { value: 15000, confidence: 'low' },
    pension_contrib_pct: { value: 0.15, confidence: 'low' },
    employer_pension_pct_self: { value: 0.05, confidence: 'low' },
    employer_pension_pct_partner: { value: 0.05, confidence: 'low' },

    credit_score_normalised_0_1: { value: 0.72, confidence: 'med' },
    investment_returns_12m: { value: 40000, confidence: 'low' },
    interest_paid_12m: { value: 12000, confidence: 'low' },
  };
}

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const url = new URL(req.url);
  const name = (url.searchParams.get('scenario') || 'A').toUpperCase();
  const validate = url.searchParams.get('validate');

  const make = (n: 'A'|'B'|'C') => {
    const s = n === 'B' ? scenarioB() : n === 'C' ? scenarioC() : scenarioA();
    const { kpis, gates, normalized } = computeKpisV2(s);
    const levels = assignLevelsV2(kpis, gates);
    const assertions = buildAssertions(kpis as any, gates as any);
    return { scenario: n, normalized, kpis, gates, levels, assertions };
  };

  if (validate) {
    if (name === 'ALL') {
      return NextResponse.json({ results: [make('A'), make('B'), make('C')] });
    }
    return NextResponse.json(make(name as any));
  }

  const slots = name === 'B' ? scenarioB() : name === 'C' ? scenarioC() : scenarioA();
  const { kpis, gates, normalized } = computeKpisV2(slots);
  const levels = assignLevelsV2(kpis, gates);
  return NextResponse.json({ scenario: name, normalized, kpis, gates, levels });
}

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const body = await req.json();
    const slots = (body?.slots || {}) as Slots;
    const { kpis, gates, normalized } = computeKpisV2(slots);
    const levels = assignLevelsV2(kpis, gates);
    const assertions = buildAssertions(kpis as any, gates as any);
    return NextResponse.json({ normalized, kpis, gates, levels, assertions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'bad_request' }, { status: 400 });
  }
}

// ----------- Assertions builder (no external deps) -----------
function thr(label: string, val: number | null | undefined, cmp: (x: number) => boolean, required: string) {
  const pass = (val == null) ? false : !!cmp(val);
  return { label, pass, value: val, required };
}

function boolGate(label: string, v: boolean | null | undefined, required = 'true') {
  const pass = v === true;
  return { label, pass, value: v, required };
}

function buildAssertions(k: KpisV2, g: GatesV2) {
  const arr: any[] = [];
  // L5 buffer checks
  arr.push(thr('L5.EF ≥ 3 mo', k.ef_months, x => x >= 3, '≥ 3.0'));
  arr.push(thr('L5.HR ≤ 0.40', k.hr, x => x <= 0.40, '≤ 0.40'));
  arr.push(thr('L5.NMDSR ≤ 10%', k.nmdsr, x => x <= 0.10, '≤ 0.10'));
  arr.push(thr('L5.LANW ≥ 15%', k.lanw, x => x >= 0.15, '≥ 0.15'));
  arr.push(boolGate('L5.Home insured ok (if homeowner)', g.home_insured_ok));

  // L6 builder checks
  arr.push(thr('L6.EF ≥ 4 mo', k.ef_months, x => x >= 4, '≥ 4.0'));
  arr.push(thr('L6.DSR ≤ 20%', k.dsr_total, x => x <= 0.20, '≤ 0.20'));
  arr.push(thr('L6.D/A ≤ 0.60', k.d_to_a, x => x <= 0.60, '≤ 0.60'));
  arr.push(thr('L6.Pension ≥ 10%', k.pension_contrib_pct, x => x >= 0.10, '≥ 0.10'));
  arr.push(boolGate('L6.Income protection ok', g.income_protection_ok));

  // L7 resilient checks
  arr.push(thr('L7.SR ≥ 20%', k.sr, x => x >= 0.20, '≥ 0.20'));
  arr.push(thr('L7.EF ≥ 6 mo', k.ef_months, x => x >= 6, '≥ 6.0'));
  arr.push(thr('L7.HR ≤ 0.35', k.hr, x => x <= 0.35, '≤ 0.35'));
  arr.push(thr('L7.DTI ≤ 0.35', k.dti_stock, x => x <= 0.35, '≤ 0.35'));
  arr.push(thr('L7.LANW ≥ 25%', k.lanw, x => x >= 0.25, '≥ 0.25'));
  arr.push(thr('L7.INVNW ≥ 40%', k.invnw, x => x >= 0.40, '≥ 0.40'));
  arr.push(thr('L7.Credit ≥ 0.60', k.credit_norm, x => x >= 0.60, '≥ 0.60'));
  arr.push(boolGate('L7.Life cover ok (if dependants)', g.life_cover_ok));

  // L8 secure checks
  arr.push(thr('L8.RRR ≥ 0.60', k.rrr, x => x >= 0.60, '≥ 0.60'));
  arr.push(thr('L8.DSR ≤ 10%', k.dsr_total, x => x <= 0.10, '≤ 0.10'));
  arr.push(thr('L8.D/A ≤ 0.40', k.d_to_a, x => x <= 0.40, '≤ 0.40'));
  arr.push(thr('L8.INVNW ≥ 50%', k.invnw, x => x >= 0.50, '≥ 0.50'));
  arr.push(thr('L8.NWM ≥ 5×', k.nwm, x => x >= 5, '≥ 5.0'));
  arr.push(thr('L8.Pension ≥ 15%', k.pension_contrib_pct, x => x >= 0.15, '≥ 0.15'));
  arr.push(thr('L8.RoNW ≥ +2%', k.ronw, x => x >= 0.02, '≥ 0.02'));

  // L9/L10 checks
  arr.push(thr('L9.RRR ≥ 1.00', k.rrr, x => x >= 1.00, '≥ 1.00'));
  arr.push(thr('L9.NWM ≥ 25×', k.nwm, x => x >= 25, '≥ 25'));
  arr.push(thr('L10.RRR ≥ 1.20', k.rrr, x => x >= 1.20, '≥ 1.20'));
  arr.push(thr('L10.NWM ≥ 40×', k.nwm, x => x >= 40, '≥ 40'));

  return arr;
}
