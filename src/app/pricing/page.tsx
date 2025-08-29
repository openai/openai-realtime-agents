"use client";

import React from 'react';
import Link from 'next/link';
import { ensureHouseholdId } from "@/app/lib/householdLocal";

export default function PricingPage() {
  const [loading, setLoading] = React.useState<'monthly'|'annual'|null>(null);
  const [prices, setPrices] = React.useState<any | null>(null);
  React.useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/billing/prices', { cache: 'no-store' }); const j = await r.json(); setPrices(j); } catch {}
    })();
  }, []);
  const fmt = (c?: string, cents?: number) => {
    if (!c || typeof cents !== 'number') return '$';
    const n = (cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n); } catch { return `$${n}`; }
  };
  const startCheckout = async (interval: 'monthly'|'annual') => {
    try {
      setLoading(interval);
      const householdId = await ensureHouseholdId();
      // Try to prefill email from latest snapshot
      let email: string | undefined = undefined;
      try {
        const r = await fetch(`/api/prosper/dashboard?householdId=${householdId}`, { cache: 'no-store' });
        const d = await r.json();
        email = d?.latestSnapshot?.inputs?.slots?.email?.value || d?.latestSnapshot?.inputs?.email;
      } catch {}
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, email, interval }),
      });
      const j = await res.json();
      if (j?.url) window.location.href = j.url as string;
    } catch {
      // swallow and reset state
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2 text-sm font-semibold">
            <img src="/2D76K394f.eps.svg" alt="Prosper Logo" className="h-6 w-6" />
            Prosper
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-700">
            <Link href="/home" className="hover:text-gray-900">Home</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
          </nav>
          <Link href="/" className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">
            Start Chat
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-200 via-sky-200 to-indigo-200 blur-3xl opacity-60" />
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-8 text-center">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Simple pricing</h1>
          <p className="mt-4 text-lg md:text-xl text-gray-700">Start free. Upgrade any time. Cancel anytime in the billing portal.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col">
            <div className="text-sm font-medium">Monthly</div>
            <div className="mt-2 text-4xl font-semibold">{fmt(prices?.monthly?.currency, prices?.monthly?.unit_amount)}<span className="text-base text-gray-600"> / mo</span></div>
            <div className="mt-1 text-sm text-gray-600">Billed monthly</div>
            <ul className="mt-6 space-y-2 text-sm text-gray-800">
              <li>• Full dashboard and KPIs</li>
              <li>• Personalized actions and nudges</li>
              <li>• Net worth trends and history</li>
              <li>• Manage any time via billing portal</li>
            </ul>
            <button
              onClick={() => startCheckout('monthly')}
              disabled={loading === 'monthly'}
              className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {loading === 'monthly' ? 'Redirecting…' : 'Choose Monthly'}
            </button>
          </div>

          {/* Annual */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col">
            <div className="text-sm font-medium">Annual</div>
            <div className="mt-2 text-4xl font-semibold">{fmt(prices?.annual?.currency, prices?.annual?.unit_amount)}<span className="text-base text-gray-600"> / yr</span></div>
            <div className="mt-1 text-sm text-gray-600">Best value</div>
            <ul className="mt-6 space-y-2 text-sm text-gray-800">
              <li>• Everything in Monthly</li>
              <li>• Lower price per month</li>
              <li>• Priority improvements access</li>
              <li>• Manage any time via billing portal</li>
            </ul>
            <button
              onClick={() => startCheckout('annual')}
              disabled={loading === 'annual'}
              className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {loading === 'annual' ? 'Redirecting…' : 'Choose Annual'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <div>© {new Date().getFullYear()} Prosper</div>
            <div className="text-xs flex items-center gap-4">
              <span>Prosper provides general, educational information. It is not a financial adviser and does not provide financial advice.</span>
              <a href="/terms" className="underline">Terms</a>
              <a href="/privacy" className="underline">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
