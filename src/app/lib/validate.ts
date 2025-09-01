import type { Slots } from './schema/slots';

const CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  'USD': { code: 'USD', symbol: '$' },
  'AUD': { code: 'AUD', symbol: '$' },
  'NZD': { code: 'NZD', symbol: '$' },
  'CAD': { code: 'CAD', symbol: '$' },
  'GBP': { code: 'GBP', symbol: '£' },
  'EUR': { code: 'EUR', symbol: '€' },
};

const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string }> = {
  'GB': CURRENCY_MAP.GBP,
  'UK': CURRENCY_MAP.GBP,
  'IE': CURRENCY_MAP.EUR,
  'US': CURRENCY_MAP.USD,
  'USA': CURRENCY_MAP.USD,
  'AU': CURRENCY_MAP.AUD,
  'AUS': CURRENCY_MAP.AUD,
  'NZ': CURRENCY_MAP.NZD,
  'CA': CURRENCY_MAP.CAD,
  'EU': CURRENCY_MAP.EUR,
};

const NAME_TO_COUNTRY: Record<string, string> = {
  // Countries
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'ENGLAND': 'GB',
  'SCOTLAND': 'GB',
  'WALES': 'GB',
  'NORTHERN IRELAND': 'GB',
  'IRELAND': 'IE',
  'UNITED STATES': 'US',
  'USA': 'US',
  'AMERICA': 'US',
  'AUSTRALIA': 'AU',
  'NEW ZEALAND': 'NZ',
  'CANADA': 'CA',
  'EUROPE': 'EU',
  'EUROPEAN UNION': 'EU',
  // Common cities (minimal set for UX)
  'MELBOURNE': 'AU',
  'SYDNEY': 'AU',
  'BRISBANE': 'AU',
  'PERTH': 'AU',
  'ADELAIDE': 'AU',
  'CANBERRA': 'AU',
};

export function normaliseCurrency(input?: string | null): { code: string; symbol: string } {
  // Default to USD if we truly cannot infer anything
  const DEFAULT = CURRENCY_MAP.USD;
  if (input == null) return DEFAULT;
  const raw = String(input).trim();
  if (!raw) return DEFAULT;
  const up = raw.toUpperCase();

  // If a 3-letter currency code is provided, prefer it directly when supported
  if (/^[A-Z]{3}$/.test(up) && CURRENCY_MAP[up]) return CURRENCY_MAP[up];

  // If a 2–3 letter country/region code
  if (/^[A-Z]{2,3}$/.test(up) && COUNTRY_CURRENCY[up]) return COUNTRY_CURRENCY[up];

  // Try to extract region from locale-like strings: en-AU, en_AU, etc.
  const localeRegion = up.match(/[-_](\w{2,3})$/)?.[1];
  if (localeRegion && COUNTRY_CURRENCY[localeRegion]) return COUNTRY_CURRENCY[localeRegion];

  // Map common country/region names (and a few cities) to country codes
  const cleaned = up.replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (NAME_TO_COUNTRY[cleaned]) return COUNTRY_CURRENCY[NAME_TO_COUNTRY[cleaned]] || DEFAULT;

  // If the string contains a known name token, try partial matching
  for (const [name, cc] of Object.entries(NAME_TO_COUNTRY)) {
    if (cleaned.includes(name)) return COUNTRY_CURRENCY[cc] || DEFAULT;
  }

  return DEFAULT;
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
