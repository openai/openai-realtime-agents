import React, { useState, useEffect, useRef, useMemo } from 'react';
import useMicrophone from './hooks/useMicrophone';
import { useRealtime } from './realtime/useRealtime';

export default function SDKTestStandalone() {
  const [sessionId, setSessionId] = useState('');
  const [instructions, setInstructions] = useState('You are concise.');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [input, setInput] = useState('Hello');
  const [output, setOutput] = useState('');
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pttActive, setPttActive] = useState(false);
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
  const baseUrl =
    (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:8000';
  const refreshTimer = useRef<number | null>(null);

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

  // Realtime session (audio+text)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtime = useRealtime(remoteAudioRef, { forceEnglish: true });
  const realtimeConnected = realtime.status === 'CONNECTED';

  // Inline helper components (kept minimal)
  const RealtimeLogs: React.FC<{ logs: any[] }> = ({ logs }) => {
    const boxRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atBottom) el.scrollTop = el.scrollHeight;
    }, [logs.length]);
    return (
      <div
        ref={boxRef}
        className="text-[11px] bg-gray-950 border border-gray-800 rounded p-2 h-48 overflow-y-auto space-y-1 custom-scroll">
        {logs.map((l) => (
          <div key={l.id} className="flex gap-1">
            <span className="text-gray-500 shrink-0">[{l.time}]</span>
            <span
              className={
                l.kind === 'event'
                  ? 'text-indigo-300'
                  : l.role === 'user'
                  ? 'text-teal-300'
                  : 'text-gray-200'
              }>
              {l.kind === 'event' ? l.type : `${l.role}: ${l.content}`}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-600">No realtime logs yet.</div>
        )}
      </div>
    );
  };

  const RealtimeQuickSend: React.FC<{
    onSend: (t: string) => void;
    disabled: boolean;
  }> = ({ onSend, disabled }) => {
    const [rtText, setRtText] = useState('Hello realtime');
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && rtText.trim()) {
            onSend(rtText.trim());
            setRtText('');
          }
        }}
        className="flex flex-col gap-2">
        <input
          name="realtimeQuickSend"
          id="realtimeQuickSend"
          value={rtText}
          onChange={(e) => setRtText(e.target.value)}
          disabled={disabled}
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="Send realtime text"
        />
        <button
          disabled={disabled || !rtText.trim()}
          className="text-[11px] px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-40 self-start">
          Send Text
        </button>
      </form>
    );
  };

  // (Removed assistant playback switch per cleanup request)

  // User mic waveform (reuse mic.level for simplicity, smoothing already handled in hook)
  const userLevel = mic.level; // 0..1

  // --- Session / messaging helpers (restored after refactor) ---
  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const r = await fetch(`${baseUrl}/api/sdk/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: effectiveInstructions,
          session_id: sessionId || undefined,
          model,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
  setSessionId(data.session_id);
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
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${baseUrl}/api/sdk/session/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_input: input }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setOutput(data.final_output || '');
      setToolCalls(data.tool_calls || []);
      if (autoRefresh) void loadTranscript(false);
    } catch (e: any) {
      setError(e.message);
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
  }, [mic.enabled, pttActive, realtimeConnected]);

  {
    /* (Removed standalone microphone panel; controls moved into Voice Chat) */
  }

  // ---------------- Chat parsing helpers (restored) ----------------
  interface ChatMessage {
    id: string;
    role: string;
    text: string;
    raw: any;
    kind: 'user' | 'assistant' | 'tool' | 'system';
    toolName?: string;
    source: 'sdk' | 'realtime';
  }

  function extractText(item: any): string {
    if (!item) return '';
    if (typeof item.content === 'string') return item.content;
    if (Array.isArray(item.content)) {
      const textParts = item.content
        .filter(
          (c: any) =>
            c &&
            (c.type === 'output_text' ||
              c.type === 'input_text' ||
              c.type === 'text')
        )
        .map((c: any) => c.text?.trim())
        .filter(Boolean);
      if (textParts.length) return textParts.join('\n');
    }
    if (typeof item.text === 'string') return item.text;
    if (typeof item.output === 'string') return item.output;
    if (item.arguments && typeof item.arguments === 'string')
      return item.arguments;
    return '';
  }

  // (Removed experimental frontend handoff + moderation UI; backend orchestrator will manage multi-agent handoffs later.)
  const chatMessages: ChatMessage[] = useMemo(() => {
    const msgs: ChatMessage[] = [];
    for (const it of transcript) {
      const t = it.type || it.role;
      if (t === 'function_call' || t === 'function_call_output') continue;
      const role = it.role || (t === 'message' ? 'assistant' : t) || 'item';
      const kind: ChatMessage['kind'] =
        role === 'user'
          ? 'user'
          : role === 'assistant'
          ? 'assistant'
          : role === 'tool'
          ? 'tool'
          : 'system';
      const text = extractText(it);
      msgs.push({ id: it.id || 't:' + msgs.length, role, text, raw: it, kind, source: 'sdk' });
    }
    realtime.logs.forEach((l: any) => {
      if (l.kind === 'text' && l.role && l.content) {
        msgs.push({ id: 'rt:' + l.id, role: l.role, text: l.content, raw: l, kind: l.role === 'user' ? 'user' : 'assistant', source: 'realtime' });
      }
    });
    return msgs;
  }, [transcript, realtime.logs]);

  // Auto scroll chat when new message
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Auto refresh transcript every 4s
  useEffect(() => {
    if (!autoRefresh) {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      return;
    }
    refreshTimer.current = window.setInterval(() => {
      loadTranscript(false);
    }, 4000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, sessionId]);

  // Enter key shortcut (Ctrl+Enter)
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-4 gap-6 transition-all">
        <div className="space-y-4 lg:col-span-1">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">
              Agents SDK Test
            </h1>
            <p className="text-sm text-gray-400">
              Isolated multi-turn memory & tool demo
            </p>
          </header>
          <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">
                Session ID
              </label>
              <input
                className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="(auto)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-gray-400">Model</label>
                <input
                  className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 flex items-center justify-between">
                  Auto Refresh
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="ml-2"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs uppercase text-gray-400 flex items-center justify-between">
                  Agent
                  {realtimeConnected && (
                    <span className="ml-2 text-[10px] text-amber-400">
                      Reconnect voice after switching
                    </span>
                  )}
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {agents.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setActiveAgentId(a.id)}
                      className={`px-2 py-1 rounded text-[11px] border transition ${
                        activeAgentId === a.id
                          ? 'bg-teal-600 border-teal-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                      }`}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 flex items-center justify-between">
                  Base Instructions{' '}
                  <span className="text-[10px] text-gray-500">
                    Agent overlay shown below
                  </span>
                </label>
                <textarea
                  className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <div className="mt-2 text-[10px] leading-relaxed bg-gray-950 border border-gray-800 rounded p-2 text-gray-400">
                  <div className="font-semibold text-gray-300 mb-1">Active Agent Overlay</div>
                  <div className="text-gray-300"><span className="text-teal-400">{activeAgent.name}:</span> {activeAgent.instructions}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={creating}
                onClick={createSession}
                className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded px-3 py-1.5 text-sm font-medium">
                {creating ? 'Creating…' : 'Create / Reuse'}
              </button>
              <button
                disabled={!sessionId}
                onClick={() => loadTranscript()}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded px-3 py-1.5 text-sm">
                Refresh
              </button>
            </div>
            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-800 rounded p-2 whitespace-pre-wrap">
                {error}
              </div>
            )}
            <div className="text-[11px] text-gray-500">
              Tip: Ctrl+Enter to send. Transcript auto-refreshes every 4s when
              enabled.
            </div>
            {/* Moderation UI removed (will be implemented server-side later) */}
          </div>
          {/* (Legacy microphone panel removed – mic control lives only in Voice Chat panel) */}
        </div>

        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Realtime Panel */}
          <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-teal-400">
                Realtime Session
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border border-gray-700 ${
                    realtimeConnected
                      ? 'bg-teal-600/30 text-teal-300'
                      : realtime.status === 'CONNECTING'
                      ? 'bg-amber-600/30 text-amber-300'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                  {realtime.status}
                </span>
                {realtimeConnected ? (
                  <button
                    onClick={realtime.disconnect}
                    className="text-[11px] px-2 py-1 rounded bg-red-600/80 hover:bg-red-500">
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={realtime.connect}
                    className="text-[11px] px-2 py-1 rounded bg-teal-600 hover:bg-teal-500">
                    Connect
                  </button>
                )}
              </div>
            </div>
            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              className="hidden"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="flex flex-col gap-2">
                <RealtimeLogs logs={realtime.logs} />
              </div>
              <div className="flex flex-col gap-2">
                <RealtimeQuickSend
                  onSend={(t) => realtime.sendUserText(t)}
                  disabled={!realtimeConnected}
                />
                <div className="flex flex-col gap-3 p-2 border border-gray-800 rounded bg-gray-950/60">
                  <div className="flex items-center justify-between">
                    <button
                      onMouseDown={async () => {
                        if (!mic.enabled && !mic.enabling) await mic.start();
                        setPttActive(true);
                      }}
                      onMouseUp={() => setPttActive(false)}
                      onMouseLeave={() => setPttActive(false)}
                      onTouchStart={async () => {
                        if (!mic.enabled && !mic.enabling) await mic.start();
                        setPttActive(true);
                      }}
                      onTouchEnd={() => setPttActive(false)}
                      className={`flex-1 px-3 py-1.5 rounded text-[11px] font-medium border border-gray-700 ${
                        pttActive
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                      }`}>
                      {pttActive
                        ? 'Release to Stop'
                        : mic.enabled
                        ? 'Hold to Speak'
                        : 'Hold to Activate Mic'}
                    </button>
                    <div
                      className={`ml-2 text-[10px] px-2 py-1 rounded border border-gray-700 ${
                        pttActive
                          ? 'bg-teal-600/30 text-teal-300'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                      {pttActive ? 'LIVE' : mic.enabled ? 'READY' : 'IDLE'}
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-50"
                      style={{ width: `${Math.min(1, userLevel * 3) * 100}%` }}
                    />
                  </div>
                  {realtime.hearing && (
                    <div className="text-[10px] text-amber-400">
                      (audio leak detected)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-teal-400">Chat</h2>
              <button
                onClick={() => setShowLogs((v) => !v)}
                className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
                {showLogs ? 'Hide Raw' : `Raw Logs (${transcript.length})`}
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-gray-800 bg-gray-950 p-3 space-y-3 custom-scroll">
              {chatMessages.length === 0 && (
                <div className="text-gray-600 text-xs">No messages yet.</div>
              )}
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.kind === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                  <div
                    className={`group relative max-w-[75%] rounded-md px-3 py-2 text-sm leading-snug shadow-sm whitespace-pre-wrap break-words ${
                      m.kind === 'user'
                        ? 'bg-teal-600/80 text-white'
                        : m.kind === 'assistant'
                        ? 'bg-gray-800 text-gray-100'
                        : 'bg-indigo-800/40 text-indigo-100'
                    }`}
                    title={m.role}>
                    {/* Source badge */}
                    <span
                      className={`inline-block align-middle text-[9px] font-medium tracking-wide mr-2 px-1.5 py-0.5 rounded ${
                        m.source === 'realtime'
                          ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                          : 'bg-sky-600/30 text-sky-200 border border-sky-500/40'
                      }`}>
                      {m.source === 'realtime' ? 'RT' : 'SDK'}
                    </span>
                    {m.text ? (
                      m.text
                    ) : (
                      <span className="opacity-50 italic">
                        (no textual content)
                      </span>
                    )
                    }
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-4">
              <textarea
                className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={3}
                value={input}
                placeholder="Type a message... (Ctrl+Enter to send)"
                onKeyDown={onKeyDown}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="text-[11px] text-gray-500">
                  {loading
                    ? 'Sending…'
                    : output
                    ? 'Last response captured'
                    : 'Idle'}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={!sessionId || loading}
                    onClick={() => {
                      setInput('');
                      setOutput('');
                      setToolCalls([]);
                      setTranscript([]);
                    }}
                    className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
                    Clear Local
                  </button>
                  <button
                    disabled={!sessionId || loading}
                    onClick={sendMessage}
                    className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded px-4 py-1.5 text-sm font-medium">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </section>

          {output && (
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
                <div><span className="text-gray-400">Effective Instructions Preview:</span> {effectiveInstructions.slice(0,120)}{effectiveInstructions.length>120?'…':''}</div>
              </div>
            </section>
          )}
        </div>

        {showLogs && (
          <aside className="xl:col-span-1 bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col h-[520px]">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">
              Raw Events
            </h2>
            <div className="flex-1 overflow-auto text-[11px] space-y-3 bg-gray-950 border border-gray-800 rounded p-3">
              {transcript.map((it, i) => (
                <div
                  key={i}
                  className="border-b border-gray-800 pb-2 last:border-none">
                  <div className="text-teal-400 font-mono mb-1">
                    {it.type || it.role}
                  </div>
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(it, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
