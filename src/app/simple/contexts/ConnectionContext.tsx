// src/app/simple/contexts/ConnectionContext.tsx
import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { ConnectionState, AgentMessage } from '../types';
import { createRealtimeConnection } from '@/app/lib/realtimeConnection';
import marleneConfig from '@/app/agentConfigs/marlene';
import { useSimulation } from './SimulationContext';
import { resetConversationContext } from "@/app/agentConfigs/utils";

// Estado inicial
const initialState: ConnectionState = {
  status: 'disconnected',
  sessionId: null,
  error: null,
  reconnectAttempts: 0
};

// Tipos de ações
type ConnectionAction = 
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED', sessionId: string }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR', error: Error }
  | { type: 'INCREMENT_RECONNECT_ATTEMPTS' };

// Reducer
const connectionReducer = (state: ConnectionState, action: ConnectionAction): ConnectionState => {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, status: 'connecting', error: null };
    case 'CONNECTED':
      return { ...state, status: 'connected', sessionId: action.sessionId, error: null, reconnectAttempts: 0 };
    case 'DISCONNECTED':
      return { ...state, status: 'disconnected', sessionId: null };
    case 'ERROR':
      console.warn("Connection error handled:", action.error);
      return { ...state, error: action.error, status: 'disconnected' };
    case 'INCREMENT_RECONNECT_ATTEMPTS':
      return { ...state, reconnectAttempts: (state.reconnectAttempts || 0) + 1 };
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

// Criar e exportar o contexto
export const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Provider
export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(connectionReducer, initialState);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messageCallbacksRef = useRef<Array<(message: AgentMessage) => void>>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef<boolean>(false);
  
  // === INÍCIO MODIFICAÇÕES SIMULAÇÃO ===
  const { simulationMode, offlineMode } = useSimulation();
  // === FIM MODIFICAÇÕES SIMULAÇÃO ===
  
  // Função auxiliar para tentativas de reconexão com backoff exponencial e jitter
  const attemptReconnection = (reconnectAttempts: number) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Backoff exponencial com jitter para evitar tempestades de reconexão
    const baseBackoffDelay = Math.min(30000, 5000 * Math.pow(1.5, reconnectAttempts || 0));
    // Adicionar variação aleatória de até 30%
    const jitter = Math.random() * 0.3 * baseBackoffDelay;
    const finalDelay = Math.floor(baseBackoffDelay + jitter);
    
    console.log(`Tentativa de reconexão ${reconnectAttempts + 1} em ${(finalDelay / 1000).toFixed(1)} segundos...`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log("Attempting to reconnect automatically...");
      connect();
    }, finalDelay);
  };

  // Função para conectar
  const connect = async () => {
    if (state.status !== 'disconnected') return;

    // Resetar contexto da conversa
    resetConversationContext();

    // Resetar flag de desconexão manual
    manualDisconnectRef.current = false;
    
    // Limpar timeout de reconexão anterior se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
      
      const response = await fetch("/api/session", {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
        
        // Configuração para melhor qualidade de áudio
        if (audioRef.current.setSinkId && typeof audioRef.current.setSinkId === 'function') {
          try {
            // Tenta usar a saída de áudio padrão de alta qualidade se disponível
            audioRef.current.setSinkId('');
          } catch (e) {
            console.warn("Unable to set audio output device:", e);
          }
        }
        
        audioRef.current.style.position = 'fixed';
        audioRef.current.style.bottom = '10px';
        audioRef.current.style.right = '10px';
        audioRef.current.style.zIndex = '1000';
        document.body.appendChild(audioRef.current);
        audioRef.current.onplay = () => console.log("🔊 Áudio iniciou a reprodução!");
        audioRef.current.oncanplay = () => console.log("🔊 Áudio pode ser reproduzido!");
        audioRef.current.onerror = (e) => console.error("❌ Erro no elemento de áudio:", e);
        
        // Tentativa de reprodução com interação do usuário
        const attemptPlay = () => {
          audioRef.current?.play().catch(e => console.warn("Ainda não foi possível reproduzir áudio:", e));
          document.removeEventListener('click', attemptPlay);
        };
        document.addEventListener('click', attemptPlay, { once: true });
      }

      console.log("Creating WebRTC connection...");
      const { pc, dc } = await createRealtimeConnection(EPHEMERAL_KEY, audioRef);
      pcRef.current = pc;
      dcRef.current = dc;

      // Configurar restrições de áudio para melhor qualidade
      pc.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          console.log("Configurando parâmetros de áudio para alta qualidade");
          // Não fazemos nada com o receptor diretamente, pois os parâmetros são controlados pelo servidor
        }
      });

      // Manipulador de mudança de estado de conexão ICE
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", pc.iceConnectionState);
        if (['disconnected','failed','closed'].includes(pc.iceConnectionState)) {
          console.log("ICE connection closed or failed");
          dispatch({ type: 'DISCONNECTED' });
          
          // Se não foi uma desconexão manual, tentar reconectar
          if (!manualDisconnectRef.current) {
            dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
            
            // Iniciar tentativa de reconexão automática com backoff e jitter
            attemptReconnection(state.reconnectAttempts || 0);
          }
        }
      };

      // Manipulador de abertura do canal de dados
      dc.onopen = () => {
        console.log('DataChannel opened - ready to communicate!');
        
        // Limpar temporizador de reconexão se existir
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        dispatch({ type: 'CONNECTED', sessionId: Date.now().toString() });
        console.log('Sending session update with Marlene instructions');
        
        // Atualização para melhorar a qualidade do áudio
        sendMessage({
          type: "session.update",
          session: { 
            modalities: ["audio","text"], 
            instructions: marleneConfig[0].instructions, 
            voice: "alloy",
            input_audio_format: "pcm16", 
            output_audio_format: "pcm16", // Simplificado para o formato básico
            input_audio_transcription: { model: "whisper-1" }, 
            turn_detection: { 
              type: "server_vad", 
              threshold: 0.5, 
              prefix_padding_ms: 300, 
              silence_duration_ms: 200, 
              create_response: true 
            }, 
            tools: marleneConfig[0].tools 
          }
        });
        
        console.log('Creating initial response'); 
        sendMessage({ type: "response.create" });
        
        // Tentar reproduzir áudio assim que a conexão estiver pronta
        setTimeout(() => { 
          audioRef.current?.play().catch(() => {
            console.warn("Failed to autoplay audio, will try again on first message");
            
            // Registrar evento para tentar novamente com interação do usuário
            const attemptPlay = () => {
              audioRef.current?.play().catch(e => console.warn("Ainda não foi possível reproduzir áudio:", e));
              document.removeEventListener('click', attemptPlay);
            };
            document.addEventListener('click', attemptPlay, { once: true });
          }); 
        }, 1000);
        
        // Disparar evento de conexão restabelecida para que outros componentes possam reagir
        document.dispatchEvent(new CustomEvent('connection-restored'));
      };

      // Manipulador de mensagens recebidas
      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          console.log('Received message:', message.type);
          
          // Tentar reproduzir áudio quando receber evento de áudio
          if (['audio_started','output_audio_buffer.started'].includes(message.type)) { 
            // Garantir que o volume está no máximo
            if (audioRef.current) {
              audioRef.current.volume = 1.0;
            }
            
            audioRef.current?.play().catch(() => {
              console.warn("Failed to play audio on event, user interaction may be required");
              
              // Registrar evento para tentar novamente com interação do usuário
              const attemptPlay = () => {
                audioRef.current?.play().catch(e => console.warn("Still failed to play audio:", e));
                document.removeEventListener('click', attemptPlay);
              };
              document.addEventListener('click', attemptPlay, { once: true });
            }); 
          }
          
          // Atualizar ID da sessão se disponível
          if (message.type === 'session.created' && message.session?.id) {
            dispatch({ type: 'CONNECTED', sessionId: message.session.id });
          }
          
          // Notificar todos os callbacks registrados
          messageCallbacksRef.current.forEach(cb => { 
            try { 
              cb(message); 
            } catch (err) {
              console.warn("Error in message callback:", err);
            }
          });
        } catch (err) {
          console.warn('Failed to parse message:', err);
        }
      };

      // Manipulador de erros melhorado
      dc.onerror = err => { 
        console.warn('DataChannel error:', err);
        
        // Monitorar erros que podem indicar problemas específicos
        if (err.error && typeof err.error === 'object' && 'errorDetail' in err.error && err.error.errorDetail === 'sctp-failure') {
          console.error("Critical SCTP failure detected - attempting immediate reconnect");
          disconnect();
          
          // Tentar reconectar após um breve atraso
          setTimeout(() => {
            if (!manualDisconnectRef.current) {
              connect();
            }
          }, 2000);
        }
      };
      
      // Manipulador de fechamento do canal
      dc.onclose = () => {
        console.log("DataChannel closed");
        dispatch({ type: 'DISCONNECTED' });
        
        // Tentar reconectar, a menos que a desconexão tenha sido iniciada manualmente
        if (!manualDisconnectRef.current) {
          dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
          
          // Iniciar tentativa de reconexão automática com backoff e jitter
          attemptReconnection(state.reconnectAttempts || 0);
        }
      };

    } catch (err) {
      console.error('Connection error:', err);
      dispatch({ type: 'ERROR', error: err instanceof Error ? err : new Error('Unknown connection error') });
      
      // Tentar reconectar automaticamente após falha
      if (!manualDisconnectRef.current) {
        dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
        
        // Iniciar tentativa de reconexão automática com backoff e jitter
        attemptReconnection(state.reconnectAttempts || 0);
      }
    }
  };

  // Função para desconectar
  const disconnect = () => {
    // Marcar como desconexão manual para evitar tentativas automáticas de reconexão
    manualDisconnectRef.current = true;
    
    // Limpar qualquer temporizador de reconexão
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // === INÍCIO SIMULAÇÃO DISCONNECT ===
    if (simulationMode && offlineMode && state.status === 'connected') {
      console.log("🧪 Desconectando da sessão simulada"); 
      dispatch({ type: 'DISCONNECTED' }); 
      return;
    }
    // === FIM SIMULAÇÃO DISCONNECT ===

    const dc = dcRef.current, pc = pcRef.current;
    console.log("Disconnecting...");
    
    // Tentar enviar mensagem de parada
    if (dc?.readyState === 'open') {
      try {
        dc.send(JSON.stringify({ type: 'stop' }));
      } catch (err) {
        console.warn("Error sending stop message:", err);
      }
    }
    
    // Fechar conexões
    try {
      dc?.close();
    } catch (err) {
      console.warn("Error closing DataChannel:", err);
    }
    
    try {
      if (pc) {
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        pc.close();
      }
    } catch (err) {
      console.warn("Error closing PeerConnection:", err);
    }
    
    // Pausar áudio
    try {
      audioRef.current?.pause(); 
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn("Error pausing audio:", err);
    }
    
    dispatch({ type: 'DISCONNECTED' }); 
    console.log("Disconnected successfully");
  };

  // Função para enviar mensagem com tratamento robusto de erros
  const sendMessage = (message: any): boolean => {
    try {
      if (simulationMode && offlineMode) {
        console.log("🧪 Simulando envio de mensagem:", message);
        return true;
      }
      
      if (dcRef.current?.readyState === 'open') { 
        dcRef.current.send(JSON.stringify(message)); 
        return true; 
      }
      
      console.warn("Cannot send message - DataChannel not open", {
        dataChannelState: dcRef.current?.readyState,
        connectionStatus: state.status,
        messageType: message.type
      });
      
      // Se não estiver conectado mas não for uma desconexão manual,
      // tenta reconectar automaticamente
      if (!manualDisconnectRef.current && state.status !== 'connecting') {
        console.log("Tentando reconectar após falha de envio de mensagem...");
        
        // Notifica que houve uma falha de conexão durante o envio
        document.dispatchEvent(new CustomEvent('message-send-failed', { 
          detail: { message } 
        }));
        
        // Incrementar contagem de tentativas
        dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
        
        // Tenta reconectar com atraso adaptativo
        attemptReconnection(state.reconnectAttempts || 0);
      }
      
      return false;
    } catch (err) { 
      console.error('Error sending message:', err); 
      
      // Tentar se recuperar em caso de erros não fatais
      if (!manualDisconnectRef.current && dcRef.current) {
        try {
          // Verificar se é um erro de serialização JSON
          if (err instanceof TypeError && err.message.includes('cyclic')) {
            // Tentar enviar uma versão mais simples da mensagem
            const simplifiedMessage = { ...message };
            // Remover propriedades potencialmente problemáticas
            delete simplifiedMessage.eventData;
            delete simplifiedMessage.detail;
            
            console.log("Tentando enviar versão simplificada da mensagem");
            dcRef.current.send(JSON.stringify(simplifiedMessage));
            return true;
          }
        } catch {
          // Ignora erro na tentativa de recuperação
        }
      }
      
      // Notifica que houve um erro durante o envio
      document.dispatchEvent(new CustomEvent('message-send-error', { 
        detail: { message, error: err } 
      }));
      
      return false; 
    }
  };

  // Função para registrar callback de mensagens
  const onAgentMessage = (callback: (message: AgentMessage) => void) => {
    messageCallbacksRef.current.push(callback);
    return () => { 
      messageCallbacksRef.current = messageCallbacksRef.current.filter(cb => cb !== callback); 
    };
  };

  // Monitorar mudanças de conexão para melhorar diagnóstico
  useEffect(() => {
    console.log(`Estado da conexão alterado para: ${state.status}`);
    
    // Emitir evento quando a conexão for estabelecida
    if (state.status === 'connected') {
      document.dispatchEvent(new CustomEvent('connection-established'));
    }
    
    // Emitir evento quando a conexão for perdida
    if (state.status === 'disconnected' && !manualDisconnectRef.current) {
      document.dispatchEvent(new CustomEvent('connection-lost'));
    }
  }, [state.status]);

  // Monitorar o estado do áudio e tentar corrigir problemas
  useEffect(() => {
    const checkAudioInterval = setInterval(() => {
      if (state.status === 'connected' && audioRef.current) {
        // Garantir que o volume está no máximo
        if (audioRef.current.volume < 1.0) {
          console.log("🔊 Restaurando volume do áudio para 100%");
          audioRef.current.volume = 1.0;
        }
        
        // Verificar se o áudio está pausado quando não deveria
        if (audioRef.current.paused && !audioRef.current.ended) {
          console.log("🔄 Tentando retomar reprodução de áudio");
          audioRef.current.play().catch(err => {
            console.warn("Não foi possível retomar o áudio automaticamente:", err);
          });
        }
      }
    }, 5000); // Verificar a cada 5 segundos
    
    return () => {
      clearInterval(checkAudioInterval);
    };
  }, [state.status]);

  // Monitorar eventos do navegador para lidar com suspensão e retomada
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.status !== 'connected') {
        console.log("Página retomada - verificando conexão...");
        // Tenta reconectar se a página estiver visível mas a conexão estiver perdida
        if (!manualDisconnectRef.current) {
          connect();
        }
      }
    };
    
    const handleOnline = () => {
      console.log("Navegador ficou online - tentando reconectar...");
      if (state.status !== 'connected' && !manualDisconnectRef.current) {
        connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [state.status]);

  // Conectar automaticamente quando o componente for montado
  useEffect(() => {
    if (simulationMode) return () => {};
    const timer = setTimeout(() => connect(), 1000);
    return () => { 
      clearTimeout(timer); 
      manualDisconnectRef.current = true; // Marcar como desconexão manual
      disconnect(); 
    };
  }, [simulationMode, offlineMode]);

  const contextValue: ConnectionContextType = { 
    state, 
    connect, 
    disconnect, 
    sendMessage, 
    onAgentMessage 
  };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
      <audio 
        ref={el=>{ if(el&&!audioRef.current) audioRef.current=el; }} 
        controls 
        style={{ 
          position:'fixed', 
          bottom:'10px', 
          right:'10px', 
          zIndex:1000, 
          height:'30px',
          opacity: 0.7,
          transition: 'opacity 0.3s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
      />
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => { 
  const ctx = useContext(ConnectionContext); 
  if(!ctx) throw new Error('useConnection must be used within a ConnectionProvider'); 
  return ctx; 
};