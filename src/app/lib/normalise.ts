import type { Slots, InvestmentProperty } from './schema/slots';

export type Normalized = {
  // basic derived
  net_income_total_monthly: number | null;
  gross_income_annual_total: number | null;
  total_expenses_monthly: number | null;
  essential_expenses_monthly: number | null;

  // assets/liabilities
  liquid_assets: number | null;
  investable_assets: number | null; // investments + pensions
  home_value: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  net_worth: number | null;

  // housing & property flows
  rent_monthly: number | null;
  mortgage_payment_monthly: number | null;
  housing_running_costs_monthly: number | null;
  net_rent_total: number; // sum properties net rent
  inv_prop_payments_total: number; // sum property payments

  // debt aggregates
  total_debt_balance: number | null; // mortgage + other + properties
};

function n(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function sumSafe(arr: Array<number | null | undefined>): number {
  return arr.reduce((a: number, b) => a + ((b ?? 0) as number), 0);
}

export function normaliseSlots(slots: Slots): Normalized {
  const netIncome = sumSafe([
    n(slots.net_income_monthly_self?.value),
    n(slots.net_income_monthly_partner?.value),
  ]);
  const grossAnnual = sumSafe([
    n(slots.gross_income_annual_self?.value),
    n(slots.gross_income_annual_partner?.value),
  ]);
  const totalExp = n(slots.total_expenses_monthly?.value);
  const essentialExp = n(slots.essential_expenses_monthly?.value);

  const cash = n(slots.cash_liquid_total?.value);
  const emergency = n((slots as any)?.emergency_savings_liquid?.value);
  const termDep = n((slots as any)["term_deposits_le_3m"]?.value);
  // Treat emergency_savings_liquid as liquid as well (avoid double-count if both provided by summing but they are distinct fields)
  const liquid_assets = sumSafe([cash, emergency, termDep]);

  // Investable assets: prefer explicit split; also accept generic investment_balances_total as a fallback
  const investables = sumSafe([
    n(slots.investments_ex_home_total?.value),
    n(slots.pension_balance_total?.value),
    n((slots as any)?.investment_balances_total?.value),
  ]);

  const rentMonthly = n(slots.rent_monthly?.value);
  const mortPay = n(slots.mortgage_payment_monthly?.value);
  const runningCosts = n(slots.housing_running_costs_monthly?.value);
  const housingTotalMonthly = n((slots as any)?.housing_total_monthly?.value);

  const props = slots.investment_properties?.value || [];
  const net_rent_total = (props as InvestmentProperty[]).reduce((acc, p) => acc + (p.net_rent_monthly || 0), 0);
  const inv_prop_payments_total = (props as InvestmentProperty[]).reduce((acc, p) => acc + (p.payment_monthly || 0), 0);

  const home_value = n(slots.home_value?.value);
  const propValues = (props as InvestmentProperty[]).reduce((acc, p) => acc + (p.value || 0), 0);
  const otherInvestables = investables + (liquid_assets || 0);
  let total_assets = (home_value || 0) + propValues + otherInvestables;

  const mortgageBalance = n(slots.mortgage_balance?.value) || 0;
  const otherDebtBalances = n(slots.other_debt_balances_total?.value) || 0;
  const propDebt = (props as InvestmentProperty[]).reduce((acc, p) => acc + (p.mortgage_balance || 0), 0);
  let total_liabilities = mortgageBalance + otherDebtBalances + propDebt;
  const total_debt_balance = total_liabilities;
  let net_worth = total_assets - total_liabilities;

  // Allow overrides if user supplied holistic totals
  const assetsTotalOverride = n((slots as any)?.assets_total?.value);
  const debtsTotalOverride = n((slots as any)?.debts_total?.value);
  if (Number.isFinite(assetsTotalOverride as number)) total_assets = assetsTotalOverride as number;
  if (Number.isFinite(debtsTotalOverride as number)) {
    total_liabilities = debtsTotalOverride as number;
  }
  net_worth = total_assets - total_liabilities;

  // Derive total expenses if not explicitly provided
  const housingExpense = Number.isFinite(housingTotalMonthly as number)
    ? (housingTotalMonthly as number)
    : sumSafe([rentMonthly, mortPay, runningCosts]);
  const debtPmts = n((slots as any)?.other_debt_payments_monthly_total?.value) || 0;
  const derivedTotalExp = sumSafe([essentialExp, housingExpense, debtPmts]);

  return {
    net_income_total_monthly: netIncome || null,
    gross_income_annual_total: grossAnnual || null,
    total_expenses_monthly: totalExp != null ? totalExp : (derivedTotalExp > 0 ? derivedTotalExp : null),
    essential_expenses_monthly: essentialExp || null,

    liquid_assets: Number.isFinite(liquid_assets) ? liquid_assets : null,
    investable_assets: Number.isFinite(investables) ? investables : null,
    home_value: home_value || null,
    total_assets: Number.isFinite(total_assets) ? total_assets : null,
    total_liabilities: Number.isFinite(total_liabilities) ? total_liabilities : null,
    net_worth: Number.isFinite(net_worth) ? net_worth : null,

    rent_monthly: rentMonthly || null,
    mortgage_payment_monthly: mortPay || null,
    housing_running_costs_monthly: runningCosts || null,
    net_rent_total,
    inv_prop_payments_total,

    total_debt_balance: Number.isFinite(total_debt_balance) ? total_debt_balance : null,
  };
}
