import React, { useEffect, useState } from 'react';

type ProvidersStatus = {
  openai_responses: boolean;
  litellm: boolean;
  default_responses?: boolean;
  agents_sdk?: boolean;
};

type ProviderFlags = {
  use_openai_responses: boolean;
  use_litellm: boolean;
  use_agents_sdk: boolean;
};

export const ProvidersStatusPanel: React.FC<{
  baseUrl: string;
  enabled?: boolean;
  runtime?: 'sdk' | 'llm';
}> = ({ baseUrl, enabled = true, runtime = 'sdk' }) => {
  const [status, setStatus] = useState<ProvidersStatus | null>(null);
  const [flags, setFlags] = useState<ProviderFlags | null>({
    use_openai_responses: true,
    use_litellm: false,
    use_agents_sdk: true,
  });
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
      const srv = (await fRes.json()) as ProviderFlags;
      setFlags((prev) => ({
        use_openai_responses:
          srv.use_openai_responses ?? prev?.use_openai_responses ?? true,
        use_litellm: srv.use_litellm ?? prev?.use_litellm ?? false,
        use_agents_sdk: srv.use_agents_sdk ?? prev?.use_agents_sdk ?? true,
      }));
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'error');
    }
  }

  // Always fetch once on mount to populate labels even if autoRefresh is off.
  useEffect(() => {
    void loadStatus();
    void loadFlags();
  }, []);

  // Only periodic polling is gated by `enabled` (Auto Refresh)
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void loadStatus();
    }, 20000);
    return () => clearInterval(id);
  }, [enabled]);

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

  const showSdk = runtime === 'sdk';
  const showResponses = runtime === 'sdk';
  const readOnly = runtime === 'llm';

  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-sky-300">Model Providers</h2>
        {err && <span className="text-[11px] text-amber-400">{err}</span>}
      </div>
      <div className="text-xs text-gray-400 mb-2">
        {runtime === 'sdk'
          ? 'Default path works without any wrapper. Toggle optional providers below.'
          : 'Responses-only runtime. Provider toggles are not applicable here.'}
      </div>
      <div className="flex flex-col gap-3 text-xs">
        <div className="bg-gray-800/70 rounded p-2">
          <div className="flex items-center justify-between">
            <div>Default (Responses)</div>
            <span
              className={`text-[11px] ${
                status?.default_responses !== false
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}>
              {status?.default_responses !== false ? 'ready' : 'unavailable'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Always on. No extra setup required.
          </div>
        </div>
        {showSdk && (
          <div className="bg-gray-800/70 rounded p-2">
            <div className="flex items-center justify-between">
              <div>Agents SDK</div>
              <span
                className={`text-[11px] ${
                  status?.agents_sdk ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                {status?.agents_sdk ? 'ready' : 'unavailable'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={!!flags?.use_agents_sdk}
                onChange={(e) =>
                  updateFlags({ use_agents_sdk: e.target.checked })
                }
                disabled={busy || status?.agents_sdk === false}
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-400">
              Use SDK exclusively when on.
            </div>
          </div>
        )}
        {showResponses && (
          <div className="bg-gray-800/70 rounded p-2">
            <div className="flex items-center justify-between">
              <div>OpenAI Responses</div>
              <span
                className={`text-[11px] ${
                  status?.openai_responses
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}>
                {status?.openai_responses ? 'ready' : 'unavailable'}
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
        )}
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
              disabled={busy || readOnly}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
