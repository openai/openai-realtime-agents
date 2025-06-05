"use client";

import { useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

export function useHandleSessionHistory() {
  const {
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  /**
   * Extract user or assistant text from a message `content` array.
   * Only two content types are currently supported:
   *  - `input_text`   -> use the `text` field
   *  - `audio`        -> use the `transcript` field
   * Returns all texts joined by a newline.
   */
  const extractMessageText = (content: any[] = []): string => {
    if (!Array.isArray(content)) return "";

    return content
      .map((c) => {
        if (!c || typeof c !== "object") return "";
        if (c.type === "input_text") return c.text ?? "";
        if (c.type === "audio") return c.transcript ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  };

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

  function handleHistoryUpdated(items: any[]) {
    // console.log("history_updated event", JSON.stringify(items));

    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
      if (!item || item.type !== 'message') return;

      const { itemId, content = [], status } = item;

      const text = extractMessageText(content);

      // Always update with latest text & status
      if (text) {
        updateTranscriptMessage(itemId, text, false);
      }

      if (status) {
        updateTranscriptItem(itemId, {
          status: status === 'completed' ? 'DONE' : 'IN_PROGRESS',
        });
      }
    });
  }
  
  function handleHistoryAdded(item: any) {
    if (!item || item.type !== 'message') return;

    const { itemId, role, content = [], status } = item;

    const text = extractMessageText(content);

    addTranscriptMessage(itemId, role ?? 'assistant', text, false);

    if (status) {
      updateTranscriptItem(itemId, {
        status: status === 'completed' ? 'DONE' : 'IN_PROGRESS',
      });
    }
  }

  function handleTranscriptionCompleted(item: any) {
    // console.log("transcription_completed event", JSON.stringify(item)); 

    const itemId = item.item_id;
    const finalTranscript =
        !item.transcript || item.transcript === "\n"
        ? "[inaudible]"
        : item.transcript;
    if (itemId) {
        updateTranscriptMessage(itemId, finalTranscript, false);
        updateTranscriptItem(itemId, { status: "DONE" });
    }
  }

  // Return a ref to all handler functions
  const handlersRef = useRef({
    handleAgentToolStart,
    handleAgentToolEnd,
    handleGuardrailTripped,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleTranscriptionCompleted,
  });

  return handlersRef;
}