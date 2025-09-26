import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

type Log = {
  id: string;
  kind: 'event' | 'text';
  type: string;
  time: string;
  role?: 'user' | 'assistant';
  content?: string;
};

export interface UseRealtimeOptions {
  forceEnglish?: boolean;
  /**
   * Suppress the WebRTC transport from implicitly grabbing the user's microphone.
   * We want full manual control via our own `useMicrophone` + push‑to‑talk pipeline
   * so the assistant can't hear the user until they explicitly enable & PTT.
   */
  disableAutoMic?: boolean;
}

export function useRealtime(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  opts: UseRealtimeOptions = {}
) {
  const { forceEnglish = true, disableAutoMic = true } = opts;
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [logs, setLogs] = useState<Log[]>([]);
  const [hearing, setHearing] = useState(false); // whether model is currently receiving user audio (we proxy so should stay false unless leak)
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const addLog = useCallback((l: Omit<Log, 'time' | 'id'>) => {
    setLogs((prev) => [
      ...prev,
      {
        ...l,
        id: Math.random().toString(36).slice(2),
        time: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const getEphemeralKey = useCallback(async (): Promise<string> => {
    const r = await fetch('/api/session');
    const j = await r.json();
    if (!j?.client_secret?.value) throw new Error('No ephemeral key');
    return j.client_secret.value;
  }, []);

  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    setStatus('CONNECTING');

    const ek = await getEphemeralKey();

    const rootAgent = new RealtimeAgent({
      name: 'chatAgent',
      instructions: forceEnglish
        ? 'You are a helpful assistant. Always respond in English regardless of the input language.'
        : "You are a helpful assistant. You may respond in the user's language.",
      voice: 'verse',
    });

    const transport = new OpenAIRealtimeWebRTC({
      audioElement: audioRef.current ?? undefined,
    });

    const s = new RealtimeSession(rootAgent, {
      transport,
      model: 'gpt-4o-realtime-preview-2025-06-03',
      config: {
        inputAudioTranscription: forceEnglish
          ? { model: 'gpt-4o-mini-transcribe', language: 'en' }
          : { model: 'gpt-4o-mini-transcribe' },
      },
      context: {},
    });

    s.on('history_added', (item: any) => {
      if (item?.type === 'message') {
        const textParts = (item.content || [])
          .map((c: any) => (c?.type === 'input_text' ? c.text : c?.transcript))
          .filter(Boolean)
          .join('\n');
        if (textParts)
          addLog({
            kind: 'text',
            type: 'message',
            role: item.role,
            content: textParts,
          });
      }
    });

    s.on('transport_event', (e: any) =>
      addLog({ kind: 'event', type: e.type })
    );
    s.on('error', (e: any) =>
      addLog({ kind: 'event', type: 'error:' + String(e) })
    );

    await s.connect({ apiKey: ek });

    // Optionally suppress the automatically captured local mic tracks that the
    // realtime transport/library may have added when establishing the peer connection.
    const pc: RTCPeerConnection | undefined = (transport as any)?._conn;
    pcRef.current = pc || null;
    if (disableAutoMic && pc) {
      const scrub = () => {
        try {
          pc.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'audio') {
              sender.track.enabled = false;
              if (sender.track.readyState !== 'ended') {
                try {
                  sender.track.stop();
                } catch {}
              }
            }
          });
        } catch (e) {
          addLog({ kind: 'event', type: 'auto_mic_scrub_error:' + String(e) });
        }
      };
      scrub();
      addLog({ kind: 'event', type: 'auto_mic_suppressed' });
      // Monitor new senders (negotiationneeded or track events not always fired reliably here, poll lightly)
      let cancel = false;
      const poll = () => {
        if (cancel) return;
        scrub();
        // If any enabled audio track slips through mark hearing true
        let leaking = false;
        try {
          pc.getSenders().forEach((s) => {
            if (s.track && s.track.kind === 'audio' && s.track.enabled)
              leaking = true;
          });
        } catch {}
        setHearing(leaking);
        setTimeout(poll, 1200);
      };
      poll();
      (s as any)._cancelMicPoll = () => {
        cancel = true;
      };
    }
    sessionRef.current = s;
    setStatus('CONNECTED');
  }, [audioRef, forceEnglish]);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    if ((sessionRef.current as any)?._cancelMicPoll) {
      try {
        (sessionRef.current as any)._cancelMicPoll();
      } catch {}
    }
    setStatus('DISCONNECTED');
    setHearing(false);
  }, []);

  const sendUserText = useCallback((text: string) => {
    if (!sessionRef.current) return;
    sessionRef.current.sendMessage(text);
    addLog({ kind: 'text', type: 'message', role: 'user', content: text });
  }, []);

  const sendAudioFrame = useCallback((float32: Float32Array) => {
    const s = sessionRef.current as any;
    if (!s) return;
    // Convert to 16-bit PCM little endian then base64
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const v = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    try {
      if (typeof s.appendInputAudio === 'function') {
        s.appendInputAudio(b64); // hypothetical API in current SDK
      } else if (s.transport?._conn?.send) {
        // Fallback: manual event shape
        s.transport._conn.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 })
        );
      }
    } catch (e) {
      addLog({ kind: 'event', type: 'audio_error:' + String(e) });
    }
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendAudioFrame,
    logs,
    hearing, // should remain false with manual gating design
  } as const;
}
