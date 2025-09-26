import React from 'react';

export interface ToolsPanelProps {
  sessionId: string;
  baseUrl: string;
  activeAgentName: string;
  allowedTools: string[];
  onError: (msg: string) => void;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  sessionId,
  baseUrl,
  activeAgentName,
  allowedTools,
  onError,
}) => {
  const [toolBusy, setToolBusy] = React.useState<string | null>(null);
  const [toolResult, setToolResult] = React.useState<any | null>(null);
  const [lastToolStatus, setLastToolStatus] = React.useState<{
    tool: string;
    ok: boolean;
    at: string;
  } | null>(null);

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-300">Tools</h3>
        <span className="text-[10px] text-gray-500">agent-scoped</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {allowedTools.length === 0 && (
          <span className="text-[11px] text-gray-500">No tools allowed</span>
        )}
        {allowedTools.map((tool) => (
          <button
            key={tool}
            disabled={!sessionId || toolBusy === tool}
            onClick={async () => {
              onError('');
              setToolResult(null);
              setToolBusy(tool);
              try {
                const r = await fetch(
                  `${baseUrl}/api/tools/execute?scenario_id=default&session_id=${encodeURIComponent(
                    sessionId
                  )}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      tool,
                      args: { agent: activeAgentName },
                    }),
                  }
                );
                const data = await r.json();
                const ok = r.ok;
                if (!ok) throw new Error(data?.error || 'tool failed');
                setToolResult(data);
                setLastToolStatus({
                  tool,
                  ok: true,
                  at: new Date().toISOString(),
                });
              } catch (e: any) {
                onError(e.message);
                setLastToolStatus({
                  tool,
                  ok: false,
                  at: new Date().toISOString(),
                });
              } finally {
                setToolBusy(null);
              }
            }}
            className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300 disabled:opacity-40">
            {tool}
          </button>
        ))}
      </div>
      {lastToolStatus && (
        <div
          className={`text-[11px] ${
            lastToolStatus.ok ? 'text-teal-300' : 'text-red-300'
          }`}>
          Last: {lastToolStatus.tool} — {lastToolStatus.ok ? 'ok' : 'error'} (
          {new Date(lastToolStatus.at).toLocaleTimeString()})
        </div>
      )}
      {toolResult && (
        <pre className="text-[11px] bg-gray-950 border border-gray-800 rounded p-2 overflow-auto max-h-40">
          {JSON.stringify(toolResult, null, 2)}
        </pre>
      )}
    </div>
  );
};
