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

  function handleGuardrailTripped(details: any, _agent: any, guardrail: any) {
    const moderation = extractModeration(guardrail.result.output.outputInfo);
    logServerEvent({ type: 'guardrail_tripped', payload: moderation });

    // find the last assistant message in details.context.history
    const lastAssistant = extractLastAssistantMessage(details?.context?.history);
    console.log("lastAssistant", lastAssistant);
    console.log("moderation", moderation);

    if (lastAssistant && moderation) {
      const category = moderation.moderationCategory ?? 'NONE';
      const rationale = moderation.moderationRationale ?? '';

      // Update the last assistant message in the transcript with FAIL state.
      updateTranscriptItem(lastAssistant.itemId, {
        guardrailResult: {
          status: 'DONE',
          category,
          rationale,
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

  function handleTranscriptionDelta(item: any) {
    const itemId = item.item_id;
    const deltaText = item.delta || "";
    if (itemId) {
      updateTranscriptMessage(itemId, deltaText, true);
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
    handleTranscriptionDelta,
    handleTranscriptionCompleted,
  });

  return handlersRef;
}