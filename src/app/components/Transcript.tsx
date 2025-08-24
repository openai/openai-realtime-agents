"use client";

import React from "react";

export type TranscriptProps = {
  userText: string;
  setUserText: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: () => void;
  downloadRecording: () => Promise<void>;
  canSend: boolean;
};

// Zoom-style left pane with optional inline chat overlay.
// Keeps props minimal to match App.tsx usage.
export default function Transcript({
  userText,
  setUserText,
  onSendMessage,
  downloadRecording,
  canSend,
}: TranscriptProps) {
  const [mode, setMode] = React.useState<"idle" | "chat">("idle");

  return (
    <div className="w-1/2 min-w-[520px] relative rounded-xl bg-white border overflow-hidden">
      {/* Status dot */}
      <div className="absolute top-3 left-3 text-xs text-gray-500 flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            canSend ? "bg-green-500" : "bg-gray-400"
          }`}
        />
        {canSend ? "Online" : "Offline"}
      </div>

      {/* Prosper avatar placeholder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-40 w-40 rounded-full bg-gray-100 border flex items-center justify-center shadow-sm">
          <span className="text-3xl">🤝</span>
        </div>
      </div>

      {/* Prosper greeting bubble */}
      <div className="absolute left-5 bottom-24 max-w-[540px]">
        <div className="rounded-2xl shadow-sm border bg-white p-4 text-sm leading-5 text-gray-800">
          Hi, I’m Prosper, your financial coach. We’ll do a quick intro, a few questions
          to get to know you, a financial snapshot, and then I’ll calculate your key
          indicators and suggest simple steps to improve. Ready to get started?
        </div>
      </div>

      {/* Mini controls row (start / mic / chat / transcript) */}
      <div className="absolute left-4 bottom-4 flex items-center gap-3">
        <button
          className="h-9 px-4 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
          disabled={!canSend}
          onClick={() => setMode("chat")}
        >
          Start
        </button>

        <button
          className="h-9 w-9 rounded-lg border text-gray-700"
          title="Download latest audio reply"
          onClick={downloadRecording}
        >
          ⤓
        </button>

        <button
          className="h-9 px-3 rounded-lg border text-gray-700"
          onClick={() => setMode("chat")}
        >
          Chat
        </button>

        <button
          className="h-9 px-3 rounded-lg border text-gray-700"
          onClick={() => alert("Transcript panel TBD")}
        >
          Transcript
        </button>
      </div>

      {/* Chat overlay */}
      {mode === "chat" && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm font-medium text-gray-900">Chat with Prosper</div>
            <button
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMode("idle")}
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="text-sm text-gray-500">Say hi to get started…</div>
          </div>

          <div className="border-t p-3 flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              placeholder="Type a message…"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              disabled={!canSend}
            />
            <button
              className="h-9 px-4 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
              onClick={onSendMessage}
              disabled={!canSend || !userText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}