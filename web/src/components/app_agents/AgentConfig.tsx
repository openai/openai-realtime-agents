import React from 'react';

export interface AgentDef {
  id: string;
  name: string;
  instructions: string;
}

export interface AgentConfigProps {
  agents: AgentDef[];
  activeAgentId: string;
  setActiveAgentId: (id: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  effectiveInstructions: string;
  realtimeConnected: boolean;
  title?: string;
}

export const AgentConfig: React.FC<AgentConfigProps> = ({
  agents,
  activeAgentId,
  setActiveAgentId,
  instructions,
  setInstructions,
  effectiveInstructions,
  realtimeConnected,
  title = 'Agent',
}) => {
  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];
  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-teal-300">{title}</h2>
        {realtimeConnected && (
          <span className="ml-2 text-[10px] text-amber-400">
            Reconnect voice after switching
          </span>
        )}
      </div>
      <div>
        <label className="text-xs uppercase text-gray-400">Agent</label>
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
          <span className="text-[10px] text-gray-500">Overlay shown below</span>
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
    </section>
  );
};
