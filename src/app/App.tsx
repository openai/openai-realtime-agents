"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { AgentConfig, SessionStatus, TranscriptItem } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

// Utilities
// WARNING: legacy realtimeConnection is being replaced by the new SDK.
// For scenarios that have been migrated (currently `simpleExample` and `customerServiceRetail`)
// we use the RealtimeClient thin wrapper around @openai/agents-core.
// Legacy WebRTC helper removed – the new RealtimeClient covers all scenarios.
import { RealtimeClient } from "@/app/agentConfigs/realtimeClient";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
// New SDK scenarios
import { simpleExampleScenario } from "@/app/agentConfigs/simpleExample";
import { customerServiceRetailScenario } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";

const sdkScenarioMap: Record<string, import("@/app/agentConfigs/types").RealtimeAgent[]> = {
  simpleExample: simpleExampleScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";

function App() {
  const searchParams = useSearchParams()!;

  // Use urlCodec directly from URL search params (default: "opus")
  const urlCodec = searchParams.get("codec") || "opus";

  const {
    transcriptItems,
    addTranscriptMessage,
    addTranscriptBreadcrumb,
    updateTranscriptMessage,
    updateTranscriptItem,
  } = useTranscript();

  // Keep a mutable reference to the latest transcriptItems so that streaming
  // callbacks registered once during setup always have access to up-to-date
  // data without being re-registered on every render.
  const transcriptItemsRef = useRef<TranscriptItem[]>(transcriptItems);
  useEffect(() => {
    transcriptItemsRef.current = transcriptItems;
  }, [transcriptItems]);
  const { logClientEvent, logServerEvent, logHistoryItem } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    AgentConfig[] | null
  >(null);

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const sdkClientRef = useRef<RealtimeClient | null>(null);
  const loggedFunctionCallsRef = useRef<Set<string>>(new Set());
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const currentPTTPlaceholderIdRef = useRef<string | null>(null);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  const [isOutputAudioBufferActive, setIsOutputAudioBufferActive] =
    useState<boolean>(false);

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (sdkClientRef.current) {
      try {
        sdkClientRef.current.sendEvent(eventObj);
      } catch (err) {
        console.error("Failed to send via SDK", err);
      }
    } else if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };


  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(true);
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      console.log(
        `updatingSession, isPTTACtive=${isPTTActive} sessionStatus=${sessionStatus}`
      );
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      // Use new SDK path
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        const client = new RealtimeClient({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: sdkScenarioMap[agentSetKey],
          audioElement: sdkAudioElement,
        } as any);

        sdkClientRef.current = client;

        client.on("connection_change", (status) => {
          if (status === "connected") setSessionStatus("CONNECTED");
          else if (status === "connecting") setSessionStatus("CONNECTING");
          else setSessionStatus("DISCONNECTED");
        });

        client.on("message", (ev) => {
          // legacy path still logs raw transport messages
          logServerEvent(ev);

          // --- Realtime streaming handling ---------------------------------
          // The Realtime transport emits granular *delta* events while the
          // assistant is speaking or while the user's audio is still being
          // transcribed. Those events were previously only logged which made
          // the UI update only once when the final conversation.item.* event
          // arrived – effectively disabling streaming. We now listen for the
          // delta events and update the transcript as they arrive so that
          // 1) assistant messages stream token-by-token, and
          // 2) the user sees a live "Transcribing…" placeholder while we are
          //    still converting their speech to text.

          // NOTE: The exact payloads are still evolving.  We intentionally
          // access properties defensively to avoid runtime crashes if fields
          // are renamed or missing.

          try {
            // Guardrail trip event – mark last assistant message as FAIL
            if (ev.type === 'guardrail_tripped') {
              const lastAssistant = [...transcriptItemsRef.current]
                .reverse()
                .find((i) => i.role === 'assistant');

              if (lastAssistant) {
                updateTranscriptItem(lastAssistant.itemId, {
                  guardrailResult: {
                    status: 'DONE',
                    category: 'OFF_BRAND',
                    rationale: 'Guardrail triggered',
                    testText: '',
                  },
                } as any);
              }
              return;
            }

            // Response finished – if we still have Pending guardrail mark as
            // Pass. This event fires once per assistant turn.
            if (ev.type === 'response.done') {
              const lastAssistant = [...transcriptItemsRef.current]
                .reverse()
                .find((i) => i.role === 'assistant');

              if (lastAssistant) {
                const existing: any = (lastAssistant as any).guardrailResult;
                if (!existing || existing.status === 'IN_PROGRESS') {
                  updateTranscriptItem(lastAssistant.itemId, {
                    guardrailResult: {
                      status: 'DONE',
                      category: 'NONE',
                      rationale: '',
                    },
                  } as any);
                }
              }
              // continue processing other logic if needed
            }
            // Assistant text (or audio-to-text) streaming
            if (
              ev.type === 'response.text.delta' ||
              ev.type === 'response.audio_transcript.delta'
            ) {
              const itemId: string | undefined = (ev as any).item_id ?? (ev as any).itemId;
              const delta: string | undefined = (ev as any).delta ?? (ev as any).text;
              if (!itemId || !delta) return;

              // Ensure a transcript message exists for this assistant item.
              if (!transcriptItemsRef.current.some((t) => t.itemId === itemId)) {
                addTranscriptMessage(itemId, 'assistant', '');
                updateTranscriptItem(itemId, {
                  guardrailResult: {
                    status: 'IN_PROGRESS',
                  },
                } as any);
              }

              // Append the latest delta so the UI streams.
              updateTranscriptMessage(itemId, delta, true);
              updateTranscriptItem(itemId, { status: 'IN_PROGRESS' });
              return;
            }

            // Live user transcription streaming
            if (ev.type === 'conversation.input_audio_transcription.delta') {
              const itemId: string | undefined = (ev as any).item_id ?? (ev as any).itemId;
              const delta: string | undefined = (ev as any).delta ?? (ev as any).text;
              if (!itemId || typeof delta !== 'string') return;

              // If this is the very first chunk, create a hidden user message
              // so that we can surface "Transcribing…" immediately.
              if (!transcriptItemsRef.current.some((t) => t.itemId === itemId)) {
                addTranscriptMessage(itemId, 'user', 'Transcribing…');
              }

              updateTranscriptMessage(itemId, delta, true);
              updateTranscriptItem(itemId, { status: 'IN_PROGRESS' });
            }

            // Detect start of a new user speech segment when VAD kicks in.
            if (ev.type === 'input_audio_buffer.speech_started') {
              const itemId: string | undefined = (ev as any).item_id;
              if (!itemId) return;

              const exists = transcriptItemsRef.current.some(
                (t) => t.itemId === itemId,
              );
              if (!exists) {
                addTranscriptMessage(itemId, 'user', 'Transcribing…');
                updateTranscriptItem(itemId, { status: 'IN_PROGRESS' });
              }
            }

            // Final transcript once Whisper finishes
            if (
              ev.type === 'conversation.item.input_audio_transcription.completed'
            ) {
              const itemId: string | undefined = (ev as any).item_id;
              const transcriptText: string | undefined = (ev as any).transcript;
              if (!itemId || typeof transcriptText !== 'string') return;

              const exists = transcriptItemsRef.current.some(
                (t) => t.itemId === itemId,
              );
              if (!exists) {
                addTranscriptMessage(itemId, 'user', transcriptText.trim());
              } else {
                // Replace placeholder / delta text with final transcript
                updateTranscriptMessage(itemId, transcriptText.trim(), false);
              }
              updateTranscriptItem(itemId, { status: 'DONE' });
            }

            // Assistant streaming tokens or transcript
            if (
              ev.type === 'response.text.delta' ||
              ev.type === 'response.audio_transcript.delta'
            ) {
              const responseId: string | undefined =
                (ev as any).response_id ?? (ev as any).responseId;
              const delta: string | undefined = (ev as any).delta ?? (ev as any).text;
              if (!responseId || typeof delta !== 'string') return;

              // We'll use responseId as part of itemId to make it deterministic.
              const itemId = `assistant-${responseId}`;

              if (!transcriptItemsRef.current.some((t) => t.itemId === itemId)) {
                addTranscriptMessage(itemId, 'assistant', '');
              }

              updateTranscriptMessage(itemId, delta, true);
              updateTranscriptItem(itemId, { status: 'IN_PROGRESS' });
            }
          } catch (err) {
            // Streaming is best-effort – never break the session because of it.
            console.warn('streaming-ui error', err);
          }
        });

        client.on('history_added', (item) => {
          logHistoryItem(item);

          // Update the transcript view
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

            if (!textContent) return;

            const role = item.role as 'user' | 'assistant';

            // If we previously created a placeholder for this user message,
            // hide it now that the real item arrived.
            if (
              role === 'user' &&
              currentPTTPlaceholderIdRef.current &&
              transcriptItemsRef.current.some(
                (t) => t.itemId === currentPTTPlaceholderIdRef.current,
              )
            ) {
              updateTranscriptItem(currentPTTPlaceholderIdRef.current, {
                isHidden: true,
              });
              currentPTTPlaceholderIdRef.current = null;
            }

            const exists = transcriptItemsRef.current.some(
              (t) => t.itemId === item.itemId,
            );

            if (!exists) {
              addTranscriptMessage(item.itemId, role, textContent, false);
              if (role === 'assistant') {
                updateTranscriptItem(item.itemId, {
                  guardrailResult: {
                    status: 'IN_PROGRESS',
                  },
                } as any);
              }
            } else {
              updateTranscriptMessage(item.itemId, textContent, false);
            }

            // After assistant message completes, add default guardrail PASS if none present.
            if (
              role === 'assistant' &&
              (item as any).status === 'completed'
            ) {
              const current = transcriptItemsRef.current.find(
                (t) => t.itemId === item.itemId,
              );
              const existing = (current as any)?.guardrailResult;
              if (existing && existing.status !== 'IN_PROGRESS') {
                // already final (e.g., FAIL) – leave as is.
              } else {
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
              updateTranscriptItem(item.itemId, {
                status:
                  (item as any).status === 'completed'
                    ? 'DONE'
                    : 'IN_PROGRESS',
              });
            }
          }

          // Surface function / hand-off calls as breadcrumbs (legacy style)
          if (item.type === 'function_call') {
            const title = `Tool call: ${(item as any).name}`;

            if (!loggedFunctionCallsRef.current.has(item.itemId)) {
              addTranscriptBreadcrumb(title, {
                arguments: (item as any).arguments,
              });
              loggedFunctionCallsRef.current.add(item.itemId);

              // If this looks like a handoff (transfer_to_*), switch active
              // agent so subsequent session updates & breadcrumbs reflect the
              // new agent. The Realtime SDK already updated the session on
              // the backend; this only affects the UI state.
              const toolName: string = (item as any).name ?? '';
              const handoffMatch = toolName.match(/^transfer_to_(.+)$/);
              if (handoffMatch) {
                const newAgentKey = handoffMatch[1];

                // Find agent whose name matches (case-insensitive)
                const candidate = selectedAgentConfigSet?.find(
                  (a) => a.name.toLowerCase() === newAgentKey.toLowerCase(),
                );
                if (candidate && candidate.name !== selectedAgentName) {
                  setSelectedAgentName(candidate.name);
                }
              }
            }
            return;
          }
        });

        // Handle continuous updates for existing items so streaming assistant
        // speech shows up while in_progress.
        client.on('history_updated', (history) => {
          history.forEach((item: any) => {
            if (item.type === 'function_call') {
              // Update breadcrumb data (e.g., add output) once we have more info.

              if (!loggedFunctionCallsRef.current.has(item.itemId)) {
                addTranscriptBreadcrumb(`Tool call: ${(item as any).name}`, {
                  arguments: (item as any).arguments,
                  output: (item as any).output,
                });
                loggedFunctionCallsRef.current.add(item.itemId);

                const toolName: string = (item as any).name ?? '';
                const handoffMatch = toolName.match(/^transfer_to_(.+)$/);
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

              return;
            }

            if (item.type !== 'message') return;

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

            const role = item.role as 'user' | 'assistant';

            if (!textContent) return;

            const exists = transcriptItemsRef.current.some(
              (t) => t.itemId === item.itemId,
            );
              if (!exists) {
                addTranscriptMessage(item.itemId, role, textContent, false);
                if (role === 'assistant') {
                  updateTranscriptItem(item.itemId, {
                    guardrailResult: {
                      status: 'IN_PROGRESS',
                    },
                  } as any);
                }
            } else {
              updateTranscriptMessage(item.itemId, textContent, false);
            }

            if ('status' in item) {
              updateTranscriptItem(item.itemId, {
                status:
                  (item as any).status === 'completed'
                    ? 'DONE'
                    : 'IN_PROGRESS',
              });
            }
          });
        });

        await client.connect();
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }

    // All scenarios have been migrated to the SDK – legacy WebRTC path removed.
  };

  const disconnectFromRealtime = () => {
    if (sdkClientRef.current) {
      sdkClientRef.current.disconnect();
      sdkClientRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    setDataChannel(null);
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);

    logClientEvent({}, "disconnected");
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    sendClientEvent(
      { type: "response.create" },
      "(trigger response after simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // In SDK scenarios RealtimeClient manages session config automatically.
    if (sdkClientRef.current) {
      // Avoid overwriting SDK-generated tools / instructions which would break
      // agent hand-offs. We therefore skip the legacy session.update entirely.

      if (shouldTriggerResponse) {
        // Preserve original UX: add hidden "hi" message and trigger response
        // without exposing it in the visible transcript.
        sendSimulatedUserMessage('hi');
      }

      // Reflect Push-to-Talk UI state by (de)activating server VAD on the
      // backend. The Realtime SDK supports live session updates via the
      // `session.update` event.
      const client = sdkClientRef.current;
      if (client) {
        const turnDetection = isPTTActive
          ? null
          : {
              type: 'server_vad',
              threshold: 0.9,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
              create_response: true,
            };
        try {
          client.sendEvent({
            type: 'session.update',
            session: {
              turn_detection: turnDetection,
            },
          });
        } catch (err) {
          console.warn('Failed to update turn_detection', err);
        }
      }
      return;
    }
    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update"
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    const turnDetection = isPTTActive
      ? null
      : {
          type: "server_vad",
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "sage",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: turnDetection,
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
  };

  const cancelAssistantSpeech = async () => {
    // Send a response.cancel if the most recent assistant conversation item is IN_PROGRESS. This implicitly does a item.truncate as well
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");


    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "IN_PROGRESS") {
      sendClientEvent(
        { type: "response.cancel" },
        "(cancel due to user interruption)"
      );
    }

    // Send an output_audio_buffer.cancel if the isOutputAudioBufferActive is True
    if (isOutputAudioBufferActive) {
      sendClientEvent(
        { type: "output_audio_buffer.clear" },
        "(cancel due to user interruption)"
      );
    }
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    cancelAssistantSpeech();

    if (sdkClientRef.current) {
      try {
        sdkClientRef.current.sendUserText(userText.trim());
        // Optimistically add user message to transcript for immediate feedback.
        const id = uuidv4().slice(0, 32);
        addTranscriptMessage(id, 'user', userText.trim());
      } catch (err) {
        console.error("Failed to send via SDK", err);
      }
    } else {
      sendClientEvent(
        {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: userText.trim() }],
          },
        },
        "(send user text message)"
      );
      sendClientEvent({ type: "response.create" }, "(trigger response)");
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      (sdkClientRef.current == null && dataChannel?.readyState !== "open")
    )
      return;
    cancelAssistantSpeech();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");

    // Insert placeholder "Transcribing…" entry so it appears before assistant
    // response even if server transcript arrives later.
    const placeholderId = `ptt-${Date.now()}`;
    currentPTTPlaceholderIdRef.current = placeholderId;
    addTranscriptMessage(placeholderId, 'user', 'Transcribing…');
  };

  const handleTalkButtonUp = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      (sdkClientRef.current == null && dataChannel?.readyState !== "open") ||
      !isPTTUserSpeaking
    )
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newAgentConfig);
    window.location.replace(url.toString());
  };

  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    setSelectedAgentName(newAgentName);
  };

  // Instead of using setCodec, we update the URL and refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. Only supported when using the SDK path.
    if (sdkClientRef.current) {
      try {
        sdkClientRef.current.mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('Failed to toggle SDK mute', err);
      }
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED' && sdkClientRef.current) {
      try {
        sdkClientRef.current.mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <div>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
        <div className="flex items-center">
          <label className="flex items-center text-base gap-1 mr-2 font-medium">
            Scenario
          </label>
          <div className="relative inline-block">
            <select
              value={agentSetKey}
              onChange={handleAgentChange}
              className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
            >
              {Object.keys(allAgentSets).map((agentKey) => (
                <option key={agentKey} value={agentKey}>
                  {agentKey}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {agentSetKey && (
            <div className="flex items-center ml-6">
              <label className="flex items-center text-base gap-1 mr-2 font-medium">
                Agent
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedAgentName}
                  onChange={handleSelectedAgentChange}
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
                >
                  {selectedAgentConfigSet?.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          downloadRecording={downloadRecording}
          canSend={
            sessionStatus === "CONNECTED" &&
            sdkClientRef.current != null || dcRef.current?.readyState === "open"
          }
        />

        <Events isExpanded={isEventsPaneExpanded} />
      </div>

      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={onToggleConnection}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        codec={urlCodec}
        onCodecChange={handleCodecChange}
      />
    </div>
  );
}

export default App;
