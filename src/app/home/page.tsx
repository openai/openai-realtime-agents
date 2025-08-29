import Link from 'next/link';

export default function HomePage() {
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
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <a href="#why" className="hover:text-gray-900">Why Prosper</a>
            <a href="#faq" className="hover:text-gray-900">FAQ</a>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/feedback" className="hover:text-gray-900">Feedback</Link>
          </nav>
          <Link href="/" className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">
            Start Chat — it’s free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-200 via-sky-200 to-indigo-200 blur-3xl opacity-60" />
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
            Meet Prosper — your personal wealth coach
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-700">
            Get a clear, actionable plan to improve your finances, just by having a simple conversation.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2">
            <span className="text-xs md:text-sm text-gray-600">No credit card • No bank connection • Judgment‑free</span>
            <Link href="/" className="px-5 py-3 rounded-xl bg-gray-900 text-white text-base hover:bg-gray-800 shadow-sm">
              Start Chat Free
            </Link>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">What you’ll get in 5 minutes</h2>
            <ul className="mt-4 space-y-3 text-gray-700">
              <li>• Your Prosper Level (L0–L9), in plain English.</li>
              <li>• Key KPIs: savings rate, emergency fund, housing and debt ratios.</li>
              <li>• Your next 2 best actions with “why this helps” and quick steps.</li>
              <li>• A progress view to track net worth and improvements over time.</li>
            </ul>
            <div className="mt-6">
              <Link href="/" className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Start Chat — it’s free</Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border shadow-sm bg-white p-4">
              <div className="text-sm text-gray-600">Preview</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Level</div>
                  <div className="text-2xl font-semibold">L5</div>
                  <div className="text-xs text-gray-600">Building Resilience</div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Urgent KPI</div>
                  <div className="h-1.5 rounded bg-gray-200 mt-2">
                    <div className="h-1.5 w-1/2 rounded bg-emerald-500" />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Emergency fund → 3 months</div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Next action</div>
                  <div className="text-sm mt-1">Open a high‑interest savings space</div>
                  <div className="text-[11px] text-gray-600">Why: lift buffer quickly</div>
                </div>
                <div className="rounded-lg border p-3 bg-white">
                  <div className="text-xs text-gray-500">Net worth</div>
                  <div className="text-xl font-semibold mt-1">$182,400</div>
                  <div className="text-[11px] text-emerald-700">▲ +$1,200 (0.7%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-semibold text-center">How it works</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">1 — Start a friendly chat</div>
            <div className="text-sm text-gray-700 mt-1">Answer a few short questions. Ranges are fine.</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">2 — See your status</div>
            <div className="text-sm text-gray-700 mt-1">Get your level and KPIs, explained in everyday language.</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">3 — Take action</div>
            <div className="text-sm text-gray-700 mt-1">2 best actions for momentum, plus gentle nudges.</div>
          </div>
        </div>
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center px-5 py-3 rounded-xl bg-gray-900 text-white text-base hover:bg-gray-800">Start Chat — it’s free</Link>
        </div>
      </section>

      {/* Why Prosper */}
      <section id="why" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-semibold text-center">Why people love Prosper</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">Clear status, fast</div>
            <div className="text-sm text-gray-700 mt-1">No spreadsheets or bank links required.</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">Actionable steps</div>
            <div className="text-sm text-gray-700 mt-1">Practical guidance for your situation, not generic advice.</div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">Friendly + private</div>
            <div className="text-sm text-gray-700 mt-1">No jargon, no judgment. Delete anytime.</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-semibold text-center">FAQ</h2>
        <div className="mt-6 divide-y border rounded-2xl bg-white">
          <div className="p-5">
            <div className="text-sm font-medium">Is this financial advice?</div>
            <div className="text-sm text-gray-700 mt-1">Prosper provides general educational information and planning tools. It doesn’t replace a licensed adviser. Consider your personal circumstances and seek professional advice when needed.</div>
          </div>
          <div className="p-5">
            <div className="text-sm font-medium">Do I need to link my bank?</div>
            <div className="text-sm text-gray-700 mt-1">No. You can get a clear snapshot and plan with a few quick numbers you already know.</div>
          </div>
          <div className="p-5">
            <div className="text-sm font-medium">How much does it cost?</div>
            <div className="text-sm text-gray-700 mt-1">Start free. Keep using Prosper with a simple monthly plan. You can cancel anytime in the billing portal.</div>
          </div>
          <div className="p-5">
            <div className="text-sm font-medium">Can I use this with a partner?</div>
            <div className="text-sm text-gray-700 mt-1">Yes. Add both incomes and shared costs — Prosper will keep it simple.</div>
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
