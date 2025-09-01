"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

/**
 * Hook to manage microphone (audioinput) devices.
 * - Requests microphone permission once to reveal human-readable device labels.
 * - Enumerates available audioinput devices and listens to devicechange events.
 * - Maintains the currently selected deviceId in component state (no persistence).
 */
export default function useAudioDevices() {
  const [microphones, setMicrophones] = useState<AudioInputDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const initializedRef = useRef(false);

  const enumerateAudioInputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([]);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || "Microphone",
        }));

      setMicrophones(audioInputs);
      // If the selected device no longer exists, fall back to first available
      if (!audioInputs.some((d) => d.deviceId === selectedMicId)) {
        setSelectedMicId(audioInputs[0]?.deviceId ?? "");
      }
    } catch (err: any) {
      console.warn("Failed to enumerate devices:", err);
      setMicrophones([]);
      if (selectedMicId !== "") setSelectedMicId("");
    }
  }, [selectedMicId]);

  const requestPermissionAndList = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      await enumerateAudioInputs();
      return;
    }
    try {
      // Request minimal audio access to reveal device labels.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop tracks to avoid holding the mic unnecessarily.
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      // Even if denied, we still attempt to enumerate (labels will likely be empty).
      console.warn("Microphone permission denied or failed:", err);
    } finally {
      await enumerateAudioInputs();
    }
  }, [enumerateAudioInputs]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Try to request permission once on mount to populate labels.
    requestPermissionAndList();

    // Listen for hardware changes (plug/unplug).
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.addEventListener) {
      const handler = () => enumerateAudioInputs();
      navigator.mediaDevices.addEventListener("devicechange", handler);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", handler);
      };
    }
  }, [requestPermissionAndList, enumerateAudioInputs]);

  return {
    microphones,
    selectedMicId,
    setSelectedMicId,
  } as const;
}
