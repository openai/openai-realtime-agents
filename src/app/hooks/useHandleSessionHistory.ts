"use client";

import { useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

export function useHandleSessionHistory() {
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  /* ----------------------- helpers ------------------------- */

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

  const extractFunctionCallByName = (name: string, content: any[] = []): any => {
    if (!Array.isArray(content)) return undefined;
    return content.find((c: any) => c.type === 'function_call' && c.name === name);
  };

  const maybeParseJson = (val: any) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        console.warn('Failed to parse JSON:', val);
        return val;
      }
    }
    return val;
  };

  /* ----------------------- event handlers ------------------------- */

  function handleAgentToolStart(details: any, _agent: any, functionCall: any) {
    const lastFunctionCall = extractFunctionCallByName(functionCall.name, details?.context?.history);
    const function_name = lastFunctionCall?.name;
    const function_args = lastFunctionCall?.arguments;

    addTranscriptBreadcrumb(
      `function call: ${function_name}`,
      function_args,
      lastFunctionCall?.itemId
    );    
  }
  function handleAgentToolEnd(details: any, _agent: any, _functionCall: any, result: any) {
    const lastFunctionCall = extractFunctionCallByName(_functionCall.name, details?.context?.history);
    addTranscriptBreadcrumb(
      `function call result: ${lastFunctionCall?.name}`,
      maybeParseJson(result),
      `${lastFunctionCall?.itemId}-result`
    );
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

    // Update the last assistant message in the transcript with FAIL state.
    const lastAssistant = [...transcriptItems]
      .reverse()
      .find((i) => i.role === 'assistant');

    if (lastAssistant && moderation) {
      const category = moderation.moderationCategory ?? 'NONE';
      const rationale = moderation.moderationRationale ?? '';
      const testText = moderation.testText ?? '';

      updateTranscriptItem(lastAssistant.itemId, {
        guardrailResult: {
          status: 'DONE',
          category,
          rationale,
          testText,
        },
      });
    }
  }

  function handleHistoryUpdated(items: any[]) {
    items.forEach((item: any) => {
      if (!item || item.type !== 'message') return;

      const { itemId, content = [] } = item;

      const text = extractMessageText(content);

      // Always update with latest text & status
      if (text) {
        updateTranscriptMessage(itemId, text, false);
      }
    });
  }
  
  function handleHistoryAdded(item: any) {
    if (!item || item.type !== 'message') return;

    const { itemId, role, content = [] } = item;


    if (itemId && role) {
      const isUser = role === "user";
      let text = extractMessageText(content);

      if (isUser && !text) {
        text = "[Transcribing...]";
      }

      addTranscriptMessage(itemId, role, text);
    }

    // If this is an assistant message, initialize guardrailResult as IN_PROGRESS.
    if (role === 'assistant') {
      updateTranscriptItem(itemId, {
        guardrailResult: {
          status: 'IN_PROGRESS',
        },
      });
    }
  }

  function handleTranscriptionCompleted(item: any) {
    const itemId = item.item_id;
    const finalTranscript =
        !item.transcript || item.transcript === "\n"
        ? "[inaudible]"
        : item.transcript;
    if (itemId) {
      updateTranscriptMessage(itemId, finalTranscript, false);
      if (item.role === 'user') {
        updateTranscriptItem(itemId, { status: "DONE" });
      } else {
        updateTranscriptItem(itemId, { guardrailResult: { status: "DONE", category: "NONE" } });
      }
    }

  }

  // Ref that always holds the latest handler functions.
  const handlersRef = useRef({
    handleAgentToolStart,
    handleAgentToolEnd,
    handleGuardrailTripped,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleTranscriptionCompleted,
  });

  // Ensure .current is kept up-to-date on every render.
  handlersRef.current = {
    handleAgentToolStart,
    handleAgentToolEnd,
    handleGuardrailTripped,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleTranscriptionCompleted,
  };

  return handlersRef;
}