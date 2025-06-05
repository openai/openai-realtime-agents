import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';
import { moderationGuardrail } from '@/app/agentConfigs/guardrails';
import { useEvent } from '../contexts/EventContext';
import { useHandleServerEvent } from './useHandleServerEvent';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';
export interface RealtimeSessionCallbacks {
  onConnectionChange?: (
    status: SessionStatus,
  ) => void;
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
    SessionStatus
  >('disconnected');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const serverEventHandlers = useHandleServerEvent({
    setSessionStatus: updateStatus,
    sendClientEvent: logClientEvent,
  }).current;

  const historyHandlers = useHandleSessionHistory().current;

  useEffect(() => {
    if (sessionRef.current) {
      // server events
      sessionRef.current.on("error", serverEventHandlers.handleError);
      sessionRef.current.on("audio_interrupted", serverEventHandlers.handleAudioInterrupted);
      sessionRef.current.on("transport_event", serverEventHandlers.handleTransportEvent);
      sessionRef.current.on("audio_start", serverEventHandlers.handleAudioStart);
      sessionRef.current.on("audio_stopped", serverEventHandlers.handleAudioStopped);

      sessionRef.current.on("agent_handoff", historyHandlers.handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);
    }
  }, [serverEventHandlers]);

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

      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('connected');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */
  const sendUserText = useCallback((text: string) => {
    assertconnected();
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
