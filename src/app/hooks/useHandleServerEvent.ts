"use client";

import { useRef } from "react";
import {
  SessionStatus,
  AgentConfig,
} from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

export interface UseHandleServerEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentName: string;
  selectedAgentConfigSet: AgentConfig[] | null;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setSelectedAgentName: (name: string) => void;
  shouldForceResponse?: boolean;
  setIsOutputAudioBufferActive: (active: boolean) => void;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentName,
  selectedAgentConfigSet,
  setSelectedAgentName,
  setIsOutputAudioBufferActive,
}: UseHandleServerEventParams) {
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  const maybeParseJson = (val: any) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        /* ignore */
      }
    }
    return val;
  };

  const ensureAssistantMessage = (itemId: string) => {
    if (!transcriptItems.some((t) => t.itemId === itemId)) {
      addTranscriptMessage(itemId, 'assistant', '');
      updateTranscriptItem(itemId, {
        guardrailResult: { status: 'IN_PROGRESS' },
      });
    }
  };

  function addFunctionCallBreadcrumb({ name, arguments: args, output, itemId, type }: {
    name: string;
    arguments?: any;
    output?: any;
    itemId: string;
    type: string;
  }) {
    const isResult = type === 'function_call_output' || (type === 'function_call' && output !== undefined && output !== null);
    const titlePrefix = isResult ? 'function call result' : 'function call';
    const breadcrumbTitle = `${titlePrefix}: ${name}`;
    const data = isResult ? maybeParseJson(output) : maybeParseJson(args);
    const idSuffix = isResult ? `result-${itemId}` : itemId;
    addTranscriptBreadcrumb(breadcrumbTitle, data, `func-${idSuffix}`);
  }

  const handleServerEvent = (serverEvent: any) => {
    if (
      serverEvent &&
      (serverEvent.type === 'function_call' || serverEvent.type === 'function_call_output')
    ) {
      addFunctionCallBreadcrumb({
        name: serverEvent.name,
        arguments: serverEvent.arguments,
        output: serverEvent.output,
        itemId: serverEvent.itemId,
        type: serverEvent.type,
      });

      // Agent hand-off UI update
      const handoffMatch = (serverEvent.name ?? '').match(/^transfer_to_(.+)$/);
      if (handoffMatch) {
        const newAgentKey = handoffMatch[1];
        const candidate = selectedAgentConfigSet?.find(
          (a) => a.name.toLowerCase() === newAgentKey.toLowerCase(),
        );
        if (candidate && candidate.name !== selectedAgentName) {
          setSelectedAgentName(candidate.name);
        }
      }
    }
    logServerEvent(serverEvent);

    switch (serverEvent.type) {
      case "session.created": {
        if (serverEvent.session?.id) {
          setSessionStatus("CONNECTED");
          addTranscriptBreadcrumb(
            `session.id: ${
              serverEvent.session.id
            }\nStarted at: ${new Date().toLocaleString()}`
          );
        }
        break;
      }

      case "output_audio_buffer.started": {
        setIsOutputAudioBufferActive(true);
        break;
      }
      case "output_audio_buffer.stopped": {
        setIsOutputAudioBufferActive(false);
        break;
      }

      case "conversation.item.created": {
        let text =
          serverEvent.item?.content?.[0]?.text ||
          serverEvent.item?.content?.[0]?.transcript ||
          "";
        const role = serverEvent.item?.role as "user" | "assistant";
        const itemId = serverEvent.item?.id;

        if (itemId && transcriptItems.some((item) => item.itemId === itemId)) {
          // don't add transcript message if already exists
          break;
        }

        if (itemId && role) {
          const isUser = role === "user";

          if (isUser && !text) {
            text = "[Transcribing...]";
          }

          addTranscriptMessage(itemId, role, text);

          if (isUser && text && text !== "[Transcribing...]") {
            updateTranscriptItem(itemId, { status: "DONE" });
          }
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const itemId = serverEvent.item_id;
        const finalTranscript =
          !serverEvent.transcript || serverEvent.transcript === "\n"
            ? "[inaudible]"
            : serverEvent.transcript;
        if (itemId) {
          updateTranscriptMessage(itemId, finalTranscript, false);
          updateTranscriptItem(itemId, { status: "DONE" });
        }
        break;
      }

      case "response.audio_transcript.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          // Update the transcript message with the new text.
          updateTranscriptMessage(itemId, deltaText, true);
        }
        break;
      }

      // Assistant text streaming (chat responses)
      case "response.text.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || serverEvent.text || "";

        if (!itemId || !deltaText) break;

        ensureAssistantMessage(itemId);

        updateTranscriptMessage(itemId, deltaText, true);
        updateTranscriptItem(itemId, { status: "IN_PROGRESS" });
        break;
      }

      // Live user transcription streaming
      case "conversation.input_audio_transcription.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (!itemId || typeof deltaText !== "string") break;

        if (!transcriptItems.some((t) => t.itemId === itemId)) {
          addTranscriptMessage(itemId, "user", "Transcribing…");
        }

        updateTranscriptMessage(itemId, deltaText, true);
        updateTranscriptItem(itemId, { status: "IN_PROGRESS" });
        break;
      }

      // VAD detected speech start – create placeholder if needed.
      case "input_audio_buffer.speech_started": {
        const itemId = serverEvent.item_id;
        if (!itemId) break;

        if (!transcriptItems.some((t) => t.itemId === itemId)) {
          addTranscriptMessage(itemId, "user", "Transcribing…");
          updateTranscriptItem(itemId, { status: "IN_PROGRESS" });
        }
        break;
      }

      // Guardrail trip event – marks last assistant message as FAIL.
      case "guardrail_tripped": {
        const lastAssistant = [...transcriptItems]
          .reverse()
          .find((i) => i.role === "assistant");

        if (lastAssistant && serverEvent.info) {
          const info = serverEvent.info;
          const moderation =
            "moderationCategory" in info ? info : info.outputInfo ?? info;

          updateTranscriptItem(lastAssistant.itemId, {
            guardrailResult: {
              status: "DONE",
              category: moderation.moderationCategory ?? "OFF_BRAND",
              rationale: moderation.moderationRationale ?? "",
              testText: moderation.testText ?? "",
            },
          });
        }
        break;
      }

      case "response.done": {
        // After assistant turn completes ensure guardrailResult is marked as
        // PASS if still pending.
        const lastAssistant = [...transcriptItems]
          .reverse()
          .find((i) => i.role === "assistant");

        if (lastAssistant) {
          const existing: any = (lastAssistant as any).guardrailResult;
          if (!existing || existing.status === "IN_PROGRESS") {
            updateTranscriptItem(lastAssistant.itemId, {
              guardrailResult: {
                status: "DONE",
                category: "NONE",
                rationale: "",
              },
            });
          }
        }
        break;
      }

      case "response.output_item.done": {
        const itemId = serverEvent.item?.id;
        if (itemId) {
          updateTranscriptItem(itemId, { status: "DONE" });
        }
        break;
      }

      // Final automatic speech-recognition transcript from the server.
      case "conversation.item.input_audio_transcription.completed": {
        const itemId = serverEvent.item_id;
        const transcriptText: string = serverEvent.transcript || "";
        if (!itemId) break;

        // Replace placeholder text with the final transcript and mark DONE.
        if (!transcriptItems.some((t) => t.itemId === itemId)) {
          addTranscriptMessage(itemId, "user", transcriptText.trim());
        } else {
          updateTranscriptMessage(itemId, transcriptText.trim(), false);
        }
        updateTranscriptItem(itemId, { status: "DONE" });
        break;
      }

      default:
        break;
    }

    if (serverEvent.type === 'history_updated') {
      const history: any[] = serverEvent.history ?? [];
      history.forEach((item) => handleServerEvent(item));
      return;
    }
  };

  const handleServerEventRef = useRef(handleServerEvent);
  handleServerEventRef.current = handleServerEvent;

  return handleServerEventRef;
}