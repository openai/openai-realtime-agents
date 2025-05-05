// src/app/simple/contexts/ConnectionContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { ConnectionState, AgentMessage } from '../types';
import { createRealtimeConnection } from '@/app/lib/realtimeConnection';
import marleneConfig from '@/app/agentConfigs/marlene';

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
  
  // Função para conectar
  const connect = async () => {
    if (state.status !== 'disconnected') return;
    
    dispatch({ type: 'CONNECTING' });
    console.log("Starting connection process...");
    
    try {
      // Fetch ephemeral key from server instead of using direct API key
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
      
      // Garantir que temos um elemento de áudio
      if (!audioRef.current) {
        console.log("Creating new audio element");
        audioRef.current = document.createElement('audio');
        audioRef.current.autoplay = true;
        
        // Test audio element
        audioRef.current.style.display = 'none';
        document.body.appendChild(audioRef.current);
        
        audioRef.current.oncanplaythrough = () => {
          console.log("Audio can play through");
        };
        
        audioRef.current.onerror = (e) => {
          console.error("Audio element error:", e);
        };
      }
      
      // Criar conexão WebRTC
      console.log("Creating WebRTC connection...");
      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioRef
      );
      
      pcRef.current = pc;
      dcRef.current = dc;
      
      // Configurar handlers de eventos
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'closed'
        ) {
          console.log("ICE connection closed or failed");
          dispatch({ type: 'DISCONNECTED' });
        }
      };
      
      dc.onopen = () => {
        console.log('DataChannel opened - ready to communicate!');
        dispatch({ type: 'CONNECTED', sessionId: Date.now().toString() });
        
        // Log session update
        console.log('Sending session update with Marlene instructions');
        
        // Enviar a configuração da sessão
        sendMessage({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: marleneConfig[0].instructions,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
              create_response: true,
            },
            tools: marleneConfig[0].tools,
          },
        });
        
        console.log('Creating initial response');
        // Inicia a conversa
        sendMessage({ type: "response.create" });
      };
      
      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          console.log('Received message from server:', message.type);
          
          // Log audio events explicitly
          if (message.type === 'audio_started') {
            console.log('AUDIO STARTED EVENT RECEIVED');
          } else if (message.type === 'audio_ended') {
            console.log('AUDIO ENDED EVENT RECEIVED');
          }
          
          // Extrair sessionId se disponível
          if (message.type === 'session.created' && message.session?.id) {
            console.log('Session created with ID:', message.session.id);
            dispatch({ type: 'CONNECTED', sessionId: message.session.id });
          }
          
          // Notificar todos os ouvintes registrados
          messageCallbacksRef.current.forEach(callback => {
            try {
              callback(message);
            } catch (err) {
              console.error('Error in message callback:', err);
            }
          });
        } catch (err) {
          console.error('Failed to parse RTC message:', e.data);
        }
      };
      
      dc.onerror = (err) => {
        console.warn('DataChannel error:', err);
        dispatch({ type: 'ERROR', error: new Error('DataChannel error') });
      };
      
      dc.onclose = () => {
        console.log('DataChannel closed');
        dispatch({ type: 'DISCONNECTED' });
      };
      
    } catch (err) {
      console.error('Connection error:', err);
      dispatch({ type: 'ERROR', error: err instanceof Error ? err : new Error('Unknown connection error') });
    }
  };
  
  // Função para desconectar
  const disconnect = () => {
    const dc = dcRef.current, pc = pcRef.current;
    console.log("Disconnecting...");
    
    // Tentar enviar mensagem de parada
    if (dc?.readyState === 'open') {
      try {
        console.log("Sending stop message");
        dc.send(JSON.stringify({ type: 'stop' }));
      } catch (err) {
        console.warn('Error sending stop message:', err);
      }
    }
    
    // Fechar o DataChannel
    if (dc) {
      try {
        console.log("Closing data channel");
        dc.close();
      } catch (err) {
        console.warn('Error closing DataChannel:', err);
      }
    }
    
    // Fechar a PeerConnection
    if (pc) {
      try {
        console.log("Closing peer connection");
        pc.close();
      } catch (err) {
        console.warn('Error closing PeerConnection:', err);
      }
    }
    
    // Atualizar o estado
    dispatch({ type: 'DISCONNECTED' });
    console.log("Disconnected successfully");
  };
  
  // Função para enviar mensagem
  const sendMessage = (message: any): boolean => {
    try {
      if (dcRef.current && dcRef.current.readyState === 'open') {
        console.log("Sending message to server:", message.type);
        dcRef.current.send(JSON.stringify(message));
        return true;
      } else {
        console.warn('Cannot send message - DataChannel not open');
        return false;
      }
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  };
  
  // Função para registrar callback de mensagens
  const onAgentMessage = (callback: (message: AgentMessage) => void) => {
    messageCallbacksRef.current.push(callback);
    console.log("Added message listener, total listeners:", messageCallbacksRef.current.length);
    
    // Retorna função para remover o listener
    return () => {
      messageCallbacksRef.current = messageCallbacksRef.current.filter(cb => cb !== callback);
      console.log("Removed message listener, total listeners:", messageCallbacksRef.current.length);
    };
  };
  
  // Limpar na desmontagem
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);
  
  const contextValue: ConnectionContextType = {
    state,
    connect,
    disconnect,
    sendMessage,
    onAgentMessage,
  };
  
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} hidden />
    </ConnectionContext.Provider>
  );
};

// Hook para usar o contexto
export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};