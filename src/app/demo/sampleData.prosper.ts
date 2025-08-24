// ==============================================
// FILE: sampleData.prosper.ts (Demo)
// ==============================================

export const exampleHouseholdProfile = {
  householdId: "PP-HH-0001",
  primaryContact: { name: "Maya Cooper", phone: "+61-400-123-456", email: "maya.cooper@example.com" },
  secondaryContact: { name: "Daniel Cooper", phone: "+61-400-654-321", email: "daniel.cooper@example.com" },
  locale: { country: "AU", currency: "AUD", city: "Melbourne", state: "VIC", postcode: "3000" },
  inputs: {
    partner1_age: 33,
    partner2_age: 35,
    retirement_age: 65,
    income_gross_monthly: 14500,
    income_net_monthly: 10500,
    essentials_monthly: 5200,
    housing_total_monthly: 3200,
    debt_required_payments_monthly: 1100,
    emergency_savings_liquid: 18000,
    investment_split_pct: { cash: 0.1, bonds: 0.2, equities: 0.6, other: 0.1 },
    investment_balances_total: 85000,
    investment_contrib_monthly: 1800,
    retirement_spend_annual_desired: 80000,
    assets_total: 620000,
    debts_total: 480000,
  },
  protection: {
    life_cover_amount: 1500000,
    income_protection: true,
    wills_or_guardianship: false,
  },
  address: { street: "100 Collins St", city: "Melbourne", state: "VIC", postcode: "3000" },
  metadata: { lastUpdated: "2025-08-10", notes: "Demo household with partial Protect pillar to showcase level gating." },
};

export const exampleCoachingDocs = [
  { id: "PPD-100", name: "Emergency Fund Guidelines", topic: "emergency fund", content: "Aim for 3–6 months of essential expenses in liquid cash. Households with variable income or dependants may target 6–12 months. Build it first; invest excess thereafter." },
  { id: "PPD-110", name: "Savings Rate Benchmarks", topic: "savings rate", content: "Green ≥20% of net income; Amber 10–20%; Red <10%. Use automation on payday to lift the rate with minimal friction." },
  { id: "PPD-120", name: "Debt-to-Income (DTI) Guide", topic: "dti", content: "DTI ≤36% is generally considered healthy; 36–43% moderate; >43% elevated risk. Focus on reducing high-APR balances first." },
  { id: "PPD-130", name: "Housing Cost Ratio Guide", topic: "housing ratio", content: "Target 25–30% of gross income for housing. Above 35% can crowd out saving and raise vulnerability to rate rises." },
  { id: "PPD-140", name: "Protection Checklist", topic: "protection", content: "Life cover ≈ 10–12× annual income, income protection for primary earners, and wills/guardianship for dependants. Review annually or at life events." },
  { id: "PPD-150", name: "Fee Hygiene & Diversification", topic: "investing fees & diversification", content: "Keep blended fund fees near or below 0.25% p.a. Use broad diversification across cash/bonds/equities/other; rebalance annually or at ±5% bands." },
  { id: "PPD-160", name: "Parental Leave Buffer", topic: "parental leave", content: "Increase cash buffer by 3–6 months ahead of leave; pre-plan reduced contributions and resume gradually post-return." },
];

export const examplePartnerLocations = [
  { name: "Prosper Partner – Insurance Broker (Melbourne CBD)", address: "120 Queen St, Melbourne, VIC", postcode: "3000", phone: "(03) 5550 1100", hours: "Mon–Fri 9:00–17:30", services: ["Income Protection", "Life Cover Quotes"] },
  { name: "Prosper Partner – Estate Planning (Southbank)", address: "60 City Rd, Southbank, VIC", postcode: "3006", phone: "(03) 5550 2200", hours: "Mon–Fri 9:00–17:00, Sat by appt", services: ["Wills", "Guardianship"] },
  { name: "Prosper Partner – Mortgage Broker (Richmond)", address: "285 Swan St, Richmond, VIC", postcode: "3121", phone: "(03) 5550 3300", hours: "Mon–Sat 9:00–18:00", services: ["Refinance", "First Home"] },
  { name: "Prosper Partner – Financial Counselling (Fitzroy)", address: "220 Brunswick St, Fitzroy, VIC", postcode: "3065", phone: "(03) 5550 4400", hours: "Mon–Fri 10:00–16:00", services: ["Budget Support", "Debt Triage"] },
];

// backward-compat aliases
export const exampleAccountInfo = exampleHouseholdProfile as any;
export const examplePolicyDocs = exampleCoachingDocs as any;
export const exampleStoreLocations = examplePartnerLocations as any;
