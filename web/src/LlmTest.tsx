import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatPanel } from './components/app_agents/ChatPanel';
import { RawEventsPanel } from './components/app_agents/RawEventsPanel';
import { UsagePanel } from './components/app_agents/UsagePanel';
import { ProvidersStatusPanel } from './components/app_agents/ProvidersStatusPanel';
import { useEvents } from './hooks/useEvents';
import { useWsEvents } from './hooks/useWsEvents';
import { ToolsPanel } from './components/app_agents/ToolsPanel';

export default function LlmTest() {
  // Note: This page targets /api/llm/* which is deprecated/disabled in SDK-only mode.
  // Keep it for reference, but consider removing it from navigation when using Agents SDK-only.
  const baseUrl =
    (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:8000';
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('Hello');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [netWarn, setNetWarn] = useState<string | null>(null);
  const [model, setModel] = useState('gpt-4.1-mini');
  const [instructions, setInstructions] = useState<string>('');
  const [wsEnabled, setWsEnabled] = useState<boolean>(false);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);

  // Optional WebSocket stream with fallback to polling
  const ws = useWsEvents(
    baseUrl,
    wsEnabled ? sessionId || undefined : undefined,
    'llm'
  );
  // Events hook with runtime=llm; disable polling while WS is connected
  const { events, lastSeq, setEvents, setLastSeq, warn, refresh } = useEvents(
    baseUrl,
    sessionId || undefined,
    {
      enabled: autoRefresh && !(wsEnabled && ws.connected),
      visibilityPause: true,
      idleStopMs: 45000,
      runtime: 'llm',
    }
  );

  // Maintain last llm session id
  useEffect(() => {
    if (sessionId) return;
    try {
      const sid = localStorage.getItem('lastLlmSessionId');
      if (sid) setSessionId(sid);
    } catch {}
  }, [sessionId]);

  const [creating, setCreating] = useState(false);
  async function createSession() {
    setError(null);
    setCreating(true);
    try {
      const r = await fetch(`${baseUrl}/api/llm/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId || undefined, model }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setSessionId(data.session_id);
      // Reset local events tracking for new session clarity
      setEvents([]);
      setLastSeq(0);
      try {
        localStorage.setItem('lastLlmSessionId', data.session_id);
      } catch {}
    } catch (e: any) {
      setError(e.message || 'create failed');
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage() {
    const sid = sessionId || localStorage.getItem('lastLlmSessionId') || '';
    if (!sid) {
      setError('Create or enter a session id first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ac = new AbortController();
      const timeout = window.setTimeout(() => ac.abort(), 12000);
      const clientMessageId =
        globalThis.crypto && 'randomUUID' in globalThis.crypto
          ? (globalThis.crypto as any).randomUUID()
          : 'm_' + Math.random().toString(36).slice(2);
      const fetchPromise = fetch(`${baseUrl}/api/llm/session/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid || sessionId,
          user_input: input,
          client_message_id: clientMessageId,
          model,
          system: instructions || undefined,
        }),
        signal: ac.signal,
      });
      // Ensure the freshly appended user event shows up right away
      void refresh();
      window.setTimeout(() => void refresh(), 250);
      window.setTimeout(() => void refresh(), 900);
      const r = await fetchPromise;
      window.clearTimeout(timeout);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setInput('');
      setOutput(data.final_output || '');
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents((prev) => {
          const merged = [...prev];
          for (const ev of data.events) {
            if (!merged.some((e) => e.seq === ev.seq)) merged.push(ev);
          }
          merged.sort((a, b) => a.seq - b.seq);
          const maxSeq = merged.length
            ? merged[merged.length - 1].seq
            : lastSeq;
          setLastSeq(maxSeq);
          return merged;
        });
      }
      if (autoRefresh) {
        void refresh();
        window.setTimeout(() => void refresh(), 650);
        window.setTimeout(() => void refresh(), 1500);
      }
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Request timed out' : e.message);
    } finally {
      setLoading(false);
    }
  }

  // Load allowed tools using generic registry for LLM page
  useEffect(() => {
    let cancelled = false;
    async function fetchTools() {
      try {
        const r = await fetch(`${baseUrl}/api/tools/list`);
        if (!r.ok) throw new Error('tools list failed');
        const data = await r.json();
        const names = Array.isArray(data)
          ? data.map((t: any) => t.name).filter(Boolean)
          : [];
        if (!cancelled) setAllowedTools(names);
      } catch {
        if (!cancelled) setAllowedTools([]);
      }
    }
    fetchTools();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="space-y-4 lg:col-span-1">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              LLM Runtime
            </h1>
            <p className="text-sm text-gray-400">
              Responses-only multi-turn chat
            </p>
          </header>
          <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4">
            <div className="mb-2 text-sm font-semibold text-sky-300">
              Session
            </div>
            <div className="grid gap-2 text-xs">
              <input
                className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1"
                placeholder="Session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void createSession()}
                  disabled={creating}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded px-3 py-1 text-xs">
                  {creating ? 'Creating…' : 'Create / Reuse'}
                </button>
                <button
                  onClick={() => {
                    const sid = localStorage.getItem('lastLlmSessionId');
                    if (sid) setSessionId(sid);
                  }}
                  className="border border-gray-700 hover:bg-gray-800 rounded px-3 py-1 text-xs">
                  Load Last
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-gray-400">Model</label>
                <input
                  className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-gray-400">System instructions</label>
                <textarea
                  className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1"
                  rows={3}
                  placeholder="Optional system message..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto refresh events
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={wsEnabled}
                  onChange={(e) => setWsEnabled(e.target.checked)}
                />
                Use WebSocket streaming
                {wsEnabled && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${
                      ws.connected
                        ? 'bg-emerald-700/40 border-emerald-600 text-emerald-200'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                    {ws.connected ? 'WS connected' : 'WS idle'}
                  </span>
                )}
              </label>
              {error && (
                <div className="text-[11px] text-amber-400">{error}</div>
              )}
            </div>
          </section>
          <UsagePanel
            baseUrl={baseUrl}
            sessionId={sessionId}
            pathPrefix="/api/llm"
            enabled={autoRefresh && !!sessionId}
          />
          <ToolsPanel
            sessionId={sessionId}
            baseUrl={baseUrl}
            activeAgentName={'llm'}
            allowedTools={allowedTools}
            onError={(msg) => setError(msg || null)}
          />
          <ProvidersStatusPanel
            baseUrl={baseUrl}
            enabled={false}
            runtime="llm"
          />
        </div>
        <div className="xl:col-span-3 space-y-4">
          <ChatPanel
            events={wsEnabled && ws.connected ? ws.events : events}
            transcript={[]}
            realtimeLogs={[]}
            activeAgentName={'LLM'}
            loading={loading}
            netWarn={netWarn || warn}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
          />
          <RawEventsPanel
            events={wsEnabled && ws.connected ? ws.events : events}
          />
        </div>
      </div>
    </div>
  );
}
