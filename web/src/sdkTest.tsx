import React, { useState, useEffect, useRef, useMemo } from 'react';
import useMicrophone from './hooks/useMicrophone';
import { useRealtime } from './realtime/useRealtime';
import { ToolsPanel } from './components/app_agents/ToolsPanel';
import { SessionConfig } from './components/app_agents/SessionConfig';
import { AgentConfig } from './components/app_agents/AgentConfig';
import { PageHeader } from './components/app_agents/PageHeader';
import { RealtimePanel } from './components/app_agents/RealtimePanel';
import { ChatPanel } from './components/app_agents/ChatPanel';
import { RawEventsPanel } from './components/app_agents/RawEventsPanel';
import { UsagePanel } from './components/app_agents/UsagePanel';
// Providers panel is redundant in SDK-only mode; removed from this page
import { useEvents } from './hooks/useEvents';

export default function SDKTestStandalone() {
  const [sessionId, setSessionId] = useState('');
  const [instructions, setInstructions] = useState('You are concise.');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [input, setInput] = useState('Hello');
  const [output, setOutput] = useState('');
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [allowedTools, setAllowedTools] = useState<string[]>(['echo_context']);
  const baseUrl =
    (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:8000';
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [netWarn] = useState<string | null>(null);
  const [pttActive, setPttActive] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(true);
  const [chatStarted, setChatStarted] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const { events, lastSeq, setEvents, setLastSeq, warn, refresh } = useEvents(
    baseUrl,
    sessionId || undefined,
    { enabled: autoRefresh, visibilityPause: true, idleStopMs: 45000 }
  );

  // --- Multi-agent scaffolding ---
  interface AgentDef {
    id: string;
    name: string;
    instructions: string;
  }
  const agents: AgentDef[] = [
    {
      id: 'general',
      name: 'General',
      instructions: 'You are a helpful general assistant.',
    },
    {
      id: 'sales',
      name: 'Sales',
      instructions:
        'You focus on product discovery and persuasive but honest recommendations. Ask clarifying questions if the user intent is ambiguous.',
    },
    {
      id: 'support',
      name: 'Support',
      instructions:
        'You handle troubleshooting calmly, gather concise diagnostics, and provide stepwise resolutions.',
    },
  ];
  const [activeAgentId, setActiveAgentId] = useState<string>('general');
  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];
  const effectiveInstructions = useMemo(() => {
    return `${instructions}\n\n[Active Agent: ${activeAgent.name}]\n${activeAgent.instructions}`.trim();
  }, [instructions, activeAgent]);
  const refreshTimer = useRef<number | null>(null);
  const fastPollTimer = useRef<number | null>(null);
  const fastPollUntil = useRef<number>(0);

  // Microphone hook (basic energy + naive VAD)
  const micFrameBatchRef = useRef<Float32Array[]>([]);
  const mic = useMicrophone({
    vadThreshold: 0.15,
    onAudioFrame: (frame) => {
      // Only collect if PTT currently active.
      if (!pttActiveRef.current) return;
      micFrameBatchRef.current.push(frame);
    },
  });
  const pttActiveRef = useRef(false);
  useEffect(() => {
    pttActiveRef.current = pttActive;
  }, [pttActive]);

  // Realtime session
  const realtime = useRealtime(remoteAudioRef, {
    baseUrl,
    disableAutoMic: true,
    forceEnglish: true,
  });
  const realtimeConnected = realtime.status === 'CONNECTED';
  // User mic waveform (reuse mic.level for simplicity)
  const userLevel = mic.level; // 0..1

  // --- Session / messaging helpers ---
  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), 15000);
      const r = await fetch(`${baseUrl}/api/sdk/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: activeAgent.name,
          instructions: effectiveInstructions,
          session_id: sessionId || undefined,
          model,
          scenario_id: 'default',
        }),
        signal: ac.signal,
      });
      window.clearTimeout(t);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setSessionId(data.session_id);
      try {
        localStorage.setItem('lastSessionId', data.session_id);
      } catch {}
      // On new session, reset events tracking
      setEvents([]);
      setLastSeq(0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage() {
    if (!sessionId) {
      setError('Create session first');
      return;
    }
    if (loading) return; // prevent double sends
    setLoading(true);
    setError(null);
    try {
      // Prepare abortable request and refresh events immediately so the user message shows up
      const ac = new AbortController();
      const timeout = window.setTimeout(() => ac.abort(), 12000);
      const clientMessageId =
        globalThis.crypto && 'randomUUID' in globalThis.crypto
          ? (globalThis.crypto as any).randomUUID()
          : 'm_' + Math.random().toString(36).slice(2);
      const fetchPromise = fetch(`${baseUrl}/api/sdk/session/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_input: input,
          client_message_id: clientMessageId,
          scenario_id: 'default',
          agent: {
            name: activeAgent.name,
            instructions: effectiveInstructions,
            model,
          },
        }),
        signal: ac.signal,
      });
      // Kick an immediate events refresh while the turn processes on the server
      // so the just-appended user event is visible right away
      void refresh();
      window.setTimeout(() => void refresh(), 250);
      window.setTimeout(() => void refresh(), 900);
      const r = await fetchPromise;
      window.clearTimeout(timeout);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      // Mark chat as started on first successful turn
      if (!chatStarted) setChatStarted(true);
      // clear input after successful send
      setInput('');
      setOutput(data.final_output || '');
      setToolCalls(data.tool_calls || []);
      // Append returned events (user event only)
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
      if (autoRefresh) void loadTranscript(false);
      // Events fetching strategy
      if (autoRefresh) {
        // Short fast-poll burst to surface tokens quickly
        fastPollUntil.current = Date.now() + 3500;
        if (fastPollTimer.current) clearInterval(fastPollTimer.current);
        fastPollTimer.current = window.setInterval(() => {
          if (Date.now() > fastPollUntil.current) {
            if (fastPollTimer.current) clearInterval(fastPollTimer.current);
            return;
          }
          void refresh();
        }, 200);
      } else {
        // Auto refresh disabled: do a very small number of forced fetches only
        window.setTimeout(() => void refresh(), 600);
        window.setTimeout(() => void refresh(), 1400);
      }
      // Orchestrator call (placeholder: backend may switch root later)
      try {
        const orc = await fetch(`${baseUrl}/api/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_id: 'default',
            last_user_input: input,
            current_root: activeAgent.name,
            session_id: sessionId,
          }),
        });
        if (orc.ok) {
          const ojson = await orc.json();
          if (ojson.changed && ojson.chosen_root) {
            // For now just console log; UI handoff timeline below.
            setHandoffEvents((ev) => [
              ...ev,
              {
                id: 'h' + ev.length,
                from: activeAgent.name,
                to: ojson.chosen_root,
                reason: ojson.reason || 'n/a',
                at: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch (e) {
        console.warn('orchestrate failed', e);
      }
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Request timed out' : e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTranscript(clearErr = true) {
    if (!sessionId) {
      if (clearErr) setError('Create session first');
      return;
    }
    if (clearErr) setError(null);
    try {
      const r = await fetch(
        `${baseUrl}/api/sdk/session/transcript?session_id=${encodeURIComponent(
          sessionId
        )}`
      );
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setTranscript(data.items || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  // remove local loadEvents; use useEvents instead

  // Placeholder: where audio frames would be encoded & sent
  // Batch & flush audio frames every 500ms while recording.
  useEffect(() => {
    if (!mic.enabled || !pttActive) return;
    const interval = setInterval(() => {
      const frames = micFrameBatchRef.current;
      if (!frames.length) return;
      // Concatenate frames
      const total = frames.reduce((sum, f) => sum + f.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      frames.forEach((f) => {
        merged.set(f, off);
        off += f.length;
      });
      micFrameBatchRef.current = [];
      if (realtimeConnected) {
        // Slice merged into ~1600 sample frames for realtime session send
        const frameSize = 1600;
        for (let i = 0; i < merged.length; i += frameSize) {
          realtime.sendAudioFrame(merged.subarray(i, i + frameSize));
        }
      } else {
        // Fallback logging while not connected
        console.debug('AudioBatch(local)', { samples: merged.length });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [mic.enabled, pttActive, realtimeConnected, realtime]);

  {
    /* (Removed standalone microphone panel; controls moved into Voice Chat) */
  }

  // Chat parsing and auto-scroll handled inside ChatPanel

  // Auto refresh transcript occasionally; events are handled by useEvents
  useEffect(() => {
    if (!autoRefresh) {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }
    refreshTimer.current = window.setInterval(() => {
      // Occasional transcript refresh (optional)
      if (Math.random() < 0.34) void loadTranscript(false);
    }, 3000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, sessionId, lastSeq]);

  // Resume: load lastSeq from localStorage and immediately fetch events
  useEffect(() => {
    if (!sessionId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Restore sessionId if present
  useEffect(() => {
    if (sessionId) return;
    try {
      const sid = localStorage.getItem('lastSessionId');
      if (sid) setSessionId(sid);
    } catch {}
  }, [sessionId]);

  // Fetch allowed tools for active agent via backend endpoint (decoupled)
  useEffect(() => {
    let cancelled = false;
    async function fetchAllowed() {
      try {
        const r = await fetch(
          `${baseUrl}/api/agents/${encodeURIComponent(
            activeAgent.name
          )}/tools?scenario_id=default`
        );
        if (!r.ok) throw new Error('tools fetch failed');
        const s = await r.json();
        const listRaw: string[] = Array.isArray(s?.allowed_tools)
          ? s.allowed_tools
          : ['echo_context'];
        const list =
          Array.isArray(listRaw) && listRaw.length > 0
            ? listRaw
            : ['echo_context'];
        if (!cancelled) setAllowedTools(list);
      } catch {
        if (!cancelled) setAllowedTools(['echo_context']);
      }
    }
    fetchAllowed();
    return () => {
      cancelled = true;
    };
  }, [activeAgentId, activeAgent.name, baseUrl]);

  // Enter key handled inside ChatPanel

  // Handoff events timeline state
  const [handoffEvents, setHandoffEvents] = useState<
    { id: string; from: string; to: string; reason: string; at: string }[]
  >([]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-6 transition-all">
        {/* Full-width header */}
        <div className="xl:col-span-4">
          <PageHeader
            title="OA Agents SDK"
            subtitle="Realtime and multi-turn chat demo"
          />
        </div>

        {/* Left column: Session, Agent, Tools, Usage, Logs toggle */}
        <div className="space-y-4 lg:col-span-1">
          <section className="bg-gray-900/70 border border-gray-800 rounded-lg">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-teal-300">Session</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // New Session: clear persisted id and in-memory state
                    try {
                      localStorage.removeItem('lastSessionId');
                    } catch {}
                    setSessionId('');
                    setEvents([]);
                    setTranscript([]);
                    setLastSeq(0);
                    setError(null);
                  }}
                  className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
                  New Session
                </button>
                <button
                  type="button"
                  onClick={() => setSessionOpen((v) => !v)}
                  className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
                  {sessionOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>
            {sessionOpen && (
              <div className="p-4">
                <SessionConfig
                  sessionId={sessionId}
                  setSessionId={setSessionId}
                  model={model}
                  setModel={setModel}
                  autoRefresh={autoRefresh}
                  setAutoRefresh={setAutoRefresh}
                  agents={agents}
                  activeAgentId={activeAgentId}
                  setActiveAgentId={setActiveAgentId}
                  instructions={instructions}
                  setInstructions={setInstructions}
                  effectiveInstructions={effectiveInstructions}
                  creating={creating}
                  createSession={createSession}
                  loadTranscript={() => loadTranscript()}
                  error={error}
                  realtimeConnected={realtimeConnected}
                  hideAgentControls
                />
              </div>
            )}
          </section>

          <AgentConfig
            agents={agents}
            activeAgentId={activeAgentId}
            setActiveAgentId={setActiveAgentId}
            instructions={instructions}
            setInstructions={setInstructions}
            effectiveInstructions={effectiveInstructions}
            realtimeConnected={realtimeConnected}
            title="Agent"
          />

          <ToolsPanel
            sessionId={sessionId}
            baseUrl={baseUrl}
            activeAgentName={activeAgent.name}
            allowedTools={allowedTools}
            onError={(msg) => setError(msg || null)}
          />

          <UsagePanel
            baseUrl={baseUrl}
            sessionId={sessionId}
            // Only poll usage after chat has started (first message turn)
            enabled={!!sessionId && chatStarted}
          />

          <button
            onClick={() => setShowLogs((v) => !v)}
            className="w-full text-left text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
            {showLogs ? 'Hide Raw Logs' : `Show Raw Logs (${events.length})`}
          </button>
        </div>

        {/* Middle column: Realtime + Chat */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <RealtimePanel
            status={realtime.status}
            connected={realtimeConnected}
            connect={realtime.connect}
            disconnect={realtime.disconnect}
            logs={realtime.logs}
            hearing={realtime.hearing}
            userLevel={userLevel}
            onSendText={(t) => realtime.sendUserText(t)}
            onMicStart={async () => {
              if (!mic.enabled && !mic.enabling) await mic.start();
              setPttActive(true);
            }}
            onMicStop={() => setPttActive(false)}
            micEnabled={mic.enabled}
          />
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          <ChatPanel
            events={events}
            transcript={transcript}
            realtimeLogs={realtime.logs}
            activeAgentName={activeAgent.name}
            loading={loading}
            netWarn={netWarn || warn}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
            handoffEvents={handoffEvents}
          />

          {/* Final Output panel hidden for now */}
          {false && output && (
            <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-teal-400 mb-2">
                Final Output
              </h2>
              <pre className="whitespace-pre-wrap break-words text-sm bg-gray-950 border border-gray-800 rounded p-3 max-h-56 overflow-auto">
                {output}
              </pre>
              {toolCalls.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-gray-400">
                    Tool Calls
                  </h3>
                  <ul className="list-disc list-inside text-xs text-gray-300">
                    {toolCalls.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 text-[10px] text-gray-500 space-y-1 border-t border-gray-800 pt-2">
                <div>
                  <span className="text-gray-400">
                    Effective Instructions Preview:
                  </span>{' '}
                  {effectiveInstructions.slice(0, 120)}
                  {effectiveInstructions.length > 120 ? '…' : ''}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Full-width Raw Logs when open */}
        {showLogs && (
          <div className="xl:col-span-4">
            <RawEventsPanel transcript={transcript} events={events} fullWidth />
          </div>
        )}
      </div>
    </div>
  );
}
