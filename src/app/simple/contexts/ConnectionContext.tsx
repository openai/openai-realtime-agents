// src/app/simple/contexts/ConnectionContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { ConnectionState, AgentMessage } from '../types';
import { createRealtimeConnection } from '@/app/lib/realtimeConnection';
import marleneConfig from '@/app/agentConfigs/marlene';
import { useSimulation } from './SimulationContext';

// Estado inicial
const initialState: ConnectionState = {
  status: 'disconnected',
  sessionId: null,
  error: null,
};

// Tipos de ações
type ConnectionAction = 
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED', sessionId: string }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR', error: Error };

// Reducer
const connectionReducer = (state: ConnectionState, action: ConnectionAction): ConnectionState => {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, status: 'connecting', error: null };
    case 'CONNECTED':
      return { ...state, status: 'connected', sessionId: action.sessionId, error: null };
    case 'DISCONNECTED':
      return { ...state, status: 'disconnected', sessionId: null };
    case 'ERROR':
      return { ...state, error: action.error, status: 'disconnected' };
    default:
      return state;
  }
};

// Tipo do contexto
interface ConnectionContextType {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  onAgentMessage: (callback: (message: AgentMessage) => void) => () => void;
}

// Criar o contexto
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Provider
export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(connectionReducer, initialState);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messageCallbacksRef = useRef<Array<(message: AgentMessage) => void>>([]);

  // === INÍCIO MODIFICAÇÕES SIMULAÇÃO ===
  const { simulationMode, offlineMode } = useSimulation();
  // === FIM MODIFICAÇÕES SIMULAÇÃO ===

  // Função para conectar
  const connect = async () => {
    if (state.status !== 'disconnected') return;

    // === INÍCIO SIMULAÇÃO CONEXÃO ===
    if (simulationMode && offlineMode) {
      console.log("🧪 Simulando conexão em modo offline (sem chamar a API)");
      dispatch({ type: 'CONNECTED', sessionId: `simulated-${Date.now()}` });
      setTimeout(() => {
        const welcomeMessage: AgentMessage = {
          type: "conversation.item.created",
          item: {
            id: `simulated-${Date.now()}`,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Olá! Sou a Marlene, atendente de voz da Credmais para crédito consignado. Como posso ajudar hoje? [MODO SIMULAÇÃO ATIVO]" }]
          }
        };
        messageCallbacksRef.current.forEach(cb => cb(welcomeMessage));
      }, 1000);
      return;
    }
    // === FIM SIMULAÇÃO CONEXÃO ===

    dispatch({ type: 'CONNECTING' });
    console.log("Starting connection process...");

    try {
      console.log("Fetching ephemeral key from server...");
      const response = await fetch("/api/session");
      if (!response.ok) {
        console.error("Failed to get session token:", response.status);
        throw new Error(`Failed to get session token: ${response.status}`);
      }
      const data = await response.json();
      console.log("Session response received");
      if (!data?.client_secret?.value) {
        console.error("No ephemeral key in response:", data);
        throw new Error("No ephemeral key provided by the server");
      }
      const EPHEMERAL_KEY = data.client_secret.value;
      console.log("Ephemeral key obtained, connecting to Realtime API...");

      if (!audioRef.current) {
        console.log("Creating new audio element");
        audioRef.current = document.createElement('audio');
        audioRef.current.autoplay = true;
        audioRef.current.volume = 1.0;
        audioRef.current.muted = false;
        audioRef.current.controls = true;
        audioRef.current.style.position = 'fixed';
        audioRef.current.style.bottom = '0';
        audioRef.current.style.right = '0';
        audioRef.current.style.zIndex = '1000';
        document.body.appendChild(audioRef.current);
        audioRef.current.onplay = () => console.log("🔊 Áudio iniciou a reprodução!");
        audioRef.current.oncanplay = () => console.log("🔊 Áudio pode ser reproduzido!");
        audioRef.current.onerror = (e) => console.error("❌ Erro no elemento de áudio:", e);
      }

      console.log("Creating WebRTC connection...");
      const { pc, dc } = await createRealtimeConnection(EPHEMERAL_KEY, audioRef);
      pcRef.current = pc;
      dcRef.current = dc;

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", pc.iceConnectionState);
        if (['disconnected','failed','closed'].includes(pc.iceConnectionState)) {
          console.log("ICE connection closed or failed");
          dispatch({ type: 'DISCONNECTED' });
        }
      };

      dc.onopen = () => {
        console.log('DataChannel opened - ready to communicate!');
        dispatch({ type: 'CONNECTED', sessionId: Date.now().toString() });
        console.log('Sending session update with Marlene instructions');
        sendMessage({
          type: "session.update",
          session: { modalities: ["audio","text"], instructions: marleneConfig[0].instructions, voice: "alloy", input_audio_format: "pcm16", output_audio_format: "pcm16", input_audio_transcription: { model: "whisper-1" }, turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 200, create_response: true }, tools: marleneConfig[0].tools }
        });
        console.log('Creating initial response'); sendMessage({ type: "response.create" });
        setTimeout(() => { audioRef.current?.play().catch(() => {}); }, 1000);
      };

      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          console.log('Received message:', message.type);
          if (['audio_started','output_audio_buffer.started'].includes(message.type)) { audioRef.current?.play().catch(() => {}); }
          if (message.type === 'session.created' && message.session?.id) dispatch({ type: 'CONNECTED', sessionId: message.session.id });
          messageCallbacksRef.current.forEach(cb => { try { cb(message); } catch {} });
        } catch {}
      };

      dc.onerror = err => { console.warn('DataChannel error:', err); dispatch({ type: 'ERROR', error: new Error('DataChannel error') }); };
      dc.onclose = () => dispatch({ type: 'DISCONNECTED' });

    } catch (err) {
      console.error('Connection error:', err);
      dispatch({ type: 'ERROR', error: err instanceof Error ? err : new Error('Unknown connection error') });
    }
  };

  // Função para desconectar
  const disconnect = () => {
    // === INÍCIO SIMULAÇÃO DISCONNECT ===
    if (simulationMode && offlineMode && state.status === 'connected') {
      console.log("🧪 Desconectando da sessão simulada"); dispatch({ type: 'DISCONNECTED' }); return;
    }
    // === FIM SIMULAÇÃO DISCONNECT ===

    const dc = dcRef.current, pc = pcRef.current;
    console.log("Disconnecting...");
    if (dc?.readyState === 'open') dc.send(JSON.stringify({ type: 'stop' }));
    dc?.close(); pc?.close(); audioRef.current?.pause(); audioRef.current && (audioRef.current.srcObject = null);
    dispatch({ type: 'DISCONNECTED' }); console.log("Disconnected successfully");
  };

  // Função para enviar mensagem
  const sendMessage = (message: any): boolean => {
    try {
      if (dcRef.current?.readyState === 'open') { dcRef.current.send(JSON.stringify(message)); return true; }
      return false;
    } catch (err) { console.error('Error sending message:', err); return false; }
  };

  // Função para registrar callback de mensagens
  const onAgentMessage = (callback: (message: AgentMessage) => void) => {
    messageCallbacksRef.current.push(callback);
    return () => { messageCallbacksRef.current = messageCallbacksRef.current.filter(cb => cb !== callback); };
  };

  // Conectar automaticamente quando o componente for montado
  useEffect(() => {
    if (simulationMode) return () => {};
    const timer = setTimeout(() => connect(), 1000);
    return () => { clearTimeout(timer); disconnect(); };
  }, [simulationMode, offlineMode]);

  // Adicionar monitor de áudio para depuração
  useEffect(() => {
    const btn = document.createElement('button');
    Object.assign(btn.style, { position:'fixed', bottom:'50px', left:'10px', zIndex:'9999', padding:'10px', backgroundColor:'#ff6200', color:'white', border:'none', borderRadius:'5px', cursor:'pointer' });
    btn.textContent = "TESTAR ÁUDIO";
    btn.onclick = () => { const ctx = new (window.AudioContext||window.webkitAudioContext)(); const osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.setValueAtTime(440,ctx.currentTime); osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+1); audioRef.current?.play().catch(()=>{}); };
    document.body.appendChild(btn);
    return () => { document.body.removeChild(btn); };
  }, []);

  const contextValue: ConnectionContextType = { state, connect, disconnect, sendMessage, onAgentMessage };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
      <audio ref={el=>{ if(el&&!audioRef.current) audioRef.current=el; }} controls style={{ position:'fixed', bottom:'10px', right:'10px', zIndex:1000, height:'30px' }}/>
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => { const ctx = useContext(ConnectionContext); if(!ctx) throw new Error('useConnection must be used within a ConnectionProvider'); return ctx; };
