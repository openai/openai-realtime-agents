export type Confidence = 'low' | 'med' | 'high';

export type Slot<T> = { value: T | null; confidence?: Confidence };

export type DebtItem = {
  type?: string | null;
  balance?: number | null;
  rate_pct?: number | null;
  payment_monthly?: number | null;
  term_months?: number | null;
  fixed_variable?: string | null;
  balloon?: number | null;
};

export type InvestmentProperty = {
  value?: number | null;
  mortgage_balance?: number | null;
  net_rent_monthly?: number | null;
  payment_monthly?: number | null; // new
};

export type Slots = {
  // Demographics
  full_name?: Slot<string>;
  email?: Slot<string>;
  country?: Slot<string>; // ISO 3166
  postcode?: Slot<string>;
  birth_year?: Slot<number>; // YYYY
  partner?: Slot<boolean>;
  dependants_count?: Slot<number>;
  tax_residency?: Slot<string>;
  employment_status?: Slot<'employed'|'self_employed'|'contractor'|'unemployed'|'retired'|'other'>;

  // Income & expenses
  net_income_monthly_self?: Slot<number>;
  net_income_monthly_partner?: Slot<number>;
  gross_income_annual_self?: Slot<number>;
  gross_income_annual_partner?: Slot<number>;
  variable_income_annual?: Slot<number>;
  total_expenses_monthly?: Slot<number>;
  essential_expenses_monthly?: Slot<number>;
  employer_pension_pct_self?: Slot<number>; // 0..1
  employer_pension_pct_partner?: Slot<number>; // 0..1
  sick_pay_months_full?: Slot<number>;
  sick_pay_months_half?: Slot<number>;

  // Housing
  housing_status?: Slot<'own'|'rent'|'other'>;
  rent_monthly?: Slot<number>;
  home_value?: Slot<number>;
  mortgage_payment_monthly?: Slot<number>;
  mortgage_balance?: Slot<number>;
  mortgage_rate_pct?: Slot<number>;
  mortgage_fixed?: Slot<boolean>;
  rate_reset_months?: Slot<number>;
  mortgage_term_years?: Slot<number>;
  housing_running_costs_monthly?: Slot<number>;

  // Debts
  other_debt_payments_monthly_total?: Slot<number>;
  other_debt_balances_total?: Slot<number>;
  short_term_liabilities_12m?: Slot<number>;
  debts?: Slot<DebtItem[]>;

  // Assets
  cash_liquid_total?: Slot<number>;
  term_deposits_le_3m?: Slot<number>;
  investments_ex_home_total?: Slot<number>;
  pension_balance_total?: Slot<number>;
  investment_properties?: Slot<InvestmentProperty[]>;

  // Protection
  life_insurance_has?: Slot<boolean>;
  life_insurance_sum?: Slot<number>;
  income_protection_has?: Slot<boolean>;
  ip_monthly_benefit?: Slot<number>;
  ip_waiting_period_days?: Slot<number>;
  ip_benefit_period_years?: Slot<number>;
  homeowner?: Slot<boolean>;
  home_insured_ok?: Slot<boolean>;
  home_insured_sum?: Slot<number>;
  rebuild_cost_estimate?: Slot<number>;

  // Retirement & goals
  retire_age?: Slot<number>;
  retire_target_income_annual?: Slot<number>;
  state_pension_est_annual?: Slot<number>;
  pension_contrib_pct?: Slot<number>; // 0..1

  // Credit & advanced (optional)
  credit_score_normalised_0_1?: Slot<number>; // 0..1
  credit_provider?: Slot<string>;
  credit_raw_score?: Slot<number>;
  credit_min?: Slot<number>;
  credit_max?: Slot<number>;
  investment_returns_12m?: Slot<number>;
  interest_paid_12m?: Slot<number>;
};
