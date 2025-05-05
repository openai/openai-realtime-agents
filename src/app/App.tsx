"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

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
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";
import { createUpdatedAgentConfig } from "./lib/engagementHelpers";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { startupInterviewerTemplate } from "@/app/agentConfigs/supportFeedback";

// New import for InterviewAgent
import InterviewAgent from "./components/InterviewAgent";

function App() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb, saveTranscriptData } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

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

  const [, setEngagementData] = useState<any>(null);
  const [isLoadingEngagementData, setIsLoadingEngagementData] = useState<boolean>(false);
  const [engagementError, setEngagementError] = useState<string | null>(null);

  // Candidate view flag based on query param
  const isCandidateView = searchParams.get("candidate") === "1";
  const interviewId = searchParams.get("interviewId");

  // Track when agent is currently speaking for visualization purposes
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);

  // Monitor transcript for assistant messages in progress
  useEffect(() => {
    if (transcriptItems.length === 0) return;

    const latestAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant" && !item.isHidden);

    if (latestAssistantMessage && latestAssistantMessage.status === "IN_PROGRESS") {
      setIsAgentSpeaking(true);
    } else {
      setIsAgentSpeaking(false);
    }
  }, [transcriptItems]);

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

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  useEffect(() => {
    const interviewId = searchParams.get("interviewId");
    setIsInterviewMode(!!interviewId);

    if (interviewId) {
      // In interview mode, don't set up agent configs directly
      // InterviewAgent component will handle the setup
      console.log("Interview mode detected, ID:", interviewId);
      return;
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

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.playbackRate = 1.5;
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
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
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    
    // If in interview mode, save transcript data before disconnecting
    if (isInterviewMode) {
      const interviewId = searchParams.get("interviewId");
      if (interviewId) {
        console.log("Saving transcript data before disconnecting...");
        saveTranscriptData(interviewId).catch(err => {
          console.error("Error saving transcript on disconnect:", err);
        });
      }
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
    setCustomAgentConfig(config);
  };

  // Redirect to thank-you when interview ends (session disconnected in candidate view)
  useEffect(() => {
    if (isCandidateView && sessionStatus === "DISCONNECTED" && isInterviewMode) {
      const timer = setTimeout(() => {
        router.push("/i/thank-you");
      }, 500); // 500ms debounce to avoid premature redirects
      return () => clearTimeout(timer);
    }
  }, [sessionStatus, isCandidateView, isInterviewMode, router]);

  return (
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
            <InterviewAgent onAgentConfigLoaded={handleAgentConfigLoaded} />
          </div>
        ) : (
          <div className="container mx-auto px-4 py-2">
            <InterviewAgent onAgentConfigLoaded={handleAgentConfigLoaded} />
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
            <InterviewExperience
              interviewId={interviewId}
              isAgentSpeaking={isAgentSpeaking}
              sessionStatus={sessionStatus}
            />
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
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
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
  );
}

export default App;
