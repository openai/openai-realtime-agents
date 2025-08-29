import type { KpisV2, GatesV2 } from './kpiEngine';

type Rec = { title: string; why?: string; how?: string[]; pillar?: string; score?: number };

export function generateTwoBestActions(k: KpisV2, g: GatesV2): Array<{ title: string; why?: string; how?: string[]; pillar?: string }> {
  const actions: Rec[] = [];

  // Prioritize gates first
  if (g.life_cover_ok === false) {
    actions.push({
      pillar: 'protect',
      title: 'Lift life insurance to ≥ 5 years of needs',
      why: 'Dependants rely on your income; coverage is below 5 years.',
      how: ['Get a quick quote for term life', 'Set sum assured to ≥ 5× annual dependant needs'],
      score: 1.0,
    });
  }
  if (g.income_protection_ok === false) {
    actions.push({
      pillar: 'protect',
      title: 'Reach 6 months income continuity',
      why: 'Sick pay + income protection is under 6 months.',
      how: ['Check work sick pay policy', 'Price income protection to cover essentials for 6 months'],
      score: 0.9,
    });
  }

  // Then core ratios with biggest impact
  if ((k.ef_months ?? 0) < 3) {
    actions.push({
      pillar: 'save',
      title: 'Build emergency fund to 3 months',
      why: `Current buffer ≈ ${(k.ef_months ?? 0).toFixed(1)} months`,
      how: ['Open a high-yield savings bucket', 'Automate weekly transfer 5–10% of pay'],
      score: Math.min(1, (3 - (k.ef_months ?? 0)) / 3),
    });
  }

  if ((k.nmdsr ?? 1) > 0.1) {
    actions.push({
      pillar: 'borrow',
      title: 'Reduce non-mortgage debt servicing ≤ 10%',
      why: `NMDSR ≈ ${Math.round((k.nmdsr ?? 0)*100)}%`,
      how: ['Consolidate high-APR balances', 'Automate overpayments on smallest balance'],
      score: Math.min(1, ((k.nmdsr ?? 0) - 0.10) / 0.20),
    });
  }

  if ((k.sr ?? 0) < 0.2) {
    actions.push({
      pillar: 'spend',
      title: 'Lift savings rate toward 20%',
      why: `Savings rate ≈ ${Math.round((k.sr ?? 0)*100)}%`,
      how: ['Skim 1–2% from top categories', 'Increase auto-investing by a set amount'],
      score: Math.min(1, (0.20 - (k.sr ?? 0)) / 0.20),
    });
  }

  // Housing Ratio (target ≤ 0.40)
  if ((k.hr ?? 0) > 0.40) {
    actions.push({
      pillar: 'spend',
      title: 'Reduce housing burden toward ≤ 40% of gross',
      why: `Housing ratio ≈ ${Math.round(((k.hr ?? 0) * 100))}%`,
      how: ['Negotiate rent/review utilities', 'Refinance or extend term if feasible', 'Aim to trim 5–10% in near term'],
      score: Math.min(1, ((k.hr ?? 0) - 0.40) / 0.20),
    });
  }

  // DSR total (target ≤ 20%)
  if ((k.dsr_total ?? 0) > 0.20) {
    actions.push({
      pillar: 'borrow',
      title: 'Lower total debt servicing toward ≤ 20% of income',
      why: `DSR ≈ ${Math.round(((k.dsr_total ?? 0) * 100))}%`,
      how: ['Refinance to lower APR', 'Pause non-essential spend to reduce balances', 'Redirect freed-up cash to highest APR'],
      score: Math.min(1, ((k.dsr_total ?? 0) - 0.20) / 0.30),
    });
  }

  // D/A (target ≤ 0.60)
  if ((k.d_to_a ?? 0) > 0.60) {
    actions.push({
      pillar: 'borrow',
      title: 'Improve debt-to-asset ratio ≤ 0.60',
      why: `Debt-to-asset ≈ ${((k.d_to_a ?? 0)).toFixed(2)}`,
      how: ['Prioritize debt reduction over new borrowing', 'Avoid new large liabilities until ratio improves'],
      score: Math.min(1, ((k.d_to_a ?? 0) - 0.60) / 0.40),
    });
  }

  // LANW (target ≥ 15%)
  if ((k.lanw ?? 1) < 0.15) {
    actions.push({
      pillar: 'save',
      title: 'Lift liquid assets toward ≥ 15% of net worth',
      why: `LANW ≈ ${Math.round(((k.lanw ?? 0) * 100))}%`,
      how: ['Hold part of new savings in cash/offset', 'Build buffer before investing further'],
      score: Math.min(1, (0.15 - (k.lanw ?? 0)) / 0.15),
    });
  }

  // INVNW (target ≥ 40%)
  if ((k.invnw ?? 1) < 0.40) {
    actions.push({
      pillar: 'grow',
      title: 'Increase investable share toward ≥ 40% of net worth',
      why: `INVNW ≈ ${Math.round(((k.invnw ?? 0) * 100))}%`,
      how: ['Automate monthly investing', 'Rebalance annually to target mix'],
      score: Math.min(1, (0.40 - (k.invnw ?? 0)) / 0.40),
    });
  }

  // Pension contribution % (target ≥ 10%)
  if ((k.pension_contrib_pct ?? 0) < 0.10) {
    actions.push({
      pillar: 'grow',
      title: 'Raise pension contributions to ≥ 10% of gross',
      why: `Current pension contrib ≈ ${Math.round(((k.pension_contrib_pct ?? 0) * 100))}%`,
      how: ['Increase salary sacrifice by 1–2%', 'Capture full employer match first'],
      score: Math.min(1, (0.10 - (k.pension_contrib_pct ?? 0)) / 0.10),
    });
  }

  // Retirement readiness RRR (target ≥ 0.60 for secure path)
  if ((k.rrr ?? 1) < 0.60 && (k.rrr ?? -1) >= 0) {
    actions.push({
      pillar: 'grow',
      title: 'Improve retirement readiness toward 60%+',
      why: `RRR ≈ ${((k.rrr ?? 0)).toFixed(2)}`,
      how: ['Increase contribution rate by 1–2%', 'Review target retirement age or income'],
      score: Math.min(1, (0.60 - (k.rrr ?? 0)) / 0.60),
    });
  }

  // Rank by score (higher = more urgent), with gates given high base scores above
  const ranked = actions
    .map(a => ({ ...a, score: a.score ?? 0.5 }))
    .sort((a, b) => (b.score! - a.score!));

  return ranked.slice(0, 2).map(({ score, ...rest }) => rest);
}
