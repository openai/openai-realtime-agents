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
  const [entitlements, setEntitlements] = useState<{ plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string } | null>(null);
  const [householdInfo, setHouseholdInfo] = useState<{ email?: string; full_name?: string } | null>(null);
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
        setEntitlements(json?.entitlements || null);
        setHouseholdInfo(json?.household || null);
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
  const [hasAccepted, setHasAccepted] = useState<boolean>(() => {
    try { return localStorage.getItem('pp_terms_v1_accepted') === '1'; } catch { return false; }
  });

  const { startRecording, stopRecording } = useAudioDownload();

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
    if (selectedAgentName && sessionStatus === "DISCONNECTED" && hasAccepted) {
      connectToRealtime();
    }
  }, [selectedAgentName, hasAccepted]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && selectedAgentConfigSet && selectedAgentName) {
      const currentAgent = selectedAgentConfigSet.find((a) => a.name === selectedAgentName);
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      // Configure session detection, then send initial simulated message
      updateSession();
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
          // Add a friendly assistant message in transcript
          try {
            const id = uuidv4().slice(0, 32);
            addTranscriptMessage(id, 'assistant', 'Thanks — your Prosper Premium is now active. You now have full net‑worth history, saved plans, and deeper action checklists. Would you like to review your dashboard or continue in chat?');
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

  const updateSession = () => {
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
    if (!hasAccepted) {
      // Block connecting until terms are accepted
      try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch {}
      return;
    }
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
      <div className="p-5 text-lg font-semibold flex justify-between items-center max-w-7xl mx-auto w-full relative">
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
        <ProfileMenu
          householdId={householdId}
          entitlements={entitlements}
          household={householdInfo}
        />
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
                canSend={sessionStatus === "CONNECTED" && hasAccepted}
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
                  canSend={sessionStatus === "CONNECTED" && hasAccepted}
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
      {/* Terms & Privacy consent bar */}
      {!hasAccepted && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border shadow-xl w-full max-w-lg p-5">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center shrink-0" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 8v5" stroke="#a16207" strokeWidth="2"/><circle cx="12" cy="17" r="1" fill="#a16207"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900">Please accept our Terms to continue</div>
                <div className="text-sm text-gray-700 mt-1">To use Prosper, you need to accept our Terms and Privacy Policy.</div>
                <div className="text-sm text-gray-600 mt-2">
                  By continuing you agree to our <a href="/terms" target="_blank" className="underline">Terms</a> and <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <a className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm" href="/terms" target="_blank" rel="noreferrer">View Terms</a>
                  <a className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm" href="/privacy" target="_blank" rel="noreferrer">View Privacy</a>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border bg-gray-900 text-white hover:bg-gray-800 text-sm"
                    onClick={() => {
                      try { localStorage.setItem('pp_terms_v1_accepted', '1'); } catch {}
                      setHasAccepted(true);
                      (async () => { try { const hh = await ensureHouseholdId(); await fetch('/api/legal/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: hh, terms_version: 'v1', privacy_version: 'v1' }) }); } catch {} })();
                      // After accepting, auto-connect if agent is ready
                      if (selectedAgentName && sessionStatus === 'DISCONNECTED') {
                        try { connectToRealtime(); } catch {}
                      }
                    }}
                  >
                    I Agree
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

function ProfileMenu({ householdId, entitlements, household }: { householdId: string; entitlements: { plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string } | null; household: { email?: string; full_name?: string } | null }) {
  const [open, setOpen] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [fullName, setFullName] = React.useState(household?.full_name || '');
  const [email, setEmail] = React.useState(household?.email || '');
  React.useEffect(() => { setFullName(household?.full_name || ''); setEmail(household?.email || ''); }, [household?.full_name, household?.email]);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#pp_profile_menu')) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const plan = entitlements?.plan || 'free';
  const managePlan = async () => {
    try {
      const res = await fetch('/api/billing/create-portal-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
      const j = await res.json();
      if (j?.url) window.location.href = j.url;
    } catch {}
  };
  const upgrade = async () => {
    try {
      const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email }) });
      const j = await res.json();
      if (j?.url) window.location.href = j.url;
    } catch {}
  };
  const openUserData = () => { try { window.dispatchEvent(new CustomEvent('pp:open_user_data')); } catch {} setOpen(false); };
  const copyHouseholdId = async () => { try { await navigator.clipboard.writeText(householdId); alert('Household ID copied'); } catch {} };
  const saveProfile = async () => {
    try {
      await fetch('/api/household/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email, full_name: fullName }) });
      setShowEdit(false);
    } catch {}
  };

  // Compute initials for avatar
  const initials = React.useMemo(() => {
    const name = (fullName || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const mail = (email || '').trim();
    if (mail && mail.includes('@')) return mail[0].toUpperCase();
    return 'U';
  }, [fullName, email]);

  return (
    <div id="pp_profile_menu" className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="h-9 w-9 rounded-full border bg-gray-900 text-white flex items-center justify-center hover:opacity-90"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={fullName ? `Profile: ${fullName}` : (email ? `Profile: ${email}` : 'Profile')}
        title={fullName || email || 'Profile'}
      >
        <span className="text-[11px] font-semibold">{initials}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 bg-white border rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b">
            <div className="text-sm font-medium text-gray-900 truncate">{fullName || 'Guest'}</div>
            <div className="text-xs text-gray-600 truncate">{email || 'No email'}</div>
            <div className="text-[11px] text-gray-500 mt-1">Plan: <b className={plan === 'premium' ? 'text-emerald-600' : 'text-gray-700'}>{plan}</b></div>
          </div>
          <div className="py-1 text-sm">
            <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { setShowEdit(true); setOpen(false); }}>Edit profile</button>
            <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={openUserData}>Review data</button>
            {plan === 'premium' ? (
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={managePlan}>Manage plan</button>
            ) : (
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={upgrade}>Upgrade to Premium</button>
            )}
            <a className="block px-3 py-2 hover:bg-gray-50" href="/feedback">Send feedback</a>
            <a className="block px-3 py-2 hover:bg-gray-50" href="/terms" target="_blank" rel="noreferrer">Terms</a>
            <a className="block px-3 py-2 hover:bg-gray-50" href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
          </div>
          <div className="px-3 py-2 border-t flex items-center justify-between">
            <div className="text-[11px] text-gray-500 truncate">ID: {householdId?.slice(0, 6)}…</div>
            <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={copyHouseholdId}>Copy</button>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-lg border shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium text-gray-900 mb-2">Edit profile</div>
            <label className="block text-xs text-gray-600">Full name</label>
            <input className="w-full border rounded px-3 py-2 text-sm mb-2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            <label className="block text-xs text-gray-600">Email</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            <div className="mt-3 flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="text-xs px-3 py-1.5 rounded border bg-gray-900 text-white hover:bg-gray-800" onClick={saveProfile}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
