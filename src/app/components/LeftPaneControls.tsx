"use client";
import React from "react";
import { SessionStatus } from "@/app/types";

interface LeftPaneControlsProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;

  isPTTActive: boolean;
  setIsPTTActive: (v: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;

  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (v: boolean) => void;

  codec: string;
  onCodecChange: (codec: string) => void;
}

/**
 * Polished compact toolbar that sits above the transcript.
 * - Sticky, blurred, and responsive
 * - Keeps the dashboard untouched
 */
export default function LeftPaneControls({
  sessionStatus,
  onToggleConnection,
  isPTTActive,
  setIsPTTActive,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  codec,
  onCodecChange,
}: LeftPaneControlsProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  return (
    <div className="sticky top-0 z-10">
      <div className="backdrop-blur bg-white/80 border rounded-xl px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onToggleConnection}
            disabled={isConnecting}
            className={`px-3 h-9 rounded-lg text-sm font-medium shadow-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isConnected
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700 focus:ring-red-300"
                : isConnecting
                ? "bg-gray-300 text-gray-700 border-gray-300 cursor-wait"
                : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 focus:ring-gray-300"
            }`}
            aria-pressed={isConnected}
          >
            {isConnected ? "Disconnect" : isConnecting ? "Connecting…" : "Connect"}
          </button>

          {/* PTT toggle + hold-to-talk */}
          <label className="inline-flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={isPTTActive}
              onChange={(e) => setIsPTTActive(e.target.checked)}
              disabled={!isConnected}
            />
            <span>Push to talk</span>
          </label>

          <button
            type="button"
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={!isConnected || !isPTTActive}
            aria-label="Hold to talk"
            className={`h-9 px-3 rounded-lg border text-sm transition-colors ${
              !isConnected || !isPTTActive
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : isPTTUserSpeaking
                ? "bg-gray-200"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {isPTTUserSpeaking ? "Release to send" : "Talk"}
          </button>

          {/* Audio playback */}
          <label className="inline-flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={isAudioPlaybackEnabled}
              onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
              disabled={!isConnected}
            />
            <span>Audio playback</span>
          </label>
        </div>
      </div>
    </div>
  );
}
