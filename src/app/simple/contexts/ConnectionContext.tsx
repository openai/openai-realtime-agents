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
        
        // Configurações adicionais para garantir reprodução de áudio
        audioRef.current.volume = 1.0; // Volume máximo
        audioRef.current.muted = false;
        audioRef.current.controls = true; // Para depuração
        audioRef.current.style.position = 'fixed';
        audioRef.current.style.bottom = '0';
        audioRef.current.style.right = '0';
        audioRef.current.style.zIndex = '1000';
        
        // Adicionar ao DOM para garantir que funcione
        document.body.appendChild(audioRef.current);
        
        // Eventos de debug para áudio
        audioRef.current.onplay = () => console.log("🔊 Áudio iniciou a reprodução!");
        audioRef.current.oncanplay = () => console.log("🔊 Áudio pode ser reproduzido!");
        audioRef.current.onerror = (e) => console.error("❌ Erro no elemento de áudio:", e);
        
        console.log("Elemento de áudio criado e anexado ao DOM:", audioRef.current);
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
        // Inicia a conversa automaticamente
        sendMessage({ type: "response.create" });
        
        // Forçar a reprodução de áudio depois que a sessão estiver configurada
        setTimeout(() => {
          if (audioRef.current) {
            console.log("Tentando reproduzir áudio após DataChannel aberto");
            audioRef.current.play()
              .then(() => console.log("Reprodução de áudio bem-sucedida após configuração"))
              .catch(err => console.error("Erro ao reproduzir áudio após configuração:", err));
          }
        }, 1000);
      };
      
      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          console.log('Received message from server:', message.type);
          
          // Log audio events explicitly
          if (message.type === 'audio_started') {
            console.log('AUDIO STARTED EVENT RECEIVED');
            // Tenta reproduzir o áudio quando o evento audio_started é recebido
            if (audioRef.current) {
              audioRef.current.play()
                .then(() => console.log("Reprodução de áudio iniciada após evento audio_started"))
                .catch(err => console.error("Erro ao reproduzir áudio após evento audio_started:", err));
            }
          } else if (message.type === 'audio_ended') {
            console.log('AUDIO ENDED EVENT RECEIVED');
          } else if (message.type === 'output_audio_buffer.started') {
            console.log('OUTPUT AUDIO BUFFER STARTED - áudio deve estar tocando agora');
            // Forçar a reprodução de áudio novamente
            if (audioRef.current) {
              audioRef.current.play()
                .then(() => console.log("Reprodução de áudio iniciada após output_audio_buffer.started"))
                .catch(err => console.error("Erro ao reproduzir áudio após output_audio_buffer.started:", err));
            }
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
    
    // Parar áudio se estiver reproduzindo
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      } catch (err) {
        console.warn('Error stopping audio:', err);
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
  
  // Conectar automaticamente quando o componente for montado
  useEffect(() => {
    // Inicia a conexão automaticamente após um curto atraso
    const timer = setTimeout(() => {
      console.log("Iniciando conexão automática...");
      connect();
    }, 1000);
    
    // Limpar na desmontagem
    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, []);
  
  // Adicionar monitor de áudio para depuração
  useEffect(() => {
    // Adiciona botão de teste de áudio
    const testButton = document.createElement('button');
    testButton.textContent = "TESTAR ÁUDIO";
    testButton.style.position = 'fixed';
    testButton.style.bottom = '50px';
    testButton.style.left = '10px';
    testButton.style.zIndex = '9999';
    testButton.style.padding = '10px';
    testButton.style.backgroundColor = '#ff6200';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '5px';
    testButton.style.cursor = 'pointer';
    
    testButton.onclick = () => {
      // Crie um som de teste
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // valor em hertz
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1); // Toca por 1 segundo
      
      console.log("Teste de áudio iniciado");
      
      // Tente também reproduzir o áudio no elemento atual
      if (audioRef.current) {
        console.log("Status do elemento de áudio:", {
          srcObject: audioRef.current.srcObject ? "presente" : "ausente",
          paused: audioRef.current.paused,
          muted: audioRef.current.muted,
          volume: audioRef.current.volume
        });
        
        if (audioRef.current.srcObject) {
          audioRef.current.play()
            .then(() => console.log("Reprodução de áudio do WebRTC bem-sucedida"))
            .catch(e => console.error("Erro ao reproduzir áudio do WebRTC:", e));
        }
      }
    };
    
    document.body.appendChild(testButton);
    return () => {
      if (document.body.contains(testButton)) {
        document.body.removeChild(testButton);
      }
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
      {/* Elemento de áudio visível para depuração */}
      <audio 
        ref={(el) => { 
          if (el && !audioRef.current) {
            audioRef.current = el;
            console.log("Elemento de áudio referenciado via JSX");
          }
        }} 
        controls 
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 1000,
          height: '30px'
        }}
      />
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