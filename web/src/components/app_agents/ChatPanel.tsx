import React, { useEffect, useMemo, useRef } from 'react';
import {
  buildChatMessages,
  computeStreaming,
  ChatMessage,
} from '../../lib/chat';

export interface ChatPanelProps {
  events: any[];
  transcript: any[];
  realtimeLogs: any[];
  activeAgentName: string;
  loading: boolean;
  netWarn: string | null;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  events,
  transcript,
  realtimeLogs,
  activeAgentName,
  loading,
  netWarn,
  input,
  setInput,
  onSend,
}) => {
  const chatMessages: ChatMessage[] = useMemo(
    () => buildChatMessages(events, transcript, realtimeLogs),
    [events, transcript, realtimeLogs]
  );
  const streaming = useMemo(() => computeStreaming(events), [events]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  return (
    <section className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 flex flex-col h-[520px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-teal-400">Chat</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-700/40 border border-teal-600 text-teal-200 uppercase tracking-wide">
            {activeAgentName}
          </span>
          {streaming && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-700/30 border border-amber-600 text-amber-200 uppercase tracking-wide">
              Streaming
            </span>
          )}
        </div>
      </div>
      {netWarn && <div className="text-[11px] text-amber-300">{netWarn}</div>}
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
              <span
                className={`inline-block align-middle text-[9px] font-medium tracking-wide mr-2 px-1.5 py-0.5 rounded ${
                  m.source === 'realtime'
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                    : 'bg-sky-600/30 text-sky-200 border border-sky-500/40'
                }`}>
                {m.source === 'realtime' ? 'RT' : 'SDK'}
              </span>
              {m.text ? (
                <>{m.text}</>
              ) : (
                <span className="opacity-50 italic">(no textual content)</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[60%] rounded-md px-3 py-2 text-sm bg-gray-800/70 text-gray-300 italic">
              …
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="mt-4">
        <textarea
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
          rows={3}
          value={input}
          placeholder="Type a message... (Ctrl+Enter to send)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !loading)
              onSend();
          }}
        />
        <div className="flex justify-between items-center mt-2">
          <div className="text-[11px] text-gray-500">
            {loading ? 'Sending…' : 'Idle'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setInput('')}
              className="text-[11px] px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 text-gray-300">
              Clear
            </button>
            <button
              onClick={() => {
                if (!loading) onSend();
              }}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-500 rounded px-4 py-1.5 text-sm font-medium">
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
