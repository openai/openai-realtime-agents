import React from 'react';

export interface AgentDef {
  id: string;
  name: string;
  instructions: string;
}

export interface SessionConfigProps {
  sessionId: string;
  setSessionId: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  agents: AgentDef[];
  activeAgentId: string;
  setActiveAgentId: (id: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  effectiveInstructions: string;
  creating: boolean;
  createSession: () => void;
  loadTranscript: () => void;
  error: string | null;
  realtimeConnected: boolean;
}

export const SessionConfig: React.FC<SessionConfigProps> = ({
  sessionId,
  setSessionId,
  model,
  setModel,
  autoRefresh,
  setAutoRefresh,
  agents,
  activeAgentId,
  setActiveAgentId,
  instructions,
  setInstructions,
  effectiveInstructions,
  creating,
  createSession,
  loadTranscript,
  error,
  realtimeConnected,
}) => {
  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];
  return (
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
            <div className="font-semibold text-gray-300 mb-1">
              Active Agent Overlay
            </div>
            <div className="text-gray-300">
              <span className="text-teal-400">{activeAgent.name}:</span>{' '}
              {activeAgent.instructions}
            </div>
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
          onClick={loadTranscript}
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
    </div>
  );
};
