"use client";

import React from 'react';
import Link from 'next/link';

export default function FeedbackAdminPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{category?: string; severity?: string; status?: string}>({});

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/feedback/list', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.detail || j?.error || 'failed');
      setItems(j.items || []);
    } catch (e: any) { setError(e?.message || 'failed'); }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function updateItem(id: string, patch: any) {
    try {
      const res = await fetch('/api/feedback/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      if (!res.ok) throw new Error('update_failed');
      await load();
    } catch {}
  }

  const filtered = items.filter((it) =>
    (!filter.category || it.category === filter.category) &&
    (!filter.severity || it.severity === filter.severity) &&
    (!filter.status || it.status === filter.status)
  );

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2 text-sm font-semibold">
            <img src="/2D76K394f.eps.svg" alt="Prosper Logo" className="h-6 w-6" />
            Prosper — Feedback Admin
          </Link>
          <button onClick={load} className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50">Refresh</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <select value={filter.category || ''} onChange={(e) => setFilter(s => ({ ...s, category: e.target.value || undefined }))} className="border rounded px-2 py-1">
            <option value="">All categories</option>
            <option value="bug">Bug</option>
            <option value="idea">Idea</option>
            <option value="ux">UX</option>
            <option value="performance">Performance</option>
            <option value="other">Other</option>
          </select>
          <select value={filter.severity || ''} onChange={(e) => setFilter(s => ({ ...s, severity: e.target.value || undefined }))} className="border rounded px-2 py-1">
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filter.status || ''} onChange={(e) => setFilter(s => ({ ...s, status: e.target.value || undefined }))} className="border rounded px-2 py-1">
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="triaged">Triaged</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Created</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Priority</th>
                <th className="text-left px-3 py-2">Message</th>
                <th className="text-left px-3 py-2">Household / Contact</th>
                <th className="text-left px-3 py-2">Page</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-2" colSpan={9}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-2" colSpan={9}>No feedback yet.</td></tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(it.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{it.category}</td>
                    <td className="px-3 py-2">{it.severity}</td>
                    <td className="px-3 py-2">
                      <select value={it.status} onChange={(e) => updateItem(it.id, { status: e.target.value })} className="border rounded px-1 py-0.5 text-xs">
                        <option value="open">Open</option>
                        <option value="triaged">Triaged</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={it.priority} onChange={(e) => updateItem(it.id, { priority: e.target.value })} className="border rounded px-1 py-0.5 text-xs">
                        <option value="p0">P0</option>
                        <option value="p1">P1</option>
                        <option value="p2">P2</option>
                        <option value="p3">P3</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 max-w-md">{it.message}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-700">{it.household_id || '—'}</div>
                      <div className="text-xs text-gray-500">{it.name || it.email || ''}</div>
                    </td>
                    <td className="px-3 py-2"><a className="underline text-blue-600" href={it.page_url || '#'} target="_blank">Open</a></td>
                    <td className="px-3 py-2"><button onClick={load} className="text-xs underline">Refresh</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

