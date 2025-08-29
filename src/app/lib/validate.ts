import type { Slots } from './schema/slots';

const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string }> = {
  'GB': { code: 'GBP', symbol: '£' },
  'UK': { code: 'GBP', symbol: '£' },
  'US': { code: 'USD', symbol: '$' },
  'AU': { code: 'AUD', symbol: '$' },
  'NZ': { code: 'NZD', symbol: '$' },
  'CA': { code: 'CAD', symbol: '$' },
  'EU': { code: 'EUR', symbol: '€' },
};

export function normaliseCurrency(countryIso?: string | null): { code: string; symbol: string } {
  if (!countryIso) return { code: 'USD', symbol: '$' };
  const key = String(countryIso).toUpperCase();
  return COUNTRY_CURRENCY[key] || { code: 'USD', symbol: '$' };
}

/**
 * Very lightweight conflict checks; return a list of warnings for gentle confirmation.
 */
export function conflictCheck(slots: Slots): string[] {
  const warn: string[] = [];
  const rent = slots.rent_monthly?.value ?? null;
  const mort = slots.mortgage_payment_monthly?.value ?? null;
  const housing = rent ?? mort ?? null;
  const totalExp = slots.total_expenses_monthly?.value ?? null;
  const essentials = slots.essential_expenses_monthly?.value ?? null;

  if (housing != null && totalExp != null && housing > totalExp) {
    warn.push('Your rent/mortgage looks higher than your total expenses. Recheck?');
  }
  if (essentials != null && totalExp != null && essentials > totalExp) {
    warn.push('Essential expenses are higher than total expenses. Recheck?');
  }
  const negatives = [rent, mort, totalExp, essentials].some((v) => typeof v === 'number' && v < 0);
  if (negatives) warn.push('Some amounts look negative; should these be positive?');
  return warn;
}

