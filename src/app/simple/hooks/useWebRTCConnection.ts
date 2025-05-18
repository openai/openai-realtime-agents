"use client";
// src/app/simple/hooks/useWebRTCConnection.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { createRealtimeConnection } from '@/app/lib/realtimeConnection';
import marleneConfig from '@/app/agentConfigs/marlene';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  sessionId: string | null;
  error: Error | null;
}

interface UseWebRTCConnectionResult {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  addMessageListener: (listener: (message: any) => void) => () => void;
}

export const useWebRTCConnection = (): UseWebRTCConnectionResult => {
  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    sessionId: null,
    error: null
  });
  // Mantém o último valor de status para funções estáveis
  const statusRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected');
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messageListenersRef = useRef<Array<(message: any) => void>>([]);
  
  // Função para conectar
  const connect = useCallback(async () => {
    console.log('[useWebRTCConnection] connect called');
    if (statusRef.current !== 'disconnected') {
      console.log('[useWebRTCConnection] connect aborted - already connecting');
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('NEXT_PUBLIC_OPENAI_API_KEY is not configured');
      setState(prev => ({
        ...prev,
        status: 'disconnected',
        error: new Error('API key missing')
      }));
      return;
    }

    setState(prev => ({ ...prev, status: 'connecting', error: null }));
    console.log('[useWebRTCConnection] requesting realtime connection');
    
    try {
      // Garantir que temos um elemento de áudio
      if (!audioRef.current) {
        audioRef.current = document.createElement('audio');
        audioRef.current.autoplay = true;
      }
      
      // Criar conexão WebRTC
      const { pc, dc } = await createRealtimeConnection(
        apiKey,
        audioRef
      );
      console.log('[useWebRTCConnection] realtime connection created');
      
      pcRef.current = pc;
      dcRef.current = dc;
      
      // Configurar handlers de eventos
      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'closed'
        ) {
          setState(prev => ({ ...prev, status: 'disconnected' }));
        }
      };
      
      dc.onopen = () => {
        console.log('[useWebRTCConnection] DataChannel opened');
        setState(prev => ({
          ...prev,
          status: 'connected',
          sessionId: Date.now().toString(),
          error: null
        }));
        
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
        console.log('[useWebRTCConnection] message received', e.data);
        try {
          const message = JSON.parse(e.data);

          // Extrair sessionId se disponível
          if (message.type === 'session.created' && message.session?.id) {
            setState(prev => ({
              ...prev,
              sessionId: message.session.id
            }));
          }

          // Retry automaticamente se a resposta falhar por limite de tokens
          if (
            message.type === 'response.done' &&
            message.response?.status === 'failed' &&
            message.response?.status_details?.error?.code === 'rate_limit_exceeded'
          ) {
            console.warn('[useWebRTCConnection] rate limit hit, will retry response');
            setTimeout(() => {
              if (dcRef.current?.readyState === 'open') {
                sendMessage({ type: 'response.create' });
              }
            }, 10000);
          }

          // Notificar todos os ouvintes registrados
          messageListenersRef.current.forEach(listener => {
            try {
              listener(message);
            } catch (err) {
              console.error('Error in message listener:', err);
            }
          });
        } catch (err) {
          console.error('Failed to parse RTC message:', err, e.data);
        }
      };
      
      dc.onerror = (err) => {
        console.warn('DataChannel error:', err);
        setState(prev => ({ 
          ...prev, 
          error: new Error('DataChannel error'),
          status: 'disconnected'
        }));
      };
      
      dc.onclose = () => {
        console.log('DataChannel closed');
        setState(prev => ({ ...prev, status: 'disconnected' }));
      };
      
    } catch (err) {
      console.error('Connection error:', err);
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err : new Error('Unknown connection error'),
        status: 'disconnected'
      }));
    }
  }, []);
  
  // Função para desconectar
  const disconnect = useCallback(() => {
    console.log('[useWebRTCConnection] disconnect called');
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
    setState(prev => ({
      ...prev,
      status: 'disconnected',
      sessionId: null
    }));
    console.log('[useWebRTCConnection] disconnected');
  }, []);
  
  // Função para enviar mensagem
  const sendMessage = useCallback((message: any): boolean => {
    try {
      if (dcRef.current && dcRef.current.readyState === 'open') {
        console.log('[useWebRTCConnection] sending message', message);
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
  }, []);
  
  // Função para adicionar ouvinte de mensagens
  const addMessageListener = useCallback((listener: (message: any) => void) => {
    messageListenersRef.current.push(listener);
    
    // Retorna função para remover o listener
    return () => {
      messageListenersRef.current = messageListenersRef.current.filter(l => l !== listener);
    };
  }, []);
  
  // Limpar na desmontagem
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    state,
    connect,
    disconnect,
    sendMessage,
    addMessageListener
  };
};