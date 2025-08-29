"use client";

import React from 'react';
import Link from 'next/link';
import { ensureHouseholdId } from "@/app/lib/householdLocal";

export default function FeedbackPage() {
  const [householdId, setHouseholdId] = React.useState<string>("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [category, setCategory] = React.useState('bug');
  const [severity, setSeverity] = React.useState('med');
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submittedId, setSubmittedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { setError('Please include a brief description.'); return; }
    setSubmitting(true); setError(null);
    try {
      const page_url = typeof window !== 'undefined' ? window.location.href : undefined;
      const res = await fetch('/api/feedback/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, name, email, category, severity, message, page_url })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.detail || j?.error || 'Failed');
      setSubmittedId(j.id || 'ok');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

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

      <section className="max-w-3xl mx-auto px-4 pt-12 pb-16">
        <h1 className="text-3xl md:text-4xl font-semibold">We’d love your feedback</h1>
        <p className="mt-2 text-gray-700">Report a bug or suggest an improvement. It helps us prioritize what to build next.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          {submittedId && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              Thank you — we’ve received your feedback!
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Email (optional)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
                <option value="bug">Bug</option>
                <option value="idea">Idea / Feature</option>
                <option value="ux">UX / Usability</option>
                <option value="performance">Performance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Describe the bug or suggestion</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="What happened? What did you expect? If it’s an idea, what would make Prosper more useful for you?" />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={submitting} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
            <span className="text-xs text-gray-600">Household: {householdId || '—'}</span>
          </div>
        </form>
      </section>

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
