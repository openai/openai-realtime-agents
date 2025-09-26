import React from 'react';

export const RawEventsPanel: React.FC<{ transcript: any[] }> = ({
  transcript,
}) => {
  return (
    <aside className="xl:col-span-1 bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col h-[520px]">
      <h2 className="text-sm font-semibold text-gray-400 mb-2">Raw Events</h2>
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
  );
};
