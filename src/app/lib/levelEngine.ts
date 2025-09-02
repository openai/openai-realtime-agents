import type { KpisV2, GatesV2 } from './kpiEngine';

export type LevelsV2 = {
  overall: { level: `L${1|2|3|4|5|6|7|8|9|10}`; points_to_next?: string };
  reasons?: string[];
  gates?: GatesV2;
};

export function assignLevelsV2(k: KpisV2, g: GatesV2): LevelsV2 {
  const reasons: string[] = [];

  // Helper
  const val = (x: number | null | undefined) => (Number.isFinite(x as number) ? (x as number) : null);
  const sr = val(k.sr);
  const ef = val(k.ef_months);
  const hr = val(k.hr);
  const dti = val(k.dti_stock);
  const nmdsr = val(k.nmdsr);
  const d_to_a = val(k.d_to_a);
  const nwm = val(k.nwm);
  const rrr = val(k.rrr);

  // Start with L1 by default
  let lvl = 1;

  // L1 Triage: SR ≤ 0 or EF < 0.5 or DTI ≥ 0.60
  const triage = (sr != null && sr <= 0) || (ef != null && ef < 0.5) || (dti != null && dti >= 0.60);
  if (triage) {
    lvl = 1;
  } else {
    // L2 Surviving: EF ≥ 0.5 AND SR ≥ 0.01 AND DTI ≤ 0.60
    if ((ef != null && ef >= 0.5) && (sr != null && sr >= 0.01) && (dti == null || dti <= 0.60)) lvl = 2;

    // L3 Steady: EF ≥ 1 AND SR ≥ 0.05 AND HR ≤ 0.50
    if ((ef != null && ef >= 1) && (sr != null && sr >= 0.05) && (hr == null || hr <= 0.50)) lvl = 3;

    // L4 Starter: EF ≥ 2 AND SR ≥ 0.10 (note: cannot detect “no new high-interest debt” reliably)
    if ((ef != null && ef >= 2) && (sr != null && sr >= 0.10)) lvl = 4;

    // L5 Buffer: EF ≥ 3 AND HR ≤ 0.40 AND SR ≥ 0.12 AND non‑mortgage DSR small (~cleared high‑interest)
    if ((ef != null && ef >= 3) && (hr == null || hr <= 0.40) && (sr != null && sr >= 0.12) && (nmdsr == null || nmdsr <= 0.05)) lvl = 5;

    // L6 Builder: EF ≥ 4 AND SR ≥ 0.15 AND nMDsr very low AND D/A ≤ 0.60
    if ((ef != null && ef >= 4) && (sr != null && sr >= 0.15) && (nmdsr == null || nmdsr <= 0.03) && (d_to_a == null || d_to_a <= 0.60)) lvl = 6;

    // L7 Resilient: (SR ≥ 0.20 AND EF ≥ 6 AND HR ≤ 0.35 AND DTI ≤ 0.35) OR NWM ≥ 1×
    if (((sr != null && sr >= 0.20) && (ef != null && ef >= 6) && (hr == null || hr <= 0.35) && (dti == null || dti <= 0.35)) || (nwm != null && nwm >= 1)) lvl = 7;

    // L8 Secure: EF ≥ 6 AND SR ≥ 0.25 AND DTI ≤ 0.30 AND NWM ≥ 5× AND RRR ≥ 0.60
    if ((ef != null && ef >= 6) && (sr != null && sr >= 0.25) && (dti == null || dti <= 0.30) && (nwm != null && nwm >= 5) && (rrr != null && rrr >= 0.60)) lvl = 8;

    // L9 Work‑Optional: NWM ≥ 25× AND RRR ≥ 1.0
    if ((nwm != null && nwm >= 25) && (rrr != null && rrr >= 1.0)) lvl = 9;

    // L10 Abundant: NWM ≥ 40× AND RRR ≥ 1.2
    if ((nwm != null && nwm >= 40) && (rrr != null && rrr >= 1.2)) lvl = 10;
  }

  // Enforce gates (caps) retroactively (unchanged)
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

  const points_to_next = undefined; // UI now provides human text

  return {
    overall: { level: (`L${lvl}` as any), points_to_next },
    reasons: reasons.length ? reasons : undefined,
    gates: g,
  };
}
