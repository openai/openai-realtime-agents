"use client";

import React from "react";
import { SessionStatus } from "@/app/types";

type Props = {
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
  onCodecChange: (newCodec: string) => void;
};

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
}: Props) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  const connectLabel =
    isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect";

  return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-200/70">
      <div className="flex items-center gap-3 flex-wrap">

        <button
          onClick={onToggleConnection}
          disabled={isConnecting}
          className={`text-white text-sm px-3 py-2 rounded-md ${
            isConnected
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-900 hover:bg-gray-800"
          } ${isConnecting ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {connectLabel}
        </button>

        {/* Push-to-talk */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={isPTTActive}
            onChange={(e) => setIsPTTActive(e.target.checked)}
            disabled={!isConnected}
          />
          Push to talk
        </label>

        <button
          onMouseDown={handleTalkButtonDown}
          onMouseUp={handleTalkButtonUp}
          onTouchStart={handleTalkButtonDown}
          onTouchEnd={handleTalkButtonUp}
          disabled={!isPTTActive}
          className={`text-sm px-3 py-2 rounded-md border ${
            isPTTActive
              ? isPTTUserSpeaking
                ? "bg-gray-200"
                : "bg-white hover:bg-gray-50"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Talk
        </button>

        {/* Audio playback */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={isAudioPlaybackEnabled}
            onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
            disabled={!isConnected}
          />
          Audio playback
        </label>

        {/* Codec selector */}
        <div className="flex items-center gap-2 text-sm ml-auto">
          <span className="text-gray-600">Codec</span>
          <select
            value={codec}
            onChange={(e) => onCodecChange(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none cursor-pointer bg-white"
          >
            <option value="opus">Opus (48 kHz)</option>
            <option value="pcmu">PCMU (8 kHz)</option>
            <option value="pcma">PCMA (8 kHz)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
