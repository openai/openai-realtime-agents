import { useCallback, useRef, useState } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';
import { moderationGuardrail } from '@/app/agentConfigs/guardrails';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (
    status: 'connected' | 'connecting' | 'disconnected',
  ) => void;
  onMessage?: (ev: any) => void;
  onHistoryAdded?: (item: any) => void;
  onHistoryUpdated?: (history: any[]) => void;
  onAudioInterrupted?: () => void;
  onGuardrailTripped?: (info: any) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  const updateStatus = useCallback(
    (s: 'connected' | 'connecting' | 'disconnected') => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
    },
    [callbacks],
  );

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('connecting');

      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];

      const transportValue: any = audioElement
        ? new OpenAIRealtimeWebRTC({ audioElement })
        : 'webrtc';

      // Match audio format according to ?codec query param so
      // server & browser agree on format.
      let audioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw' = 'pcm16';
      if (typeof window !== 'undefined') {
        const codec =
          (new URLSearchParams(window.location.search).get('codec') ?? 'opus').toLowerCase();
        if (codec === 'pcmu') audioFormat = 'g711_ulaw';
        else if (codec === 'pcma') audioFormat = 'g711_alaw';
      }

      const guardrailWithCtx = {
        name: moderationGuardrail.name,
        execute: ({ agentOutput }: { agentOutput: string }) =>
          moderationGuardrail.execute({
            agentOutput,
            companyName: extraContext?.companyName ?? 'newTelco',
          }),
      };

      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: transportValue,
        model: 'gpt-4o-mini-realtime-preview-2024-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' },
        },
        outputGuardrails: [guardrailWithCtx as any],
        context: extraContext ?? {},
      });

      const session = sessionRef.current;
      const transport: any = session.transport;

      // Forward every low-level server event so transcript updates.
      transport.on('*', (ev: any) => {
        callbacks.onMessage?.(ev);
      });

      transport.on('connection_change', (s: any) => {
        if (s === 'disconnected') updateStatus('disconnected');
      });

      // Track granular additions so UI can mimic history_added behavior.
      const seen = new Set<string>();
      session.on('history_updated', (history: any[]) => {
        history.forEach((item: any) => {
          const key = `${item.itemId}:${item.status}`;
          if (!seen.has(key)) {
            seen.add(key);
            callbacks.onHistoryAdded?.(item);
          }
        });
        callbacks.onHistoryUpdated?.(history);
      });

      // Explicitly surface guardrail trips with deep moderation extraction.
      const extractModeration = (obj: any): any | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;
        if ('moderationCategory' in obj) return obj;
        if ('outputInfo' in obj) return extractModeration(obj.outputInfo);
        if ('output' in obj) return extractModeration(obj.output);
        if ('result' in obj) return extractModeration(obj.result);
        return undefined;
      };

      session.on('guardrail_tripped', (...args: any[]) => {
        let moderation: any | undefined;
        for (const a of args) {
          moderation = extractModeration(a);
          if (moderation) break;
        }
        const payload = moderation ?? args[0];

        callbacks.onGuardrailTripped?.(payload);
      });

      session.on('audio_interrupted', () => {
        callbacks.onAudioInterrupted?.();
      });

      await session.connect({ apiKey: ek });
      updateStatus('connected');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  const assertConnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */
  const sendUserText = useCallback((text: string) => {
    assertConnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const interrupt = useCallback(() => {
    sessionRef.current?.transport.interrupt();
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
    pushToTalkStart,
    pushToTalkStop,
  } as const;
}
