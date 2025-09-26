import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMicrophoneOptions {
  smoothing?: number; // analyser smoothingTimeConstant
  fftSize?: number; // analyser fftSize
  vadThreshold?: number; // 0..1 normalized energy threshold
  maxLevelDecayMs?: number; // how fast the displayed level decays
  frameSize?: number; // emitted frame size at target sample rate (samples)
  targetSampleRate?: number; // resample output rate (Hz)
  onAudioFrame?: (pcm: Float32Array) => void; // callback for raw PCM frames (Float32 normalized -1..1)
}

export interface UseMicrophoneResult {
  enabled: boolean;
  enabling: boolean;
  error: string | null;
  level: number; // 0..1 instantaneous (smoothed)
  peakLevel: number; // 0..1 peak that decays
  vadActive: boolean; // simplistic VAD flag
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Very lightweight mic capture + energy meter + naive VAD.
export function useMicrophone(
  options: UseMicrophoneOptions = {}
): UseMicrophoneResult {
  const {
    smoothing = 0.8,
    fftSize = 2048,
    vadThreshold = 0.12,
    maxLevelDecayMs = 350,
    frameSize = 1600, // 100ms @16k
    targetSampleRate = 16000,
    onAudioFrame,
  } = options;
  const [enabled, setEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [vadActive, setVadActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  // Keep a ref so cleanup doesn't rely on state (avoids effect dependency churn)
  const streamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastPeakRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const resampleBufRef = useRef<number[]>([]);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
    }
    audioCtxRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current.onaudioprocess = null;
    }
    processorRef.current = null;
    resampleBufRef.current = [];
    streamRef.current = null;
    setStream(null);
    setEnabled(false);
    setVadActive(false);
    setLevel(0);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.fftSize;
    const data = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(data);

    // Compute RMS energy
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (data[i] - 128) / 128; // -1..1
      sum += v * v;
    }
    const rms = Math.sqrt(sum / bufferLength); // 0..1

    // Simple smoothing & peak
    setLevel(rms);
    const now = performance.now();
    if (rms > peakLevel) {
      setPeakLevel(rms);
      lastPeakRef.current = now;
    } else if (peakLevel > 0) {
      const elapsed = now - lastPeakRef.current;
      const decay = Math.max(0, 1 - elapsed / maxLevelDecayMs);
      setPeakLevel((prev) => Math.max(rms, prev * decay));
    }

    setVadActive(rms >= vadThreshold);
    rafRef.current = requestAnimationFrame(tick);
  }, [peakLevel, vadThreshold, maxLevelDecayMs]);

  const start = useCallback(async () => {
    if (enabled || enabling) return;
    setEnabling(true);
    setError(null);
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(userStream);
      const analyser = ctx.createAnalyser();
      analyser.smoothingTimeConstant = smoothing;
      analyser.fftSize = fftSize;
      source.connect(analyser);
      if (onAudioFrame) {
        // ScriptProcessorNode is deprecated but simpler for quick prototyping; swap to AudioWorklet for production.
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        const inputRate = ctx.sampleRate; // often 48000
        const ratio = inputRate / targetSampleRate;
        proc.onaudioprocess = (ev) => {
          if (!onAudioFrame) return;
          const input = ev.inputBuffer.getChannelData(0);
          // Naive downsample (drop samples). Acceptable for placeholder; apply low-pass filter for quality if needed.
          for (let i = 0; i < input.length; i += ratio) {
            resampleBufRef.current.push(input[Math.floor(i)] || 0);
            if (resampleBufRef.current.length >= frameSize) {
              const frame = new Float32Array(
                resampleBufRef.current.slice(0, frameSize)
              );
              resampleBufRef.current = resampleBufRef.current.slice(frameSize);
              try {
                onAudioFrame(frame);
              } catch {
                /* ignore */
              }
            }
          }
        };
        source.connect(proc);
        // Some browsers require connection to destination; low volume side-effect.
        try {
          proc.connect(ctx.destination);
        } catch {
          /* ignore */
        }
        processorRef.current = proc;
      }
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      streamRef.current = userStream;
      setStream(userStream); // state for UI only
      setEnabled(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setError(e?.message || 'Microphone access denied');
      cleanup();
    } finally {
      setEnabling(false);
    }
  }, [enabled, enabling, smoothing, fftSize, tick, cleanup]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Unmount cleanup only
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    enabled,
    enabling,
    error,
    level,
    peakLevel,
    vadActive,
    stream,
    start,
    stop,
  };
}

export default useMicrophone;
