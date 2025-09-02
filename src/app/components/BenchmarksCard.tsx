"use client";
import React from 'react';

type Percentiles = { p20: number; p50: number; p80: number };
type MetricKey = 'level'|'sr'|'ef_months'|'dsr_total'|'dti'|'invnw'|'rrr';

const cache = new Map<string, any>();

export function BenchmarksCard({ latest, kpis }: { latest: any; kpis: any }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<{ cohort: any; n: number; metrics: Record<MetricKey, Percentiles>; fallback: boolean } | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const cohortParams = React.useMemo(() => {
    const slots = latest?.inputs?.slots || {};
    const country = (latest?.inputs?.slots?.country?.value || latest?.inputs?.country || 'UK').toString();
    const birth = Number(slots?.birth_year?.value);
    const age = Number.isFinite(birth) ? (new Date().getUTCFullYear() - birth) : null;
    const home = (slots?.housing_status?.value || '').toString();
    // Estimate household income band
    const giSelf = Number(slots?.gross_income_annual_self?.value);
    const giPartner = Number(slots?.gross_income_annual_partner?.value);
    let gi = (Number.isFinite(giSelf) ? giSelf : 0) + (Number.isFinite(giPartner) ? giPartner : 0);
    if (!gi) {
      const net = Number(slots?.net_income_monthly_self?.value) + Number(slots?.net_income_monthly_partner?.value || 0);
      if (Number.isFinite(net) && net > 0) gi = net * 12 * 1.3; // rough gross-up
    }
    let income = '60-100k';
    if (gi > 150_000) income = '150k+';
    else if (gi > 100_000) income = '100-150k';
    else if (gi > 60_000) income = '60-100k';
    else if (gi > 30_000) income = '30-60k';
    else income = '0-30k';
    const deps = Number(slots?.dependants_count?.value);
    const dependants = Number.isFinite(deps) ? (deps <= 0 ? '0' : deps === 1 ? '1+' : '2+') : undefined;
    return { country, age, home, income, dependants };
  }, [latest]);

  React.useEffect(() => {
    const key = JSON.stringify({
      country: cohortParams.country || 'UK',
      age: cohortParams.age || '',
      home: cohortParams.home || '',
      income: cohortParams.income || '',
      dependants: cohortParams.dependants || '',
    });
    let aborted = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (cache.has(key)) { setData(cache.get(key)); return; }
        const qs = new URLSearchParams({
          country: String(cohortParams.country || 'UK'),
          age: String(cohortParams.age || ''),
          home: String(cohortParams.home || ''),
          income: String(cohortParams.income || ''),
          dependants: String(cohortParams.dependants || ''),
          metrics: 'level,sr,ef_months,dsr_total,dti,invnw,rrr',
        });
        const res = await fetch(`/api/v1/benchmarks?${qs.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed');
        if (!aborted) { cache.set(key, json); setData(json); }
      } catch (e: any) { if (!aborted) setError(e?.message || 'Failed to load'); }
      finally { if (!aborted) setLoading(false); }
    };
    const timer = setTimeout(() => { if (!aborted) void load(); }, 200); // debounce a touch
    return () => { aborted = true; clearTimeout(timer); };
  }, [cohortParams.country, cohortParams.age, cohortParams.home, cohortParams.income, cohortParams.dependants]);

  const dir: Record<MetricKey, 'higher'|'lower'> = {
    level: 'higher', sr: 'higher', ef_months: 'higher', invnw: 'higher', rrr: 'higher',
    dsr_total: 'lower', dti: 'lower',
  };

  function pctRank(val: number | null | undefined, p: Percentiles, d: 'higher'|'lower') {
    if (!Number.isFinite(val as number)) return null;
    const v = val as number;
    // Piecewise between p20/p50/p80
    if (d === 'higher') {
      if (v <= p.p20) return 20 * (v / Math.max(1e-9, p.p20));
      if (v >= p.p80) return 80 + 20 * ((v - p.p80) / Math.max(1e-9, p.p80));
      if (v <= p.p50) return 20 + 30 * ((v - p.p20) / Math.max(1e-9, (p.p50 - p.p20)));
      return 50 + 30 * ((v - p.p50) / Math.max(1e-9, (p.p80 - p.p50)));
    } else {
      // Lower is better
      if (v >= p.p80) return 20 * (p.p80 / Math.max(1e-9, v));
      if (v <= p.p20) return 80 + 20 * ((p.p20 - v) / Math.max(1e-9, p.p20));
      if (v >= p.p50) return 20 + 30 * ((p.p80 - v) / Math.max(1e-9, (p.p80 - p.p50)));
      return 50 + 30 * ((p.p50 - v) / Math.max(1e-9, (p.p50 - p.p20)));
    }
  }

  function fmtMetricLabel(k: MetricKey): string {
    return k === 'sr' ? 'Savings rate' :
           k === 'ef_months' ? 'Emergency buffer (months)' :
           k === 'dsr_total' ? 'Debt payments (of income)' :
           k === 'dti' ? 'Total debt vs income' :
           k === 'invnw' ? 'Investable share of net worth' :
           k === 'rrr' ? 'Retirement readiness' : 'Level';
  }

  function fmtValue(k: MetricKey, v: number | null | undefined): string {
    if (!Number.isFinite(v as number)) return '—';
    const n = v as number;
    if (k === 'sr' || k === 'dsr_total' || k === 'dti' || k === 'invnw') return `${Math.round(n * 100)}%`;
    if (k === 'ef_months') return `${(Math.round(n * 10) / 10).toFixed(1)} mo`;
    if (k === 'rrr') return `${(Math.round(n * 100) / 100).toFixed(2)}×`;
    if (k === 'level') return String(Math.round(n));
    return String(n);
  }

  const metricsOrder: MetricKey[] = ['level','sr','ef_months','dsr_total','dti','invnw','rrr'];

  if (loading) return <div className="text-sm text-gray-600">Loading peers…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const topLine = (() => {
    const p = data.metrics.level;
    const me = Number((latest?.levels?.overall?.level || 'L1').toString().match(/\d+/)?.[0] || 1);
    const rank = pctRank(me, p, 'higher');
    if (rank == null) return { text: 'Comparison unavailable', detail: '', top: 0 };
    const top = Math.round(rank);
    const label = [cohortParams.country || '—', (cohortParams.home || '—'), (cohortParams.income || '—')].join(', ');
    return { text: `Top ${top}% of peers`, detail: label, top };
  })();

  const share = async () => {
    const qs = new URLSearchParams({
      country: String(cohortParams.country || 'UK'),
      age: String(cohortParams.age || ''),
      home: String(cohortParams.home || ''),
      income: String(cohortParams.income || ''),
      dependants: String(cohortParams.dependants || ''),
      top: String(topLine.top || ''),
    });
    const url = `${location.origin}/share/benchmarks?${qs.toString()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'People like you — Prosper', text: `${topLine.text} (${topLine.detail})`, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Share link copied to clipboard');
      }
    } catch {}
  };

  

  return (
    <div className="p-3 border rounded-xl bg-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600 font-medium">People like you</div>
          <div className="text-xs text-gray-700 mt-0.5">
            <span className="text-base font-semibold text-gray-900 mr-1">{topLine.top}%</span> {topLine.text}
            <span className="ml-2 text-gray-500">{topLine.detail}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => setShowDetails(v => !v)} title={showDetails ? 'Hide details' : 'Show details'}>
            {showDetails ? 'Hide' : 'Details'}
          </button>
          <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={share} title="Share your peer comparison">Share</button>
        </div>
      </div>
      {showDetails && (
      <div className="mt-2 space-y-2">
        {metricsOrder.map((m) => {
          const p = data.metrics[m];
          if (!p) return null;
          const mine = m === 'level' ? Number((latest?.levels?.overall?.level || 'L1').toString().match(/\d+/)?.[0] || 1)
                       : Number(kpis?.[m]);
          const rank = pctRank(mine, p, dir[m]);
          const pct = rank == null ? '—' : `${Math.round(rank)}%`;
          const min = Math.min(p.p20, p.p50, p.p80);
          const max = Math.max(p.p20, p.p50, p.p80);
          const rel = Number.isFinite(mine) ? (Math.max(min, Math.min(max, mine)) - min) / Math.max(1e-9, (max - min)) : 0;
          return (
            <div key={m} className="text-xs">
              <div className="flex items-center justify-between">
                <div className="text-gray-700" title={fmtMetricLabel(m)}>{fmtMetricLabel(m)}</div>
                <div className="text-gray-600" title={`Your value: ${fmtValue(m, mine)}`}>{pct}</div>
              </div>
              <div className="mt-1 h-2 w-full bg-gray-200 rounded relative">
                {/* p20/p50/p80 ticks */}
                <div className="absolute top-0 h-2 w-0.5 bg-gray-500" style={{ left: '0%' }} title={`p20: ${fmtValue(m, p.p20)}`} />
                <div className="absolute top-0 h-2 w-0.5 bg-gray-500" style={{ left: '50%' }} title={`p50: ${fmtValue(m, p.p50)}`} />
                <div className="absolute top-0 h-2 w-0.5 bg-gray-500" style={{ left: '100%' }} title={`p80: ${fmtValue(m, p.p80)}`} />
                {/* You marker */}
                <div className="absolute -top-0.5 h-3 w-[2px] bg-emerald-600 rounded" style={{ left: `${rel * 100}%` }} title={`You: ${fmtValue(m, mine)}`} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>p20</span><span>p50</span><span>p80</span>
              </div>
            </div>
          );
        })}
      </div>
      )}
      <div className="mt-2 text-[11px] text-gray-500">n = {data.n} {data.fallback ? '(synthetic cohort)' : ''}</div>
    </div>
  );
}

export default BenchmarksCard;
