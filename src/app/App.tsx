"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Evaluation from "./components/Evaluation";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useProgress } from "@/app/contexts/ProgressContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { customerServiceRetailScenario } from "@/app/agentConfigs/customerServiceRetail";
import { customerServiceRetailCompanyName } from "@/app/agentConfigs/customerServiceRetail";
import { simpleHandoffScenario } from "@/app/agentConfigs/simpleHandoff";
import { customerAgentsScenario } from "@/app/agentConfigs/customerAgents";
import { customerAgentsCompanyName } from "@/app/agentConfigs/customerAgents";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  customerAgents: customerAgentsScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced 
  // via global codecPatch at module load 

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const { transcriptItems } = useTranscript();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

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

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [userText, setUserText] = useState<string>("");
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  // Evaluation state
  const [showEvaluation, setShowEvaluation] = useState<boolean>(false);

  // Progress tracking
  const { progress, hasPassedAll } = useProgress();

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

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
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession();
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

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
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = agentSetKey === 'customerServiceRetail'
          ? customerServiceRetailCompanyName
          : agentSetKey === 'customerAgents'
          ? customerAgentsCompanyName
          : 'Default Company';
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    // Don't automatically show evaluation - let user choose when to view it
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = () => {
    // Always enable server VAD for continuous speech
    const turnDetection = {
      type: 'server_vad',
      threshold: 0.9,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
    };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });

    // Send an initial 'hi' message to trigger the agent to greet the user
    if (sessionStatus === 'CONNECTED') {
      sendSimulatedUserMessage('hi');
    }
    return;
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();

    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
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
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
  };

  const handleRetry = () => {
    setShowEvaluation(false);
    // Clear transcript for new attempt
    // Note: You might want to add a clearTranscript function to the context
    window.location.reload(); // Simple way to reset everything for new attempt
  };

  const handleNextAgent = () => {
    setShowEvaluation(false);
    const agents = ['angryCustomer', 'frustratedCustomer', 'naiveCustomer'];
    const currentIndex = agents.indexOf(selectedAgentName);
    const nextAgent = agents[(currentIndex + 1) % agents.length];
    setSelectedAgentName(nextAgent);
    // Clear transcript for new agent
    window.location.reload(); // Simple way to reset everything for new agent
  };

  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

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
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          downloadRecording={downloadRecording}
          canSend={sessionStatus === "CONNECTED"}
          hasSelectedAgent={!!selectedAgentName}
        />
      </div>

      <div className="flex flex-col justify-center items-center py-4 gap-4 bg-white border-t">
        {/* Progress Overview */}
        {sessionStatus === "DISCONNECTED" && (
          <div className="flex items-center gap-6 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Progress:</span>
              <div className="flex gap-2">
                <div className={`flex items-center gap-1 ${progress.angryCustomer.passed ? 'text-green-600' : 'text-gray-400'}`}>
                  {progress.angryCustomer.passed ? '✅' : '⭕'} Angry
                </div>
                <div className={`flex items-center gap-1 ${progress.frustratedCustomer.passed ? 'text-green-600' : 'text-gray-400'}`}>
                  {progress.frustratedCustomer.passed ? '✅' : '⭕'} Frustrated
                </div>
                <div className={`flex items-center gap-1 ${progress.naiveCustomer.passed ? 'text-green-600' : 'text-gray-400'}`}>
                  {progress.naiveCustomer.passed ? '✅' : '⭕'} Naive
                </div>
              </div>
            </div>
            {hasPassedAll() && (
              <div className="text-green-600 font-semibold">
                🎉 All customer types completed!
              </div>
            )}
          </div>
        )}

        {/* Agent Selection - only show when disconnected */}
        {sessionStatus === "DISCONNECTED" && (
          <div className="flex items-center gap-4 mb-4">
            <label className="text-base font-medium">Select Customer Type:</label>
            <div className="relative inline-block">
              <select
                value={selectedAgentName}
                onChange={handleSelectedAgentChange}
                className="appearance-none border border-gray-300 rounded-lg text-base px-4 py-2 pr-8 cursor-pointer font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a customer...</option>
                {selectedAgentConfigSet?.map((agent) => {
                  const agentKey = agent.name as keyof typeof progress;
                  const agentProgress = progress[agentKey];
                  const displayName = agent.name === 'angryCustomer' ? 'Angry Customer' :
                                     agent.name === 'frustratedCustomer' ? 'Frustrated Customer' :
                                     agent.name === 'naiveCustomer' ? 'Naive Customer' :
                                     agent.name;
                  return (
                    <option key={agent.name} value={agent.name}>
                      {displayName} {agentProgress.passed ? '✅' : ''}
                    </option>
                  );
                })}
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
          </div>
        )}

        {/* Connection Buttons */}
        {sessionStatus === "DISCONNECTED" && (
          <button
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={connectToRealtime}
            disabled={!selectedAgentName}
          >
            Talk to Agent
          </button>
        )}
        {sessionStatus === "CONNECTED" && (
          <button
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold shadow hover:bg-red-700 transition"
            onClick={disconnectFromRealtime}
          >
            End Conversation
          </button>
        )}
        {sessionStatus === "CONNECTING" && (
          <button
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold shadow cursor-not-allowed"
            disabled
          >
            Connecting...
          </button>
        )}

        {/* Evaluation Button - show after conversation ends */}
        {sessionStatus === "DISCONNECTED" && transcriptItems.length > 0 && !showEvaluation && (
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition"
            onClick={() => setShowEvaluation(true)}
          >
            View Evaluation
          </button>
        )}
      </div>

      {/* Evaluation Modal */}
      <Evaluation
        isVisible={showEvaluation}
        onClose={() => setShowEvaluation(false)}
        customerType={selectedAgentName === 'angryCustomer' ? 'Angry' :
                     selectedAgentName === 'frustratedCustomer' ? 'Frustrated' :
                     selectedAgentName === 'naiveCustomer' ? 'Naive' : 'Customer'}
        onRetry={handleRetry}
        onNextAgent={handleNextAgent}
      />
    </div>
  );
}

export default App;
