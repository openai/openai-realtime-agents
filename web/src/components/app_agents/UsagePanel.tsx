import React, { useEffect, useState } from 'react';

type Usage = {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export const UsagePanel: React.FC<{ baseUrl: string; sessionId: string }> = ({
  baseUrl,
  sessionId,
}) => {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    async function fetchUsage() {
      try {
        const r = await fetch(
          `${baseUrl}/api/sdk/session/usage?session_id=${encodeURIComponent(
            sessionId
          )}`
        );
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        if (!stop) setUsage(data);
        if (!stop) setErr(null);
      } catch (e: any) {
        if (!stop) setErr(e.message || 'usage error');
      }
    }
    fetchUsage();
    // Moderate interval; avoid tight polling
    const id = window.setInterval(fetchUsage, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [baseUrl, sessionId]);

  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-purple-300">Usage</h2>
        {err && <span className="text-[11px] text-amber-400">{err}</span>}
      </div>
      {usage ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/80 rounded p-2">
            <div className="text-gray-400">Requests</div>
            <div className="text-gray-100 font-semibold">{usage.requests}</div>
          </div>
          <div className="bg-gray-800/80 rounded p-2">
            <div className="text-gray-400">Total tokens</div>
            <div className="text-gray-100 font-semibold">
              {usage.total_tokens}
            </div>
          </div>
          <div className="bg-gray-800/80 rounded p-2">
            <div className="text-gray-400">Input tokens</div>
            <div className="text-gray-100">{usage.input_tokens}</div>
          </div>
          <div className="bg-gray-800/80 rounded p-2">
            <div className="text-gray-400">Output tokens</div>
            <div className="text-gray-100">{usage.output_tokens}</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500">No data yet.</div>
      )}
    </section>
  );
};
