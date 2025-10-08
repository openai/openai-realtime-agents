// web/src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Transcript from '@/components/app_agents/Transcript';
import Events from '@/components/app_agents/Events';
import BottomToolbar from '@/components/app_agents/BottomToolbar';
import { SessionStatus } from '@/types';
import { useTranscript } from '@/contexts/TranscriptContext';
import { useEvent } from '@/contexts/EventContext';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { createModerationGuardrail } from '@/agentConfigs/guardrails';
import {
  allAgentSets,
  defaultAgentSetKey,
  customerServiceRetailCompanyName,
  chatSupervisorCompanyName,
} from '@/agentConfigs';
import { customerServiceRetailScenario } from '@/agentConfigs/customerServiceRetail';
import { chatSupervisorScenario } from '@/agentConfigs/chatSupervisor';
import { simpleHandoffScenario } from '@/agentConfigs/simpleHandoff';
import useAudioDownload from '@/hooks/useAudioDownload';
import { useHandleSessionHistory } from '@/hooks/useHandleSessionHistory';

const sdkScenarioMap: Record<string, any[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

export default function App() {
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const urlCodec = searchParams.get('codec') || 'opus';
  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState('');
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    any[] | null
  >(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>('DISCONNECTED');
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] = useState(true);
  const [userText, setUserText] = useState('');
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    }
  );

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
    if (sdkAudioElement && !audioElementRef.current)
      audioElementRef.current = sdkAudioElement;
  }, [sdkAudioElement]);

  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute } =
    useRealtimeSession({
      onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
      onAgentHandoff: (agentName: string) => {
        handoffTriggeredRef.current = true;
        setSelectedAgentName(agentName);
      },
    });

  useHandleSessionHistory();

  // Initialize agents based on query param
  useEffect(() => {
    let finalAgentConfig = searchParams.get('agentConfig');
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set('agentConfig', finalAgentConfig);
      window.history.replaceState({}, '', url.toString());
    }
    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || '';
    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, []);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === 'DISCONNECTED')
      connectToRealtime();
  }, [selectedAgentName]);
  useEffect(() => {
    if (
      sessionStatus === 'CONNECTED' &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') updateSession();
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    const be = (import.meta as any).env.VITE_BACKEND_URL || '';
    const url = be ? `${be}/api/session` : '/api/session';
    logClientEvent({ url }, 'fetch_session_token_request');
    const tokenResponse = await fetch(url);
    const data = await tokenResponse.json();
    logServerEvent(data, 'fetch_session_token_response');
    if (!data.client_secret?.value) {
      logClientEvent(data, 'error.no_ephemeral_key');
      setSessionStatus('DISCONNECTED');
      return null;
    }
    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get('agentConfig') || 'default';
    if (!sdkScenarioMap[agentSetKey]) return;
    if (sessionStatus !== 'DISCONNECTED') return;
    setSessionStatus('CONNECTING');
    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) return;
      const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
      const idx = reorderedAgents.findIndex(
        (a) => a.name === selectedAgentName
      );
      if (idx > 0) {
        const [agent] = reorderedAgents.splice(idx, 1);
        reorderedAgents.unshift(agent);
      }
      const companyName =
        agentSetKey === 'customerServiceRetail'
          ? customerServiceRetailCompanyName
          : chatSupervisorCompanyName;
      const guardrail = createModerationGuardrail(companyName);
      await connect({
        getEphemeralKey: async () => EPHEMERAL_KEY,
        initialAgents: reorderedAgents,
        audioElement: sdkAudioElement,
        outputGuardrails: [guardrail],
        extraContext: { addTranscriptBreadcrumb },
      });
    } catch (err) {
      console.error('Error connecting via SDK:', err);
      setSessionStatus('DISCONNECTED');
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus('DISCONNECTED');
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, 'user', text, true);
    sendEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendEvent({ type: 'response.create' });
  };

  const updateSession = (shouldTriggerResponse = false) => {
    const turnDetection = isPTTActive
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };
    sendEvent({
      type: 'session.update',
      session: { turn_detection: turnDetection },
    });
    if (shouldTriggerResponse) sendSimulatedUserMessage('hi');
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();
    sendUserText(userText.trim());
    setUserText('');
  };
  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();
    setIsPTTUserSpeaking(true);
    sendEvent({ type: 'input_audio_buffer.clear' });
  };
  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    sendEvent({ type: 'input_audio_buffer.commit' });
    sendEvent({ type: 'response.create' });
  };
  const onToggleConnection = () => {
    sessionStatus === 'CONNECTED' || sessionStatus === 'CONNECTING'
      ? disconnectFromRealtime()
      : connectToRealtime();
  };
  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set('agentConfig', newAgentConfig);
    window.location.replace(url.toString());
  };
  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
  };
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set('codec', newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const v = localStorage.getItem('pushToTalkUI');
    if (v) setIsPTTActive(v === 'true');
    const logsExp = localStorage.getItem('logsExpanded');
    if (logsExp) setIsEventsPaneExpanded(logsExp === 'true');
    const aud = localStorage.getItem('audioPlaybackEnabled');
    if (aud) setIsAudioPlaybackEnabled(aud === 'true');
  }, []);
  useEffect(() => {
    localStorage.setItem('pushToTalkUI', String(isPTTActive));
  }, [isPTTActive]);
  useEffect(() => {
    localStorage.setItem('logsExpanded', String(isEventsPaneExpanded));
  }, [isEventsPaneExpanded]);
  useEffect(() => {
    localStorage.setItem(
      'audioPlaybackEnabled',
      String(isAudioPlaybackEnabled)
    );
  }, [isAudioPlaybackEnabled]);
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
    try {
      mute(!isAudioPlaybackEnabled);
    } catch {}
  }, [isAudioPlaybackEnabled]);
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch {}
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);
  useEffect(() => {
    if (sessionStatus === 'CONNECTED' && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get('agentConfig') || 'default';

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => window.location.reload()}>
          <img
            src="/openai-logomark.svg"
            alt="OpenAI Logo"
            width={20}
            height={20}
            className="mr-2"
          />
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
              className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none">
              {Object.keys(allAgentSets).map((k) => (
                <option key={k} value={k}>
                  {k}
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
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none">
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
                    fill="currentColor">
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
          canSend={sessionStatus === 'CONNECTED'}
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
