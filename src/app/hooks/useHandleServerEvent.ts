"use client";

import { useRef } from "react";
import { SessionStatus } from "@/app/types";
import { useEvent } from "@/app/contexts/EventContext";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export interface UseHandleSessionEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
}

export function useHandleServerEvent({}: UseHandleSessionEventParams) {
  const { logServerEvent } = useEvent();
  const { updateTranscriptItem } = useTranscript();

  /* ----------------------- helpers ------------------------- */
  
  const extractLastAssistantMessage = (history: any[] = []): any => {
    if (!Array.isArray(history)) return undefined;
    return history.reverse().find((c: any) => c.type === 'message' && c.role === 'assistant');
  };

  const extractModeration = (obj: any) => {
    if ('moderationCategory' in obj) return obj;
    if ('outputInfo' in obj) return extractModeration(obj.outputInfo);
    if ('output' in obj) return extractModeration(obj.output);
    if ('result' in obj) return extractModeration(obj.result);
  };

  /* ----------------------- event handlers ------------------------- */

  function handleError(...args: any[]) {
    console.log("[session error]", ...args);
    logServerEvent({
      type: "error",
      message: args[0],
    });
  }
  function handleAudioInterrupted(...args: any[]) {
    logServerEvent({
      type: "audio_interrupted",
      message: args[0],
    });
  } 
  function handleAudioStart(...args: any[]) {
    logServerEvent({
      type: "audio_start",
      message: args[0],
    });
  }
  function handleAudioStopped(...args: any[]) {
    logServerEvent({
      type: "audio_stopped",
      message: args[0],
    });
  }

  function handleGuardrailTripped(details: any, _agent: any, guardrail: any) {
    console.log("[guardrail tripped]", details, _agent, guardrail);
    const moderation = extractModeration(guardrail.result.output.outputInfo);
    logServerEvent({ type: 'guardrail_tripped', payload: moderation });

    // find the last assistant message in details.context.history
    const lastAssistant = extractLastAssistantMessage(details?.context?.history);

    if (lastAssistant && moderation) {
      const category = moderation.moderationCategory ?? 'NONE';
      const rationale = moderation.moderationRationale ?? '';
      const offendingText: string | undefined = moderation?.testText;

      updateTranscriptItem(lastAssistant.itemId, {
        guardrailResult: {
          status: 'DONE',
          category,
          rationale,
          testText: offendingText,
        },
      });
    }
  }

  // Return a ref to all handler functions
  const handlersRef = useRef({
    handleError,
    handleAudioInterrupted,
    handleAudioStart,
    handleAudioStopped,
    handleGuardrailTripped,
  });

  return handlersRef;
}
