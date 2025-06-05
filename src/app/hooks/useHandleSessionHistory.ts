"use client";

import { useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

export function useHandleSessionHistory() {
  const { 
    addTranscriptBreadcrumb, 
    addTranscriptMessage, 
    updateTranscriptMessage, 
    updateTranscriptItem 
} = useTranscript();

  const { logServerEvent } = useEvent();

  function handleAgentHandoff(...args: any[]) {
    console.log("agent_handoff event", ...args);
    // addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
  }
  function handleAgentToolStart(...args: any[]) {
    console.log("agent_tool_start event", ...args);
  }
  function handleAgentToolEnd(...args: any[]) {
    console.log("agent_tool_end event", ...args);
  }
  function handleGuardrailTripped(...args: any[]) {
    console.log("guardrail_tripped event", ...args);
    // Explicitly surface guardrail trips with deep moderation extraction.
    const extractModeration = (obj: any): any | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    if ('moderationCategory' in obj) return obj;
    if ('outputInfo' in obj) return extractModeration(obj.outputInfo);
    if ('output' in obj) return extractModeration(obj.output);
    if ('result' in obj) return extractModeration(obj.result);
    return undefined;
    };

    let moderation: any | undefined;
    for (const a of args) {
        moderation = extractModeration(a);
        if (moderation) break;
    }
    const payload = moderation ?? args[0];
    logServerEvent({ type: 'guardrail_tripped', payload });
    // callbacks.onGuardrailTripped?.(payload);
  }
  function handleHistoryUpdated(...args: any[]) {
    console.log("history_updated event", ...args);
  }
  function handleHistoryAdded(...args: any[]) {
    console.log("history_added event", ...args);
  }
  function handleToolApprovalRequested(...args: any[]) {
    console.log("tool_approval_requested event", ...args);
  }

  // Return a ref to all handler functions
  const handlersRef = useRef({
    handleAgentHandoff,
    handleAgentToolStart,
    handleAgentToolEnd,
    handleGuardrailTripped,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleToolApprovalRequested,
  });

  return handlersRef;
}