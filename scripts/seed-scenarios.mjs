#!/usr/bin/env node
/**
 * Seed a few household scenarios via the public API for repeatable manual testing.
 *
 * Usage:
 *  BASE_URL=http://localhost:3000 node scripts/seed-scenarios.mjs
 *
 * Notes:
 * - Ensure `npm run dev` is running (the API routes must be available).
 * - Requires Supabase to be configured in .env for snapshot persistence.
 */

import { randomUUID } from 'node:crypto';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const scenarios = [
  {
    id: 'HH-UK-RENT-30K',
    label: 'UK renter, lower income',
    inputs: [
      ['country', 'UK', 'text'],
      ['housing_status', 'rent', 'text'],
      ['net_income_monthly_self', 1800, 'money'],
      ['essential_expenses_monthly', 1200, 'money'],
      ['rent_monthly', 900, 'money'],
      ['other_debt_payments_monthly_total', 120, 'money'],
      ['cash_liquid_total', 800, 'money'],
      ['dependants_count', 0, 'number'],
      ['employment_status', 'employed', 'text'],
    ],
  },
  {
    id: 'HH-AU-OWN-100K',
    label: 'AU homeowner, mid income',
    inputs: [
      ['country', 'AU', 'text'],
      ['housing_status', 'own', 'text'],
      ['gross_income_annual_self', 100000, 'money'],
      ['essential_expenses_monthly', 2400, 'money'],
      ['mortgage_payment_monthly', 1800, 'money'],
      ['other_debt_payments_monthly_total', 200, 'money'],
      ['cash_liquid_total', 6000, 'money'],
      ['investments_ex_home_total', 30000, 'money'],
      ['pension_balance_total', 40000, 'money'],
      ['pension_contrib_pct', 0.1, 'percent'],
      ['dependants_count', 1, 'number'],
      ['employment_status', 'employed', 'text'],
    ],
  },
  {
    id: 'HH-UK-OWN-150K',
    label: 'UK homeowner, higher income',
    inputs: [
      ['country', 'UK', 'text'],
      ['housing_status', 'own', 'text'],
      ['gross_income_annual_self', 150000, 'money'],
      ['essential_expenses_monthly', 3500, 'money'],
      ['mortgage_payment_monthly', 2200, 'money'],
      ['other_debt_payments_monthly_total', 100, 'money'],
      ['cash_liquid_total', 15000, 'money'],
      ['investments_ex_home_total', 120000, 'money'],
      ['pension_balance_total', 200000, 'money'],
      ['pension_contrib_pct', 0.12, 'percent'],
      ['dependants_count', 2, 'number'],
      ['employment_status', 'employed', 'text'],
    ],
  },
];

async function postUpdate(householdId, key, value, kind) {
  const res = await fetch(`${BASE_URL}/api/prosper/update-input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ householdId, key, value, kind }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Update failed for ${householdId}:${key} — ${res.status} ${txt}`);
  }
  return res.json();
}

async function seedScenario(s) {
  const householdId = randomUUID();
  console.log(`\nSeeding: ${s.label} (${householdId})`);
  for (const [key, value, kind] of s.inputs) {
    process.stdout.write(`  • ${key} = ${value} (${kind}) … `);
    await postUpdate(householdId, key, value, kind);
    process.stdout.write('ok\n');
  }
  return householdId;
}

(async () => {
  try {
    const ids = [];
    for (const s of scenarios) {
      const id = await seedScenario(s);
      ids.push({ label: s.label, id });
    }
    console.log('\nDone. You can now open:');
    ids.forEach(({ label, id }) => console.log(`  - ${label}: ${BASE_URL}/?householdId=${encodeURIComponent(id)}`));
  } catch (err) {
    console.error('Seed failed:', err?.message || err);
    process.exit(1);
  }
})();
