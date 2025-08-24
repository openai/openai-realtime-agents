"use client";
import React from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export type TranscriptProps = {
  userText: string;
  setUserText: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: () => void;
  downloadRecording: () => Promise<void>;
  canSend: boolean;
};

/**
 * Transcript pane with avatar header + live message list.
 * - Greeting shows only when there are no messages yet
 * - Auto‑scrolls to latest message
 */
export default function Transcript({
  userText,
  setUserText,
  onSendMessage,
  downloadRecording,
  canSend,
}: TranscriptProps) {
  const tctx: any = useTranscript();

  // --- Normalize context → [{id, role, text}] ---
  const messages = React.useMemo(() => {
    const raw = (tctx?.messages ?? tctx?.transcript ?? tctx?.logs ?? tctx?.history ?? []) as any[];

    const pullText = (content: any): string => {
      if (!content) return "";
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        // OpenAI style: [{type:'output_text'|'input_text', text:string}, ...]
        return content
          .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
          .filter(Boolean)
          .join("");
      }
      if (typeof content === "object") {
        if (Array.isArray(content.content)) return pullText(content.content);
        if (content.text) return String(content.text);
      }
      return "";
    };

    const list = raw
      .map((m: any) => {
        const role = m?.role || m?.message?.role || (m?.isUser ? "user" : m?.speaker) || "assistant";
        const content = m?.content ?? m?.message?.content ?? m?.text ?? m?.message?.text;
        const text = pullText(content);
        return { id: m?.id || crypto.randomUUID(), role: role === "tool" ? "assistant" : role, text };
      })
      .filter((m) => typeof m.text === "string" && m.text.trim().length > 0);

    return list as { id: string; role: "user" | "assistant"; text: string }[];
  }, [tctx?.messages, tctx?.transcript, tctx?.logs, tctx?.history]);

  const hasMessages = messages.length > 0;

  // Auto‑scroll to bottom on new messages
  const listRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="bg-white border rounded-xl shadow-sm h-[calc(100vh-240px)] min-h-[520px] flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="px-4 py-2 text-xs text-gray-600 flex items-center gap-2 border-b bg-white">
        <span className={`inline-block h-2 w-2 rounded-full ${canSend ? "bg-green-500" : "bg-gray-400"}`} />
        {canSend ? "Online" : "Offline"}
      </div>

      {/* Avatar + Transcript */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Avatar */}
        <div className="py-5 flex items-center justify-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 border flex items-center justify-center shadow-sm text-3xl">
            🤝
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-auto px-4 pb-4" aria-live="polite">
          {hasMessages ? (
            <ul className="space-y-3">
              {messages.map((m) => (
                <li key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-5 whitespace-pre-wrap break-words border ${
                      m.role === "user"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-800 border-gray-200"
                    }`}
                  >
                    {m.text}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="max-w-[560px] mx-auto">
              <div className="rounded-2xl shadow-sm border bg-white p-4 text-sm leading-5 text-gray-800">
                Hi, I’m Prosper, your financial coach. We’ll do a quick intro, a few questions to get to know you, a
                financial snapshot, and then I’ll calculate your key indicators and suggest simple steps to improve.
                Ready to get started?
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-white/70 backdrop-blur px-3 py-3">
        <div className="flex items-center gap-3">
          <button
            className="h-9 px-4 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
            disabled={!canSend}
            onClick={onSendMessage}
          >
            Start
          </button>

          <button
            className="h-9 w-9 rounded-lg border text-gray-700 hover:bg-gray-50"
            title="Download latest audio reply"
            onClick={downloadRecording}
          >
            ⤓
          </button>

          <div className="relative flex-1 min-w-[200px]">
            <input
              className="h-10 w-full outline-none rounded-lg border pl-3 pr-12 text-sm"
              placeholder="Type to send…"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSendMessage();
              }}
              disabled={!canSend}
            />
            <button
              className="absolute right-1 top-1.5 h-7 px-3 rounded-md bg-gray-900 text-white text-xs disabled:opacity-50"
              onClick={onSendMessage}
              disabled={!canSend || !userText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
