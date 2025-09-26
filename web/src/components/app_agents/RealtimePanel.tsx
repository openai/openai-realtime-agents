import React, { useEffect, useRef, useState } from 'react';

export interface RealtimePanelProps {
  status: string;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  logs: any[];
  hearing: boolean;
  userLevel: number;
  onSendText: (t: string) => void;
  onMicStart: () => Promise<void>;
  onMicStop: () => void;
  micEnabled: boolean;
}

export const RealtimePanel: React.FC<RealtimePanelProps> = ({
  status,
  connected,
  connect,
  disconnect,
  logs,
  hearing,
  userLevel,
  onSendText,
  onMicStart,
  onMicStop,
  micEnabled,
}) => {
  const [pttActive, setPttActive] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-teal-400">
          Realtime Session
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded border border-gray-700 ${
              connected
                ? 'bg-teal-600/30 text-teal-300'
                : status === 'CONNECTING'
                ? 'bg-amber-600/30 text-amber-300'
                : 'bg-gray-800 text-gray-500'
            }`}>
            {status}
          </span>
          {connected ? (
            <button
              onClick={disconnect}
              className="text-[11px] px-2 py-1 rounded bg-red-600/80 hover:bg-red-500">
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              className="text-[11px] px-2 py-1 rounded bg-teal-600 hover:bg-teal-500">
              Connect
            </button>
          )}
        </div>
      </div>
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            'rtText'
          ) as HTMLInputElement;
          const value = input.value.trim();
          if (value) onSendText(value);
          input.value = '';
        }}
        className="flex flex-col gap-2 mt-2">
        <input
          name="rtText"
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="Send realtime text"
        />
        <button className="text-[11px] px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 self-start">
          Send Text
        </button>
      </form>
      <div className="flex flex-col gap-3 p-2 border border-gray-800 rounded bg-gray-950/60 mt-2">
        <div className="flex items-center justify-between">
          <button
            onMouseDown={async () => {
              if (!micEnabled) await onMicStart();
              setPttActive(true);
            }}
            onMouseUp={() => {
              setPttActive(false);
              onMicStop();
            }}
            onMouseLeave={() => {
              setPttActive(false);
              onMicStop();
            }}
            onTouchStart={async () => {
              if (!micEnabled) await onMicStart();
              setPttActive(true);
            }}
            onTouchEnd={() => {
              setPttActive(false);
              onMicStop();
            }}
            className={`flex-1 px-3 py-1.5 rounded text-[11px] font-medium border border-gray-700 ${
              pttActive
                ? 'bg-teal-600 text-white'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
            }`}>
            {pttActive
              ? 'Release to Stop'
              : micEnabled
              ? 'Hold to Speak'
              : 'Hold to Activate Mic'}
          </button>
          <div
            className={`ml-2 text-[10px] px-2 py-1 rounded border border-gray-700 ${
              pttActive
                ? 'bg-teal-600/30 text-teal-300'
                : 'bg-gray-800 text-gray-500'
            }`}>
            {pttActive ? 'LIVE' : micEnabled ? 'READY' : 'IDLE'}
          </div>
        </div>
        <div className="h-2 w-full bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-50"
            style={{ width: `${Math.min(1, userLevel * 3) * 100}%` }}
          />
        </div>
        {hearing && (
          <div className="text-[10px] text-amber-400">
            (audio leak detected)
          </div>
        )}
      </div>
    </section>
  );
};
