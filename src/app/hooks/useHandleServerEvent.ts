"use client";

import { useRef } from "react";
import {
  SessionStatus,
  AgentConfig,
  GuardrailResultType,
} from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { runGuardrailClassifier } from "@/app/lib/callOai";

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
  sendClientEvent,
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

  const assistantDeltasRef = useRef<{ [itemId: string]: string }>({});

  const ensureAssistantMessage = (itemId: string) => {
    if (!transcriptItems.some((t) => t.itemId === itemId)) {
      addTranscriptMessage(itemId, 'assistant', '');
      updateTranscriptItem(itemId, {
        guardrailResult: { status: 'IN_PROGRESS' },
      } as any);
    }
  };

  async function processGuardrail(itemId: string, text: string) {
    let res;
    try {
      res = await runGuardrailClassifier(text);
    } catch (error) {
      console.warn(error);
      return;
    }

    const currentItem = transcriptItems.find((item) => item.itemId === itemId);
    if ((currentItem?.guardrailResult?.testText?.length ?? 0) > text.length) {
      // If the existing guardrail result is more complete, skip updating. We're running multiple guardrail checks and you don't want an earlier one to overwrite a later, more complete result.
      return;
    }
    
    const newGuardrailResult: GuardrailResultType = {
      status: "DONE",
      testText: text,
      category: res.moderationCategory,
      rationale: res.moderationRationale,
    };

    // Update the transcript item with the new guardrail result.
    updateTranscriptItem(itemId, { guardrailResult: newGuardrailResult });
  }

  const handleFunctionCall = async (functionCallParams: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    const args = JSON.parse(functionCallParams.arguments);
    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    addTranscriptBreadcrumb(`function call: ${functionCallParams.name}`, args);

    if (currentAgent?.toolLogic?.[functionCallParams.name]) {
      const fn = currentAgent.toolLogic[functionCallParams.name];
      const fnResult = await fn(args, transcriptItems, addTranscriptBreadcrumb);
      addTranscriptBreadcrumb(
        `function call result: ${functionCallParams.name}`,
        fnResult
      );

      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(fnResult),
        },
      });
      sendClientEvent({ type: "response.create" });
    } else if (functionCallParams.name === "transferAgents") {
      const destinationAgent = args.destination_agent;
      const newAgentConfig =
        selectedAgentConfigSet?.find((a) => a.name === destinationAgent) ||
        null;
      if (newAgentConfig) {
        setSelectedAgentName(destinationAgent);
      }
      const functionCallOutput = {
        destination_agent: destinationAgent,
        did_transfer: !!newAgentConfig,
      };
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(functionCallOutput),
        },
      });
      addTranscriptBreadcrumb(
        `function call: ${functionCallParams.name} response`,
        functionCallOutput
      );
    } // else: no local handling; let server/SDK manage output
  };

  // Centralized server-event processing – expects raw events from the
  // Realtime SDK transport (`client.on('message')`) *or* synthesized wrappers
  // for `history_added` / `history_updated`.
  const handleServerEvent = (serverEvent: any) => {
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
          if (role === "user" && !text) {
            text = "[Transcribing...]";
          }
          addTranscriptMessage(itemId, role, text);
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
        }
        break;
      }

      case "response.audio_transcript.delta": {
        const itemId = serverEvent.item_id;
        const deltaText = serverEvent.delta || "";
        if (itemId) {
          // Update the transcript message with the new text.
          updateTranscriptMessage(itemId, deltaText, true);

          // Accumulate the deltas and run the output guardrail at regular intervals.
          if (!assistantDeltasRef.current[itemId]) {
            assistantDeltasRef.current[itemId] = "";
          }
          assistantDeltasRef.current[itemId] += deltaText;
          const newAccumulated = assistantDeltasRef.current[itemId];
          const wordCount = newAccumulated.trim().split(" ").length;

          // Run guardrail classifier every 5 words.
          if (wordCount > 0 && wordCount % 5 === 0) {
            processGuardrail(itemId, newAccumulated);
          }
        }
        break;
      }

      // Assistant text streaming (chat responses)
      case "response.text.delta": {
        let itemId: string | undefined = serverEvent.item_id;
        const deltaText: string = serverEvent.delta || serverEvent.text || "";

        // Older transport used response_id instead of item_id.
        if (!itemId && serverEvent.response_id) {
          itemId = `assistant-${serverEvent.response_id}`;
        }

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
          } as any);
        }
        break;
      }

      case "response.done": {
        if (serverEvent.response?.output) {
          (serverEvent.response.output as any[]).forEach((outputItem: any) => {
            if (
              outputItem.type === "function_call" &&
              outputItem.name &&
              outputItem.arguments
            ) {
              handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: outputItem.arguments,
              });
            }
            if (
              outputItem.type === "message" &&
              outputItem.role === "assistant"
            ) {
              const itemId = outputItem.id;
              const text = outputItem.content[0].transcript;
              // Final guardrail for this message
              processGuardrail(itemId, text);
            }
          });
        }

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
            } as any);
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

    // ------------------------------------------------------------------
    // Realtime SDK *history* events
    // ------------------------------------------------------------------
    if (serverEvent.type === 'history_added') {
      const item = serverEvent.item;
      if (!item) return;

      if (['function_call', 'function_call_output'].includes(item.type as string)) {
        const isResult = item.type === 'function_call_output';
        const titlePrefix = isResult ? 'Tool call result' : 'Tool call';
        const breadcrumbTitle = `${titlePrefix}: ${item.name}`;

        const data: Record<string, any> = {};
        if (item.arguments != null) data.arguments = maybeParseJson(item.arguments);
        if (item.output != null) data.output = maybeParseJson(item.output);

        const idSuffix = isResult ? `result-${item.itemId}` : item.itemId;
        addTranscriptBreadcrumb(breadcrumbTitle, data, `tool-${idSuffix}`);

        // Handle transfer_to_* agent switch
        const handoffMatch = (item.name ?? '').match(/^transfer_to_(.+)$/);
        if (handoffMatch) {
          const newAgentKey = handoffMatch[1];
          const candidate = selectedAgentConfigSet?.find(
            (a) => a.name.toLowerCase() === newAgentKey.toLowerCase(),
          );
          if (candidate && candidate.name !== selectedAgentName) {
            setSelectedAgentName(candidate.name);
          }
        }
        return;
      }

      if (item.type === 'message') {
        const textContent = (item.content || [])
          .map((c: any) => {
            if (c.type === 'text') return c.text;
            if (c.type === 'input_text') return c.text;
            if (c.type === 'input_audio') return c.transcript ?? '';
            if (c.type === 'audio') return c.transcript ?? '';
            return '';
          })
          .join(' ')
          .trim();

        if (textContent.includes('Failed Guardrail Reason: moderation_guardrail')) return;

        const role = item.role as 'user' | 'assistant';

        const exists = transcriptItems.some((t) => t.itemId === item.itemId);

        if (!exists) {
          const initialText = textContent || (role === 'user' ? 'Transcribing…' : '');
          addTranscriptMessage(item.itemId, role, initialText, false);

          if (role === 'assistant') {
            updateTranscriptItem(item.itemId, {
              guardrailResult: {
                status: 'IN_PROGRESS',
              },
            } as any);
          }
        }

        if (textContent) {
          updateTranscriptMessage(item.itemId, textContent, false);
        }

        if (role === 'assistant' && (item as any).status === 'completed') {
          const existing = transcriptItems.find((t) => t.itemId === item.itemId) as any;
          if (existing && (!existing.guardrailResult || existing.guardrailResult.status === 'IN_PROGRESS')) {
            updateTranscriptItem(item.itemId, {
              guardrailResult: {
                status: 'DONE',
                category: 'NONE',
                rationale: '',
              },
            } as any);
          }
        }

        if ('status' in item) {
          const shouldMarkDone = (item as any).status === 'completed' && textContent.length > 0;
          updateTranscriptItem(item.itemId, { status: shouldMarkDone ? 'DONE' : 'IN_PROGRESS' });
        }
      }

      return; // Already fully handled
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