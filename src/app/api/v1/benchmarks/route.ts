import { NextRequest, NextResponse } from 'next/server';

type Cohort = {
  country: string;
  age_bucket: string;
  homeownership?: 'own'|'rent'|'other';
  income_band?: string; // e.g., '0-30k','30-60k','60-100k','100-150k','150k+'
  dependants_bucket?: '0'|'1+'|'2+';
};

type MetricKey = 'level'|'sr'|'ef_months'|'dsr_total'|'dti'|'invnw'|'rrr';
type Percentiles = { p20: number; p50: number; p80: number };

function parseIntOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function bucketAge(age: number | null): string {
  if (age == null || !Number.isFinite(age)) return '30-39';
  if (age < 20) return '18-19';
  const lower = Math.floor(age / 10) * 10;
  const upper = lower + 9;
  return `${lower}-${upper}`;
}

function normaliseIncomeBand(band?: string | null): string | undefined {
  if (!band) return undefined;
  const s = band.toLowerCase().replace(/\s/g, '');
  if (s.includes('150')) return '150k+';
  if (s.includes('100-150')) return '100-150k';
  if (s.includes('60-100')) return '60-100k';
  if (s.includes('30-60')) return '30-60k';
  if (s.includes('0-30')) return '0-30k';
  // Accept shorthand like 100k+
  if (/^\d+\+?k$/.test(s)) return s.endsWith('+') ? `${s.toUpperCase()}` : `${s.toUpperCase()}+`;
  return undefined;
}

function dependantsBucket(dep?: string | null): '0'|'1+'|'2+'|undefined {
  if (!dep) return undefined;
  const m = dep.match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return '0';
  if (n === 1) return '1+';
  return '2+';
}

// Synthetic generator: returns cohort sample size and percentiles per metric.
function syntheticBenchmarks(cohort: Cohort, metrics: MetricKey[]): { n: number; metrics: Record<MetricKey, Percentiles> } {
  // Base parameters depend on age and income; these shape the distributions.
  const ageMid = (() => {
    const [lo, hi] = cohort.age_bucket.split('-').map((s) => Number(s));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 35;
    return (lo + hi) / 2;
  })();
  const incomeOrder = ['0-30k','30-60k','60-100k','100-150k','150k+'];
  const incIdx = cohort.income_band ? Math.max(0, incomeOrder.indexOf(cohort.income_band)) : 2;

  // Synthetic sample size: fewer when filters are tighter.
  let n = 2500 - 200 * (cohort.dependants_bucket ? 1 : 0) - 300 * (cohort.homeownership ? 1 : 0) - 300 * (cohort.income_band ? 1 : 0);
  n = clamp(n, 300, 4000);

  const rand = (seed: number) => {
    // Simple deterministic pseudo-random based on seed
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  const metricsOut: Record<MetricKey, Percentiles> = {} as any;

  for (const m of metrics) {
    // Shape parameters
    let p50 = 0, p20 = 0, p80 = 0;
    const incomeBoost = incIdx * 0.05; // higher income → better p50 for positive metrics
    const ageBoost = (ageMid - 35) / 100; // modest effect with age
    switch (m) {
      case 'sr': {
        const base = 0.12 + incomeBoost + ageBoost * 0.2;
        p50 = clamp(base, 0.02, 0.45);
        p20 = clamp(p50 - 0.07, 0.0, 0.4);
        p80 = clamp(p50 + 0.10, 0.03, 0.6);
        break;
      }
      case 'ef_months': {
        const base = 2.5 + (incIdx * 1.2) + (ageMid > 45 ? 1.0 : 0.2);
        p50 = clamp(base, 0, 18);
        p20 = clamp(p50 * 0.4, 0, 12);
        p80 = clamp(p50 * 1.8, 1, 18);
        break;
      }
      case 'dti': {
        const base = 0.45 - incIdx * 0.07 - ageBoost * 0.3;
        p50 = clamp(base, 0.1, 0.9);
        p20 = clamp(p50 - 0.15, 0.05, 0.8);
        p80 = clamp(p50 + 0.15, 0.1, 0.95);
        break;
      }
      case 'dsr_total': {
        const base = 0.22 - incIdx * 0.04 - ageBoost * 0.15;
        p50 = clamp(base, 0.05, 0.45);
        p20 = clamp(p50 - 0.07, 0.03, 0.40);
        p80 = clamp(p50 + 0.07, 0.06, 0.50);
        break;
      }
      case 'invnw': {
        const base = 0.25 + incIdx * 0.06 + (ageMid > 45 ? 0.1 : 0);
        p50 = clamp(base, 0.05, 0.8);
        p20 = clamp(p50 - 0.12, 0.01, 0.6);
        p80 = clamp(p50 + 0.18, 0.08, 0.95);
        break;
      }
      case 'rrr': {
        const base = 0.45 + incIdx * 0.05 + (ageMid > 50 ? 0.15 : 0);
        p50 = clamp(base, 0.1, 1.5);
        p20 = clamp(p50 - 0.25, 0.05, 1.0);
        p80 = clamp(p50 + 0.35, 0.15, 2.0);
        break;
      }
      case 'level': {
        const base = 5.5 + incIdx * 0.6 + (ageMid > 45 ? 0.5 : 0) + (cohort.homeownership === 'own' ? 0.3 : 0);
        p50 = clamp(base, 1, 10);
        p20 = clamp(p50 - 2, 1, 9);
        p80 = clamp(p50 + 2, 2, 10);
        break;
      }
    }
    // Tiny deterministic noise per metric/cohort
    const noise = (k: number) => (rand(k) - 0.5) * 0.02;
    const kseed = incIdx + ageMid;
    metricsOut[m] = {
      p20: Number((p20 + noise(kseed + 1)).toFixed(m === 'level' ? 0 : 3)),
      p50: Number((p50 + noise(kseed + 2)).toFixed(m === 'level' ? 0 : 3)),
      p80: Number((p80 + noise(kseed + 3)).toFixed(m === 'level' ? 0 : 3)),
    };
  }
  return { n, metrics: metricsOut };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = (url.searchParams.get('country') || 'UK').toUpperCase();
  const age = parseIntOrNull(url.searchParams.get('age'));
  const home = (url.searchParams.get('home') || undefined) as any;
  const incomeBand = normaliseIncomeBand(url.searchParams.get('income') || undefined);
  const depBucket = dependantsBucket(url.searchParams.get('dependants'));
  let metrics = (url.searchParams.get('metrics') || 'level,sr,ef_months,dsr_total,dti,invnw,rrr').split(',').map(s => s.trim()).filter(Boolean) as MetricKey[];
  metrics = metrics.filter(m => ['level','sr','ef_months','dsr_total','dti','invnw','rrr'].includes(m));
  if (metrics.length === 0) metrics = ['level','sr','ef_months'];

  const cohort: Cohort = {
    country,
    age_bucket: bucketAge(age),
    homeownership: (home === 'own' || home === 'rent' || home === 'other') ? home : undefined,
    income_band: incomeBand,
    dependants_bucket: depBucket,
  };

  // Placeholder: in a later phase, try live percentile queries first and fallback to synthetic if thin.
  const synth = syntheticBenchmarks(cohort, metrics);
  const fallback = true;

  const body = {
    cohort,
    n: synth.n,
    metrics: synth.metrics,
    fallback,
    data_source: 'synthetic',
  };
  return NextResponse.json(body, { status: 200 });
}

