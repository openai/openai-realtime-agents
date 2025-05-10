"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";
import InterviewExperience from "@/app/components/InterviewExperience";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { AgentActivityProvider, useAgentActivity } from "@/app/contexts/AgentActivityContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";
import { createUpdatedAgentConfig } from "./lib/engagementHelpers";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { startupInterviewerTemplate } from "@/app/agentConfigs/supportFeedback";

// New imports for interview mode data handling
import { getInterviewWithRelationsClient as getInterviewWithRelations } from "@/app/lib/interviewClientHelper";
import type { InterviewWithRelations as InterviewData } from "@/app/lib/interviewClientHelper";
import { createInterviewAgentConfig } from "@/app/lib/createInterviewConfig"; // Already used by InterviewAgent, ensure App.tsx can use it too

// New import for InterviewAgent
import InterviewAgent from "./components/InterviewAgent";

function App() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb, saveTranscriptData } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const {
    activityState,
    setIsMicrophoneActive,
    setIsHearingUser,
    setIsThinking,
    setIsSpeakingAudio,
    setIsSpeakingText,
  } = useAgentActivity();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);
  const [customAgentConfig, setCustomAgentConfig] = useState<AgentConfig | null>(null);
  
  const [isInterviewMode, setIsInterviewMode] = useState<boolean>(false);

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  // State for initial data loading for non-interview mode (startupInterviewer)
  const [, setEngagementData] = useState<any>(null);
  const [isLoadingEngagementData, setIsLoadingEngagementData] = useState<boolean>(false);
  const [engagementError, setEngagementError] = useState<string | null>(null);

  // New state for interview mode data loading & validation by App.tsx
  const [isInterviewSetupLoading, setIsInterviewSetupLoading] = useState<boolean>(false);
  const [interviewSetupError, setInterviewSetupError] = useState<string | null>(null);
  const [validatedInterviewDataForAgent, setValidatedInterviewDataForAgent] = useState<InterviewData | null>(null);

  // New derived state for agent display status, similar to session/page.tsx
  const [agentDisplayStatus, setAgentDisplayStatus] = useState<string>("Agent is listening...");

  // Candidate view flag based on query param
  const isCandidateView = searchParams.get("candidate") === "1";
  const interviewId = searchParams.get("interviewId");

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
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

  // React when agent marks interview complete
  const handleFunctionResult = (name: string, result: any) => {
    if (
      name === "markInterviewCompleted" &&
      result?.success &&
      isCandidateView &&
      isInterviewMode
    ) {
      // Give slight delay for disconnect then redirect
      setTimeout(() => {
        router.push("/i/thank-you");
      }, 300);
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
    customAgentConfig,
    onFunctionResult: handleFunctionResult,
    setIsHearingUser,
    setIsThinking,
    setIsSpeakingAudio,
    setIsSpeakingText,
  });

  // Effect to update agentDisplayStatus based on activityState
  useEffect(() => {
    console.log("[App.tsx] Activity State Update:", JSON.stringify(activityState)); // DEBUG LOG
    if (activityState.isThinking) {
      setAgentDisplayStatus("Agent is thinking...");
    } else if (activityState.isSpeakingAudio) {
      // No specific text for agent speaking, visualization handles it.
      // Status can remain "Listening..." or similar general state.
      setAgentDisplayStatus("Listening..."); 
    } else if (activityState.isHearingUser) {
      setAgentDisplayStatus("Listening..."); // User speaking, visual feedback primarily from canvas
    } else { // Default idle state
      setAgentDisplayStatus("Listening...");
    }
  }, [activityState]);

  useEffect(() => {
    const currentInterviewId = searchParams.get("interviewId");
    setIsInterviewMode(!!currentInterviewId);

    if (currentInterviewId) {
      console.log("App.tsx: Interview mode detected, ID:", currentInterviewId);
      // Initiate data fetching and agent config creation for interview mode
      setupInterviewSession(currentInterviewId);
      return; // Stop further default agent setup
    }

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
    if ((selectedAgentName || customAgentConfig) && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName, customAgentConfig]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      if (customAgentConfig) {
        addTranscriptBreadcrumb(
          `Interview Agent: ${customAgentConfig.name}`,
          customAgentConfig
        );
        updateSessionWithCustomConfig();
      } else if (selectedAgentConfigSet && selectedAgentName) {
        const currentAgent = selectedAgentConfigSet.find(
          (a) => a.name === selectedAgentName
        );
        addTranscriptBreadcrumb(
          `Agent: ${selectedAgentName}`,
          currentAgent
        );
        updateSession(true);
      }
    }
  }, [selectedAgentConfigSet, selectedAgentName, customAgentConfig, sessionStatus]);

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

    const secret =
      typeof data.client_secret === "string"
        ? data.client_secret
        : data.client_secret?.value;

    if (!secret) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return secret;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        setSessionStatus("DISCONNECTED");
        setIsMicrophoneActive(false);
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.playbackRate = 1.0;
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef,
        {
          onMicrophoneActive: () => setIsMicrophoneActive(true),
          onAgentAudioStart: () => {
            setIsThinking(false);
            setIsSpeakingAudio(true);

            // Define a handler for when audio playback ends
            const handleAudioEnded = () => {
              setIsSpeakingAudio(false);
              // Clean up the event listener
              if (audioElementRef.current) {
                audioElementRef.current.removeEventListener('ended', handleAudioEnded);
              }
            };

            // Add the event listener to the audio element
            if (audioElementRef.current) {
              // Remove any existing listener first to be safe, then add
              audioElementRef.current.removeEventListener('ended', handleAudioEnded); // Precautionary removal
              audioElementRef.current.addEventListener('ended', handleAudioEnded, { once: true });
            }
          }
        }
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
        if (customAgentConfig) {
          updateSessionWithCustomConfig(false);
        } else if (selectedAgentConfigSet && selectedAgentName) {
          updateSession(false);
        }
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current(JSON.parse(e.data));
      });

      setDataChannel(dc);
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const disconnectFromRealtime = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    setSessionStatus("DISCONNECTED");
    addTranscriptBreadcrumb("Disconnected");
    setIsMicrophoneActive(false);
    setIsHearingUser(false);
    setIsThinking(false);
    setIsSpeakingAudio(false);
    setIsSpeakingText(false);

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
          type: "semantic_vad",
          eagerness: "high",
          create_response: true,
        };

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "shimmer",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { 
          model: "gpt-4o-mini-transcribe"
        },
        input_audio_noise_reduction: {
          type: "near_field"
        },
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
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");

    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "DONE") {
      console.log("No truncation needed, message is DONE");
      return;
    }

    sendClientEvent({
      type: "conversation.item.truncate",
      item_id: mostRecentAssistantMessage?.itemId,
      content_index: 0,
      audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
    });
    sendClientEvent(
      { type: "response.cancel" },
      "(cancel due to user interruption)"
    );
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    cancelAssistantSpeech();

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
    setUserText("");

    sendClientEvent({ type: "response.create" }, "trigger response");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED" || dataChannel?.readyState !== "open")
      return;
    cancelAssistantSpeech();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
  };

  const handleTalkButtonUp = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      dataChannel?.readyState !== "open" ||
      !isPTTUserSpeaking
    )
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      // If in interview mode, save transcript data when disconnecting
      if (isInterviewMode) {
        const interviewId = searchParams.get("interviewId");
        if (interviewId) {
          console.log("Saving transcript data before disconnecting...");
          saveTranscriptData(interviewId).catch(err => {
            console.error("Error saving transcript on disconnect:", err);
          });
        }
      }
      
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
      audioElementRef.current.playbackRate = 1.5;
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (selectedAgentName === "startupInterviewer" && selectedAgentConfigSet) {
      setIsLoadingEngagementData(true);
      setEngagementError(null);
      
      // Check for interview ID in URL parameters
      const searchParams = new URLSearchParams(window.location.search);
      const interviewId = searchParams.get('interviewId');
      
      // Determine which API endpoint to use based on available parameters
      const apiUrl = interviewId 
        ? `/api/engagement?interviewId=${interviewId}` 
        : `/api/engagement?id=08ea46fc-f85f-4176-a139-54caa44fda7e`; // Fallback to hardcoded ID
      
      // Fetch real data from our API
      fetch(apiUrl)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch data: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log("Received data for agent configuration:", data);
          setEngagementData(data);
          
          // If we have interview data, use the template for better customization
          const baseAgent = interviewId && startupInterviewerTemplate 
            ? startupInterviewerTemplate 
            : selectedAgentConfigSet.find(a => a.name === "startupInterviewer");
          
          const updatedAgent = createUpdatedAgentConfig(baseAgent, data);
          
          if (updatedAgent) {
            // Replace the agent with our data-filled version
            setSelectedAgentConfigSet(prevSet => 
              prevSet?.map(a => a.name === "startupInterviewer" ? updatedAgent : a) || null
            );
            
            // Construct a descriptive breadcrumb based on available data
            const company = data.company?.business_name || "Unknown Company";
            const engagement = data.engagement?.title || "Unknown Engagement";
            const person = data.person 
              ? `${data.person.first_name} ${data.person.last_name}` 
              : "Unknown Contact";
              
            addTranscriptBreadcrumb(
              `Updated Agent: ${selectedAgentName}`,
              { 
                interview: data.interview?.id || "N/A",
                company,
                engagement,
                person,
                questions: data.questions?.length || 0,
                usingTemplate: !!interviewId
              }
            );
          }
          
          setIsLoadingEngagementData(false);
        })
        .catch(err => {
          console.error("Error fetching data:", err);
          setEngagementError(err.message);
          setIsLoadingEngagementData(false);
          
          addTranscriptBreadcrumb(
            `Error loading data for ${selectedAgentName}`,
            { error: err.message }
          );
        });
    }
  }, [selectedAgentName, selectedAgentConfigSet]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  // New function to update session with custom agent config
  const updateSessionWithCustomConfig = (shouldTriggerResponse: boolean = true) => {
    if (!customAgentConfig || !dcRef.current) return;

    const eventObj = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: customAgentConfig.instructions,
        voice: "shimmer",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { 
          model: "gpt-4o-mini-transcribe"
        },
        input_audio_noise_reduction: {
          type: "near_field"
        },
        turn_detection: isPTTActive ? null : {
          type: "semantic_vad",
          eagerness: "high",
          create_response: true,
        },
        tools: customAgentConfig.tools || [],
      }
    };

    sendClientEvent(eventObj, "update_session");
    
    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
  };

  // Function to handle receiving a custom agent config from InterviewAgent
  const handleAgentConfigLoaded = (config: AgentConfig) => {
    // This is called by InterviewAgent. For interview mode, App.tsx now sets customAgentConfig first.
    // If config is different, it will update. If same, no real change.
    console.log("App.tsx: handleAgentConfigLoaded called by InterviewAgent. Current customAgentConfig:", customAgentConfig?.name, "New:", config.name);
    if (JSON.stringify(customAgentConfig) !== JSON.stringify(config)) {
        setCustomAgentConfig(config);
    }
  };

  // Redirect to thank-you only when interview is marked complete
  useEffect(() => {
    if (isCandidateView && sessionStatus === "DISCONNECTED" && isInterviewMode) {
      const interviewId = searchParams.get("interviewId");
      if (!interviewId) return;
      
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/interviews/${interviewId}`);
          const data = await res.json();
          if (data?.status === "completed") {
            router.push("/i/thank-you");
          }
        } catch (err) {
          console.error("Failed to check interview status", err);
        }
      };
      
      checkStatus();
    }
  }, [sessionStatus, isCandidateView, isInterviewMode, router, searchParams]);

  // Function to setup interview session (fetch, validate, configure agent)
  const setupInterviewSession = async (id: string) => {
    setIsInterviewSetupLoading(true);
    setInterviewSetupError(null);
    setValidatedInterviewDataForAgent(null);
    setCustomAgentConfig(null); // Clear previous custom config

    try {
      console.log(`App.tsx: Setting up interview session for ID: ${id}`);
      const data = await getInterviewWithRelations(id);

      if (!data) {
        throw new Error("Interview data could not be retrieved.");
      }
      if (!data.company) {
        throw new Error("Company details are missing. Cannot start interview session.");
      }
      if (!data.person) {
        throw new Error("Contact person details are missing. Cannot start interview session.");
      }
      if (!data.support_engagement) {
        throw new Error("Support engagement details are missing. Cannot start interview session.");
      }
      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions found for this interview. Cannot start interview session.");
      }

      console.log("App.tsx: Interview data validated successfully:", data);
      setValidatedInterviewDataForAgent(data); // Store for passing to InterviewAgent if needed
      
      const agentConfig = createInterviewAgentConfig(data);
      console.log("App.tsx: Agent config created for interview:", agentConfig.name);
      setCustomAgentConfig(agentConfig); // This will trigger connection via useEffect

    } catch (err: any) {
      console.error("App.tsx: Error setting up interview session:", err);
      setInterviewSetupError(err.message || "An unknown error occurred while setting up the interview.");
    } finally {
      setIsInterviewSetupLoading(false);
    }
  };

  // Add the missing onToggleAudioPlayback function definition
  const onToggleAudioPlayback = () => {
    setIsAudioPlaybackEnabled(prev => !prev);
  };

  if (isInterviewMode) {
    if (isInterviewSetupLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
            <h2 className="text-xl font-medium mb-4 text-gray-700">Preparing Your Interview...</h2>
            <p className="text-gray-600">Please wait while we load the details.</p>
            {/* Add a spinner here */}
          </div>
        </div>
      );
    }
    if (interviewSetupError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
            <h2 className="text-red-600 text-xl font-medium mb-4">Error Preparing Interview</h2>
            <p className="text-gray-600 mb-6">{interviewSetupError}</p>
            <Link
              href="/interviews" 
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Interviews
            </Link>
          </div>
        </div>
      );
    }
    // If setup is complete (not loading, no error), the rest of the App renders, 
    // and customAgentConfig should be set, triggering connection.
  }

  return (
    <AgentActivityProvider>
      {/* Audio element for agent speech */}
      <audio ref={audioElementRef} />
      <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
        <div className="p-5 text-lg font-semibold flex justify-between items-center">
          <div className="flex items-center">
            {!isCandidateView && (
            <div onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
              <Image
                src="/openai-logomark.svg"
                alt="OpenAI Logo"
                width={20}
                height={20}
                className="mr-2"
              />
            </div>
            )}
            <div>
              {!isCandidateView ? (
                <>Realtime API <span className="text-gray-500">Agents</span></>
              ) : (
                <>Volta Research</>
              )}
            </div>
          </div>
          {!isCandidateView && (
          <div className="flex items-center">
            {!isInterviewMode && (
              <>
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
                        {selectedAgentConfigSet?.map(agent => (
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
              </>
            )}
            {isInterviewMode && (
              <div className="text-sm text-blue-700">Interview Mode</div>
            )}
          </div>
          )}
        </div>

        {isInterviewMode ? (
          isCandidateView ? (
            <div className="hidden">
              {/* Pass validated data and ID to InterviewAgent. It will use this and not re-fetch. */}
              {/* Its onAgentConfigLoaded will be called, but App.tsx already set the primary config. */}
              <InterviewAgent 
                  onAgentConfigLoaded={handleAgentConfigLoaded} 
                  interviewId={interviewId || undefined} // interviewId from searchParams
                  interviewData={validatedInterviewDataForAgent || undefined} // Pass the data App.tsx loaded
              />
            </div>
          ) : (
            <div className="container mx-auto px-4 py-2">
              <InterviewAgent 
                  onAgentConfigLoaded={handleAgentConfigLoaded} 
                  interviewId={interviewId || undefined}
                  interviewData={validatedInterviewDataForAgent || undefined}
              />
            </div>
          )
        ) : null}

        <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
          {!isCandidateView ? (
            <>
              <Transcript
                userText={userText}
                setUserText={setUserText}
                onSendMessage={handleSendTextMessage}
                canSend={
                  sessionStatus === "CONNECTED" &&
                  dcRef.current?.readyState === "open"
                }
              />
              <Events isExpanded={isEventsPaneExpanded} />
            </>
          ) : (
            interviewId && (
              <div className="w-full max-w-2xl mx-auto h-[520px]">
              {validatedInterviewDataForAgent && (
                <InterviewExperience
                  interviewData={validatedInterviewDataForAgent}
                  isAgentSpeaking={activityState.isSpeakingAudio}
                  isUserSpeaking={activityState.isHearingUser}
                  isAgentThinking={activityState.isThinking} // Pass agent thinking state
                  agentStatusMessage={agentDisplayStatus}
                  sessionStatus={sessionStatus}
                />
              )}
              </div>
            )
          )}
        </div>

        {!isCandidateView && (
        <BottomToolbar
          sessionStatus={sessionStatus}
          onToggleConnection={onToggleConnection}
          isPTTActive={isPTTActive}
          setIsPTTActive={setIsPTTActive}
          isPTTUserSpeaking={isPTTUserSpeaking}
          onTalkButtonDown={handleTalkButtonDown}
          onTalkButtonUp={handleTalkButtonUp}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          onToggleAudioPlayback={onToggleAudioPlayback}
          userText={userText}
          setUserText={setUserText}
          onSendTextMessage={handleSendTextMessage}
          isAgentSpeaking={activityState.isSpeakingAudio || activityState.isSpeakingText}
          onCancelAssistantSpeech={cancelAssistantSpeech}
          isInterviewMode={isInterviewMode}
          currentAgentName={selectedAgentName}
          currentAgentConfig={customAgentConfig || selectedAgentConfigSet?.find(a => a.name === selectedAgentName) || undefined}
        />
        )}

        {isLoadingEngagementData && (
          <div className="absolute top-16 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-md text-sm">
            Loading engagement data...
          </div>
        )}
        
        {engagementError && (
          <div className="absolute top-16 right-4 bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm">
            Error: {engagementError}
          </div>
        )}
      </div>
    </AgentActivityProvider>
  );
}

const AppWrapper: React.FC = () => {
  return (
    <AgentActivityProvider>
      <App />
    </AgentActivityProvider>
  );
}

export default AppWrapper;
