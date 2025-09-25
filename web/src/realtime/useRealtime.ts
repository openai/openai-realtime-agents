import { useCallback, useMemo, useRef, useState } from 'react';
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

export function useRealtime(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [logs, setLogs] = useState<Log[]>([]);

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
      instructions: 'You are a helpful assistant.',
      voice: 'verse',
    });

    const transport = new OpenAIRealtimeWebRTC({
      audioElement: audioRef.current ?? undefined,
    });

    const s = new RealtimeSession(rootAgent, {
      transport,
      model: 'gpt-4o-realtime-preview-2025-06-03',
      config: {
        inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' },
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
    sessionRef.current = s;
    setStatus('CONNECTED');
  }, [audioRef]);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setStatus('DISCONNECTED');
  }, []);

  const sendUserText = useCallback((text: string) => {
    if (!sessionRef.current) return;
    sessionRef.current.sendMessage(text);
    addLog({ kind: 'text', type: 'message', role: 'user', content: text });
  }, []);

  return { status, connect, disconnect, sendUserText, logs } as const;
}
