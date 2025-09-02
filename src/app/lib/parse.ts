import type { Confidence } from './schema/slots';

// parseMoney: handles "3k", "£3,000", "AUD 2–3k", returns number in base currency (no FX here)
export function parseMoney(input: string): { value: number | null; confidence: Confidence } {
  if (!input) return { value: null, confidence: 'med' };
  let s = String(input).trim().toLowerCase();
  const isApprox = /about|approx|~|around|estimate/.test(s);
  // Extract ranges like 2-3k or 2–3k
  const rangeMatch = s.match(/([\d.,]+)\s*[–-]\s*([\d.,]+)\s*([km])?/i);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(/[,]/g, ''));
    const b = parseFloat(rangeMatch[2].replace(/[,]/g, ''));
    const unit = rangeMatch[3]?.toLowerCase();
    const mul = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
    const mid = ((a + b) / 2) * mul;
    return { value: Number.isFinite(mid) ? mid : null, confidence: 'low' };
  }

  // strip currency words/symbols and spaces
  s = s.replace(/aud|usd|gbp|eur|cad|nzd|chf|zar|hkd|\$|£|€|r|\s/gi, '');
  const unit = s.endsWith('m') ? 'm' : s.endsWith('k') ? 'k' : '';
  if (unit) s = s.slice(0, -1);
  s = s.replace(/[,]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return { value: null, confidence: 'med' };
  const mul = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
  return { value: n * mul, confidence: isApprox ? 'low' : 'high' };
}

export function parsePercent(input: string): { value: number | null; confidence: Confidence } {
  if (!input) return { value: null, confidence: 'med' };
  const s = String(input).trim().toLowerCase();
  const isApprox = /about|approx|~|around|estimate/.test(s);
  const match = s.match(/([\d.]+)/);
  if (!match) return { value: null, confidence: 'med' };
  let num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return { value: null, confidence: 'med' };
  // If contains % symbol, interpret as 0..100
  if (/%/.test(s) || num > 1) num = num / 100;
  return { value: num, confidence: isApprox ? 'low' : 'high' };
}

export function validateEmail(input: string): boolean {
  if (!input) return false;
  return /.+@.+\..+/.test(input);
}
