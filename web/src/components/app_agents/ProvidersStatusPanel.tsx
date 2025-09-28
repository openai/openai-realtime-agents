import React, { useEffect, useState } from 'react';

type ProvidersStatus = {
  openai_responses: boolean;
  litellm: boolean;
};

type ProviderFlags = {
  use_openai_responses: boolean;
  use_litellm: boolean;
};

export const ProvidersStatusPanel: React.FC<{ baseUrl: string }> = ({
  baseUrl,
}) => {
  const [status, setStatus] = useState<ProvidersStatus | null>(null);
  const [flags, setFlags] = useState<ProviderFlags | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    try {
      const sRes = await fetch(`${baseUrl}/api/models/providers/status`);
      if (!sRes.ok) throw new Error(await sRes.text());
      setStatus(await sRes.json());
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'error');
    }
  }

  async function loadFlags() {
    try {
      const fRes = await fetch(`${baseUrl}/api/models/providers/flags`);
      if (!fRes.ok) throw new Error(await fRes.text());
      setFlags(await fRes.json());
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'error');
    }
  }

  useEffect(() => {
    void loadStatus();
    void loadFlags();
    // refresh occasionally at a slower cadence to reduce noise
    const id = window.setInterval(() => {
      if (!document.hidden) void loadStatus();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  async function updateFlags(next: Partial<ProviderFlags>) {
    if (!flags) return;
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/models/providers/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flags, ...next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setFlags(await res.json());
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-sky-300">Model Providers</h2>
        {err && <span className="text-[11px] text-amber-400">{err}</span>}
      </div>
      <div className="text-xs text-gray-400 mb-2">
        Availability reflects installed wrappers. Toggles control which wrapper
        is used to run models.
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-800/70 rounded p-2">
          <div className="flex items-center justify-between">
            <div>OpenAI Responses</div>
            <span
              className={`text-[11px] ${
                status?.openai_responses ? 'text-emerald-400' : 'text-rose-400'
              }`}>
              {status?.openai_responses ? 'available' : 'missing'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={!!flags?.use_openai_responses}
              onChange={(e) =>
                updateFlags({ use_openai_responses: e.target.checked })
              }
              disabled={busy}
            />
          </div>
        </div>
        <div className="bg-gray-800/70 rounded p-2">
          <div className="flex items-center justify-between">
            <div>LiteLLM</div>
            <span
              className={`text-[11px] ${
                status?.litellm ? 'text-emerald-400' : 'text-rose-400'
              }`}>
              {status?.litellm ? 'available' : 'missing'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={!!flags?.use_litellm}
              onChange={(e) => updateFlags({ use_litellm: e.target.checked })}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
