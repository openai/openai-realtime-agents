"use client";

import { useRef, useEffect } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export function useHandleSessionHistory() {
  // Ref to track if user messages should be blocked after a guardrail trip
  const userBlockedAfterGuardrailRef = useRef(false);
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
  } = useTranscript();

  // Add a ref to always have the latest transcriptItems
  const transcriptItemsRef = useRef(transcriptItems);
  useEffect(() => {
    transcriptItemsRef.current = transcriptItems;
  }, [transcriptItems]);

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
      function_args
    );    
  }
  function handleAgentToolEnd(details: any, _agent: any, _functionCall: any, result: any) {
    const lastFunctionCall = extractFunctionCallByName(_functionCall.name, details?.context?.history);
    addTranscriptBreadcrumb(
      `function call result: ${lastFunctionCall?.name}`,
      maybeParseJson(result)
    );
  }

  function handleHistoryAdded(item: any) {
    if (!item || item.type !== 'message') return;

    const { itemId, role, content = [] } = item;
    if (itemId && role) {
      const isUser = role === "user";
      let text = extractMessageText(content);

      // Check to see if the previous message failed guardrail - 
      // If it failed (category !== 'NONE'), don't append the message back to the
      // realtime model explaining that it was
      const previousItem = transcriptItemsRef.current.find((i) => i.itemId === item.previousItemId);
      if (
        previousItem?.guardrailResult?.category &&
        previousItem.guardrailResult.category !== 'NONE'
      ) {
        addTranscriptBreadcrumb(
          'Message blocked by guardrail',
          {
            blockedItemId: item.itemId,
            previousItemId: previousItem.itemId,
            category: previousItem.guardrailResult.category,
            rationale: previousItem.guardrailResult.rationale,
          }
        );
        // Block further messages until an assistant message comes in -
        // multiple messages come back from the guardrails processor since it processes
        // the transcript as it is streaming.
        userBlockedAfterGuardrailRef.current = true;
      }
      if (role === 'user' && userBlockedAfterGuardrailRef.current) {
        return;
      }

      if (isUser && !text) {
        text = "[Transcribing...]";
      }
      addTranscriptMessage(itemId, role, text);
    }

    // If this is an assistant message, initialize guardrailResult as IN_PROGRESS.
    if (role === 'assistant') {
      userBlockedAfterGuardrailRef.current = false;
      updateTranscriptItem(itemId, {
        guardrailResult: {
          status: 'IN_PROGRESS',
        },
      });
    }
  }

  function handleHistoryUpdated(items: any[]) {
    items.forEach((item: any) => {
      if (!item || item.type !== 'message') return;

      const { itemId, content = [] } = item;

      const text = extractMessageText(content);

      updateTranscriptMessage(itemId, text, false);
    });
  }

  function handleTranscriptionDelta(item: any) {
    const itemId = item.item_id;
    const deltaText = item.delta || "";
    if (itemId) {
      updateTranscriptMessage(itemId, deltaText, true);
    }
  }

  function handleTranscriptionCompleted(item: any) {
    // History updates don't reliably end in a completed item, 
    // so we need to handle finishing up when the transcription is completed.
    const itemId = item.item_id;
    const finalTranscript =
        !item.transcript || item.transcript === "\n"
        ? "[inaudible]"
        : item.transcript;
    if (itemId) {
      updateTranscriptMessage(itemId, finalTranscript, false);
      // Use the ref to get the latest transcriptItems
      const transcriptItem = transcriptItemsRef.current.find((i) => i.itemId === itemId);

      if (transcriptItem?.role === 'user') {
        updateTranscriptItem(itemId, { status: 'DONE' });
      } else {
        // If guardrailResult still pending, mark PASS.
        if (transcriptItem?.guardrailResult?.status === 'IN_PROGRESS') {
          updateTranscriptItem(itemId, {
            guardrailResult: {
              status: 'DONE',
              category: 'NONE',
              rationale: '',
            },
          });
        }
      }
    }
  }

  const handlersRef = useRef({
    handleAgentToolStart,
    handleAgentToolEnd,
    handleHistoryUpdated,
    handleHistoryAdded,
    handleTranscriptionDelta,
    handleTranscriptionCompleted,
  });

  return handlersRef;
}