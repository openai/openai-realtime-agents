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
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
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
  >('DISCONNECTED');
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

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      } 
    }
  }

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  };

  useEffect(() => {
    if (sessionRef.current) {
      // server events
      sessionRef.current.on("error", serverEventHandlers.handleError);
      sessionRef.current.on("audio_interrupted", serverEventHandlers.handleAudioInterrupted);      
      sessionRef.current.on("audio_start", serverEventHandlers.handleAudioStart);
      sessionRef.current.on("audio_stopped", serverEventHandlers.handleAudioStopped);
      sessionRef.current.on("guardrail_tripped", serverEventHandlers.handleGuardrailTripped);

      // history events
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);

      // additional transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
    }
  }, [sessionRef.current, serverEventHandlers]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

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
        model: 'gpt-4o-realtime-preview-2024-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
        },
        outputGuardrails: [guardrailWithCtx as any],
        context: extraContext ?? {},
      });

      await sessionRef.current.connect({ apiKey: ek });
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
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
