import type { KpisV2, GatesV2 } from './kpiEngine';

export type LevelsV2 = {
  overall: { level: `L${1|2|3|4|5|6|7|8|9|10}`; points_to_next?: string };
  reasons?: string[];
  gates?: GatesV2;
};

function achieved(thresh: number | null | undefined, cmp: (x: number) => boolean): boolean | null {
  if (thresh == null || !Number.isFinite(thresh)) return null;
  return cmp(thresh);
}

export function assignLevelsV2(k: KpisV2, g: GatesV2): LevelsV2 {
  const reasons: string[] = [];

  // Base heuristic: start at 1, raise as thresholds are met
  let lvl = 1;

  // Levels 2–4 driven by SR, EF, HR basics
  if (achieved(k.sr, (x) => x >= 0.01)) lvl = Math.max(lvl, 2);
  if (achieved(k.sr, (x) => x >= 0.05)) lvl = Math.max(lvl, 3);
  if (achieved(k.sr, (x) => x >= 0.10)) lvl = Math.max(lvl, 4);

  // L5 buffer: EF≥3 mo, HR≤0.40, NMDSR≤10%, LANW≥15%, home insurance (if homeowner)
  if (
    achieved(k.ef_months, (x) => x >= 3) &&
    achieved(k.hr, (x) => x <= 0.40) &&
    achieved(k.nmdsr, (x) => x <= 0.10) &&
    achieved(k.lanw, (x) => x >= 0.15) &&
    (g.home_insured_ok == null || g.home_insured_ok === true)
  ) {
    lvl = Math.max(lvl, 5);
  }

  // L6 builder: EF 4–6, DSR≤20%, D/A≤0.60, pension≥10%, IP pass
  if (
    achieved(k.ef_months, (x) => x >= 4) &&
    achieved(k.dsr_total, (x) => x <= 0.20) &&
    achieved(k.d_to_a, (x) => x <= 0.60) &&
    achieved(k.pension_contrib_pct, (x) => x >= 0.10) &&
    (g.income_protection_ok == null || g.income_protection_ok === true)
  ) {
    lvl = Math.max(lvl, 6);
  }

  // L7 resilient: SR≥20%, EF≥6, HR≤0.35, DTI≤0.35, LANW≥25%, INVNW≥40%, credit≥0.60, life cover≥5y
  if (
    achieved(k.sr, (x) => x >= 0.20) &&
    achieved(k.ef_months, (x) => x >= 6) &&
    achieved(k.hr, (x) => x <= 0.35) &&
    achieved(k.dti_stock, (x) => x <= 0.35) &&
    achieved(k.lanw, (x) => x >= 0.25) &&
    achieved(k.invnw, (x) => x >= 0.40) &&
    achieved(k.credit_norm, (x) => x >= 0.60) &&
    (g.life_cover_ok == null || g.life_cover_ok === true)
  ) {
    lvl = Math.max(lvl, 7);
  }

  // L8 secure: RRR≥0.60, DSR≤10%, D/A≤0.40, INVNW≥50%, NWM≥5×, pension≥15%, RoNW≥+2%
  if (
    achieved(k.rrr, (x) => x >= 0.60) &&
    achieved(k.dsr_total, (x) => x <= 0.10) &&
    achieved(k.d_to_a, (x) => x <= 0.40) &&
    achieved(k.invnw, (x) => x >= 0.50) &&
    achieved(k.nwm, (x) => x >= 5) &&
    achieved(k.pension_contrib_pct, (x) => x >= 0.15) &&
    achieved(k.ronw, (x) => x >= 0.02)
  ) {
    lvl = Math.max(lvl, 8);
  }

  // L9 work-optional: RRR≥1.00 and NWM≥25×
  if (
    achieved(k.rrr, (x) => x >= 1.0) &&
    achieved(k.nwm, (x) => x >= 25)
  ) {
    lvl = Math.max(lvl, 9);
  }

  // L10 abundant: RRR≥1.20 and NWM≥40×
  if (
    achieved(k.rrr, (x) => x >= 1.2) &&
    achieved(k.nwm, (x) => x >= 40)
  ) {
    lvl = Math.max(lvl, 10);
  }

  // Enforce gates (caps) retroactively
  if ((g.life_cover_ok === false && lvl > 7)) {
    reasons.push('Life insurance coverage below 5 years for dependants');
    lvl = 7;
  }
  if ((g.income_protection_ok === false && lvl > 6)) {
    reasons.push('Income protection + sick pay < 6 months');
    lvl = 6;
  }
  if ((g.home_insured_ok === false && lvl > 5)) {
    reasons.push('Home insurance adequacy not confirmed');
    lvl = 5;
  }

  // Points to next (simple hint)
  const next = Math.min(10, lvl + 1) as 1|2|3|4|5|6|7|8|9|10;
  const points_to_next = `Focus next on the tightest metric to reach L${next}.`;

  return {
    overall: { level: (`L${lvl}` as any), points_to_next },
    reasons: reasons.length ? reasons : undefined,
    gates: g,
  };
}

