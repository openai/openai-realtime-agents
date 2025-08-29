"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import Link from "next/link";

import Transcript from "./components/Transcript";
import Dashboard from "./components/Dashboard";
import LeftPaneControls from "./components/LeftPaneControls";

import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { chatSupervisorScenario, chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import { ensureHouseholdId } from "@/app/lib/householdLocal";

const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  chatSupervisor: chatSupervisorScenario,
};

function App() {
  const searchParams = useSearchParams()!;
  const urlCodec = searchParams.get("codec") || "opus";

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<RealtimeAgent[] | null>(null);

  const [householdId, setHouseholdId] = useState<string>("");
  const [isReturningUser, setIsReturningUser] = useState<boolean>(false);
  useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);
  useEffect(() => {
    (async () => {
      if (!householdId) return;
      try {
        const res = await fetch(`/api/prosper/dashboard?householdId=${householdId}`, { cache: 'no-store' });
        const json = await res.json();
        const inputs = json?.latestSnapshot?.inputs || {};
        const hasInputs = inputs && typeof inputs === 'object' && Object.keys(inputs).length > 0;
        setIsReturningUser(!!hasInputs);
      } catch {}
    })();
  }, [householdId]);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('audioPlaybackEnabled');
    return stored ? stored === 'true' : true;
  });

  const { startRecording, stopRecording, downloadRecording } = useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  // Initial scenario/agent selection
  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.history.replaceState({}, "", url.toString());
    }
    const agents = allAgentSets[finalAgentConfig!];
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
    if (sessionStatus === "CONNECTED" && selectedAgentConfigSet && selectedAgentName) {
      const currentAgent = selectedAgentConfigSet.find((a) => a.name === selectedAgentName);
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      // Configure session detection, then send initial simulated message
      updateSession(false);
      (async () => {
        if (isReturningUser) {
          try {
            const res = await fetch(`/api/prosper/dashboard?householdId=${householdId}`, { cache: 'no-store' });
            const json = await res.json();
            const inputs = json?.latestSnapshot?.inputs || {};
            const tracker = { householdId, slots: inputs?.slots || {}, locale: 'en-GB', currency: inputs?.currency || 'USD' };
            const msg = `ACTION=RECAP; RETURNING_USER=TRUE; DO_NOT_REASK_BASICS=TRUE; tracker=${JSON.stringify(tracker)}`;
            sendSimulatedUserMessage(msg);
          } catch {
            sendSimulatedUserMessage('ACTION=RECAP; RETURNING_USER=TRUE; DO_NOT_REASK_BASICS=TRUE');
          }
        } else if (!handoffTriggeredRef.current) {
          sendSimulatedUserMessage('hi');
        }
        handoffTriggeredRef.current = false;
      })();
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus, isReturningUser, householdId]);

  // Post-checkout confirmation: if we have session_id, confirm and refresh entitlements
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    (async () => {
      if (checkout === 'success' && sessionId) {
        try {
          await fetch(`/api/billing/confirm?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
          // Nudge dashboard to refresh
          try {
            window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { billing: true } }));
            window.dispatchEvent(new CustomEvent('pp:billing_confirmed', { detail: { sessionId } }));
          } catch {}
        } catch {}
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
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
    const agentSetKey = searchParams.get("agentConfig") || "chatSupervisor";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");
      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = chatSupervisorCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: { addTranscriptBreadcrumb },
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
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);
    sendClientEvent({
      type: 'conversation.item.create',
      item: { id, type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    const turnDetection = isPTTActive
      ? null
      : { type: 'server_vad', threshold: 0.9, prefix_padding_ms: 300, silence_duration_ms: 500, create_response: true };

    sendEvent({ type: 'session.update', session: { turn_detection: turnDetection } });
    // Initial message handled separately based on isReturningUser
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

  // PTT controls
  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();
    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');
  };
  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  // Persist UI toggles
  useEffect(() => {
    const storedPTT = localStorage.getItem("pushToTalkUI");
    if (storedPTT) setIsPTTActive(storedPTT === "true");
    const storedAudioPlaybackEnabled = localStorage.getItem("audioPlaybackEnabled");
    if (storedAudioPlaybackEnabled) setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
  }, []);
  useEffect(() => { localStorage.setItem("pushToTalkUI", isPTTActive.toString()); }, [isPTTActive]);
  useEffect(() => { localStorage.setItem("audioPlaybackEnabled", isAudioPlaybackEnabled.toString()); }, [isAudioPlaybackEnabled]);

  // Audio playback & recording
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch(() => {});
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }
    try { mute(!isAudioPlaybackEnabled); } catch {}
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try { mute(!isAudioPlaybackEnabled); } catch {}
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }
    return () => { stopRecording(); };
  }, [sessionStatus]);

  const [activeTab, setActiveTab] = useState('chat' as 'chat' | 'dashboard');

  // Allow dashboard to request opening chat with prefilled text
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const text = e?.detail?.text as string | undefined;
        if (typeof text === 'string' && text.trim()) {
          setActiveTab('chat');
          setUserText(text);
        } else {
          setActiveTab('chat');
        }
      } catch {
        setActiveTab('chat');
      }
    };
    window.addEventListener('pp:open_chat', handler as any);
    return () => window.removeEventListener('pp:open_chat', handler as any);
  }, []);

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800">
      {/* Header */}
      <div className="p-5 text-lg font-semibold flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/home" className="flex items-center">
          <Image src="2D76K394f.eps.svg" alt="Prosper Logo" width={20} height={20} className="mr-2" />
          <span>Prosper AI <span className="text-gray-400">your personal wealth coach</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/home" className="text-gray-700 hover:text-gray-900">Home</Link>
          <Link href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
          <Link href="/feedback" className="text-gray-700 hover:text-gray-900">Feedback</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('chat'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-gray-700 hover:text-gray-900">Chat</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-gray-700 hover:text-gray-900">Dashboard</a>
        </nav>
        <button
          className="h-9 w-9 rounded-full border bg-white flex items-center justify-center hover:bg-gray-50"
          aria-label="User profile"
          title="Profile"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#111827" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#111827" />
          </svg>
        </button>
      </div>

      {/* BODY: centered 2-col grid so the left pane sizes cleanly */}
      <div className="flex-1 w-full min-h-0">
        <div className="max-w-7xl mx-auto px-2 h-full min-h-0 pb-16 lg:pb-0">
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-4 h-full min-h-0">
            {/* Left column */}
            <div className="min-w-0 flex flex-col gap-3 h-full min-h-0">
              <LeftPaneControls
                sessionStatus={sessionStatus}
                onToggleConnection={onToggleConnection}
                isPTTActive={isPTTActive}
                setIsPTTActive={setIsPTTActive}
                isPTTUserSpeaking={isPTTUserSpeaking}
                handleTalkButtonDown={handleTalkButtonDown}
                handleTalkButtonUp={handleTalkButtonUp}
                isAudioPlaybackEnabled={isAudioPlaybackEnabled}
                setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
                codec={urlCodec}
                onCodecChange={(newCodec) => {
                  const url = new URL(window.location.toString());
                  url.searchParams.set("codec", newCodec);
                  window.location.replace(url.toString());
                }}
              />
              <Transcript
                userText={userText}
                setUserText={setUserText}
                onSendMessage={handleSendTextMessage}
                downloadRecording={downloadRecording}
                canSend={sessionStatus === "CONNECTED"}
              />
            </div>

            {/* Right column: Dashboard (unchanged component) */}
            <Dashboard />
          </div>

          {/* Mobile: single view with tabs */}
          <div className="block lg:hidden h-full min-h-0">
            {activeTab === 'chat' ? (
              <div className="min-w-0 flex flex-col gap-3 h-full min-h-0">
                <LeftPaneControls
                  sessionStatus={sessionStatus}
                  onToggleConnection={onToggleConnection}
                  isPTTActive={isPTTActive}
                  setIsPTTActive={setIsPTTActive}
                  isPTTUserSpeaking={isPTTUserSpeaking}
                  handleTalkButtonDown={handleTalkButtonDown}
                  handleTalkButtonUp={handleTalkButtonUp}
                  isAudioPlaybackEnabled={isAudioPlaybackEnabled}
                  setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
                  codec={urlCodec}
                  onCodecChange={(newCodec) => {
                    const url = new URL(window.location.toString());
                    url.searchParams.set("codec", newCodec);
                    window.location.replace(url.toString());
                  }}
                />
                <Transcript
                  userText={userText}
                  setUserText={setUserText}
                  onSendMessage={handleSendTextMessage}
                  downloadRecording={downloadRecording}
                  canSend={sessionStatus === "CONNECTED"}
                />
              </div>
            ) : (
              <Dashboard />
            )}
          </div>
        </div>

        {/* Bottom mobile tab bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-sm z-40">
          <div className="max-w-7xl mx-auto px-2">
            <div className="flex justify-around py-2">
              <button
                className={`px-4 py-2 rounded-md text-sm ${activeTab === 'chat' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm ${activeTab === 'dashboard' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
