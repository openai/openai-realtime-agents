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
    
    try {
      // Garantir que temos um elemento de áudio
      if (!audioRef.current) {
        audioRef.current = document.createElement('audio');
        audioRef.current.autoplay = true;
      }
      
      // Criar conexão WebRTC
      const { pc, dc } = await createRealtimeConnection(
        process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
        audioRef
      );
      
      pcRef.current = pc;
      dcRef.current = dc;
      // Configurar handlers de eventos
      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'closed'
        ) {
          dispatch({ type: 'DISCONNECTED' });
        }
      };
      
      dc.onopen = () => {
        console.log('DataChannel opened');
        dispatch({ type: 'CONNECTED', sessionId: Date.now().toString() });
        
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
        
        // Inicia a conversa
        sendMessage({ type: "response.create" });
      };
      
      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          
          // Extrair sessionId se disponível
          if (message.type === 'session.created' && message.session?.id) {
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
    
    // Tentar enviar mensagem de parada
    if (dc?.readyState === 'open') {
      try {
        dc.send(JSON.stringify({ type: 'stop' }));
      } catch (err) {
        console.warn('Error sending stop message:', err);
      }
    }
    
    // Fechar o DataChannel
    if (dc) {
      try {
        dc.close();
      } catch (err) {
        console.warn('Error closing DataChannel:', err);
      }
    }
    
    // Fechar a PeerConnection
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn('Error closing PeerConnection:', err);
      }
    }
    
    // Atualizar o estado
    dispatch({ type: 'DISCONNECTED' });
  };
  
  // Função para enviar mensagem
  const sendMessage = (message: any): boolean => {
    try {
      if (dcRef.current && dcRef.current.readyState === 'open') {
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
    
    // Retorna função para remover o listener
    return () => {
      messageCallbacksRef.current = messageCallbacksRef.current.filter(cb => cb !== callback);
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