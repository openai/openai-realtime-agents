// src/app/simple/contexts/UIContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UIEvent, CameraRequest } from '../types';
import { useConnection } from './ConnectionContext';

// Tipo do contexto
interface UIContextType {
  uiEvents: UIEvent[];
  cameraRequests: CameraRequest[];
  currentTime: string;
  agentIsSpeaking: boolean;
  userIsSpeaking: boolean;
  speechIntensity: number;
  addUIEvent: (event: UIEvent) => void;
  addCameraRequest: (left: number) => string;
  removeCameraRequest: (id: string) => void;
  setSpeechIntensity: (intensity: number) => void;
  setUserIsSpeaking: (isSpeaking: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
}

// Criar o contexto
const UIContext = createContext<UIContextType | undefined>(undefined);

// Provider
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiEvents, setUIEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [agentIsSpeaking, setAgentIsSpeaking] = useState<boolean>(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState<boolean>(false);
  const [speechIntensity, setSpeechIntensity] = useState<number>(0);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);
  
  // Debounce timers to prevent rapid state changes
  const agentSpeakingTimerRef = useRef<number | null>(null);
  const userSpeakingTimerRef = useRef<number | null>(null);
  
  const { onAgentMessage } = useConnection();
  
  // Debounced state setters
  const setAgentSpeakingDebounced = (isSpeaking: boolean, delay: number = 300) => {
    // Clear any pending timer
    if (agentSpeakingTimerRef.current !== null) {
      clearTimeout(agentSpeakingTimerRef.current);
      agentSpeakingTimerRef.current = null;
    }
    
    if (!isSpeaking && agentIsSpeaking) {
      // If turning off agent speaking, delay the transition
      agentSpeakingTimerRef.current = window.setTimeout(() => {
        setAgentIsSpeaking(false);
      }, delay);
    } else if (isSpeaking && !agentIsSpeaking) {
      // If turning on agent speaking, do it immediately but turn off user speaking
      setAgentIsSpeaking(true);
      setUserIsSpeaking(false);
    }
  };
  
  const setUserSpeakingDebounced = (isSpeaking: boolean, delay: number = 300) => {
    // Clear any pending timer
    if (userSpeakingTimerRef.current !== null) {
      clearTimeout(userSpeakingTimerRef.current);
      userSpeakingTimerRef.current = null;
    }
    
    if (!isSpeaking && userIsSpeaking) {
      // If turning off user speaking, delay the transition
      userSpeakingTimerRef.current = window.setTimeout(() => {
        setUserIsSpeaking(false);
      }, delay);
    } else if (isSpeaking && !userIsSpeaking) {
      // If turning on user speaking, do it immediately but turn off agent speaking
      setUserIsSpeaking(true);
      setAgentIsSpeaking(false);
    }
  };
  
  // Atualizar o relógio a cada minuto
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    
    updateClock(); // Inicializar imediatamente
    const clockInterval = setInterval(updateClock, 60000); // Atualizar a cada minuto
    
    return () => clearInterval(clockInterval);
  }, []);
  
  // Função para simular alternância de fala para debug - com transições mais suaves
  useEffect(() => {
    // Para testar, simule a alternância entre falantes a cada 6 segundos (mais lento)
    const testInterval = setInterval(() => {
      if (agentIsSpeaking) {
        // Se o agente está falando, simule o usuário falando
        console.log("DEBUG: Simulando usuário falando");
        setAgentSpeakingDebounced(false, 800); // Fade out longer
        
        // Wait for fade out before starting the user speaking
        setTimeout(() => {
          setUserSpeakingDebounced(true);
        }, 1000);
      } else if (userIsSpeaking) {
        // Se o usuário está falando, simule o agente falando
        console.log("DEBUG: Simulando agente falando");
        setUserSpeakingDebounced(false, 800);
        
        // Wait for fade out before starting the agent speaking
        setTimeout(() => {
          setAgentSpeakingDebounced(true);
        }, 1000);
      } else {
        // Se ninguém está falando, comece com o agente
        console.log("DEBUG: Iniciando ciclo com agente falando");
        setAgentSpeakingDebounced(true);
      }
    }, 6000); // Alternar a cada 6 segundos para uma demonstração mais natural
    
    return () => clearInterval(testInterval);
  }, [agentIsSpeaking, userIsSpeaking]);
  
  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (agentSpeakingTimerRef.current !== null) {
        clearTimeout(agentSpeakingTimerRef.current);
      }
      if (userSpeakingTimerRef.current !== null) {
        clearTimeout(userSpeakingTimerRef.current);
      }
    };
  }, []);
  
  // Subscrever para mensagens do agente
  useEffect(() => {
    if (!onAgentMessage) return () => {};
    
    const unsubscribe = onAgentMessage((msg) => {
      // Detectar quando o agente começa e termina de falar
      if (msg.type === 'audio_started') {
        console.log("🎤 Agente começou a falar");
        setAgentSpeakingDebounced(true);
      } else if (msg.type === 'audio_ended') {
        console.log("🔇 Agente terminou de falar");
        setAgentSpeakingDebounced(false, 800); // Slower fade-out
        setSpeechIntensity(0);
      } else if (msg.type === 'output_audio_buffer.started') {
        console.log("🔊 Buffer de áudio de saída iniciado");
        setAgentSpeakingDebounced(true);
      } else if (msg.type === 'output_audio_buffer.stopped') {
        console.log("🔇 Buffer de áudio de saída parado");
        setAgentSpeakingDebounced(false, 800); // Slower fade-out
      } else if (msg.type === 'input_audio_buffer.started') {
        // Quando o microfone do usuário estiver ativo
        console.log("🎙️ Usuário começou a falar");
        setUserSpeakingDebounced(true);
      } else if (msg.type === 'input_audio_buffer.stopped' || 
                 msg.type === 'input_audio_buffer.clear') {
        // Quando o microfone do usuário for desativado
        console.log("🔇 Usuário terminou de falar");
        setUserSpeakingDebounced(false, 800); // Slower fade-out
      }
      
      // Processar chamadas de função
      if (msg.type === 'response.done' && Array.isArray(msg.response?.output)) {
        msg.response.output.forEach((item) => {
          // Processar eventos de UI
          if (item.type === 'function_call' && item.name === 'ui_event' && item.arguments) {
            try {
              const args = JSON.parse(item.arguments);
              addUIEvent(args);
            } catch (err) {
              console.error('Failed to parse ui_event arguments:', item.arguments);
            }
          }
          
          // Processar solicitações de câmera
          if (item.type === 'function_call' && item.name === 'open_camera') {
            addCameraRequest(50); // Posição padrão
          }
        });
      }
    });
    
    return unsubscribe;
  }, [onAgentMessage]);
  
  // Função para adicionar evento de UI
  const addUIEvent = (event: UIEvent) => {
    setUIEvents(prev => [...prev, event]);
    // Remover após 3 segundos
    setTimeout(() => {
      setUIEvents(prev => prev.filter(e => e !== event));
    }, 3000);
  };
  
  // Função para adicionar solicitação de câmera
  const addCameraRequest = (left: number): string => {
    const id = Math.random().toString(36).substring(2, 15);
    setCameraRequests(prev => [...prev, { id, left }]);
    return id;
  };
  
  // Função para remover solicitação de câmera
  const removeCameraRequest = (id: string) => {
    setCameraRequests(prev => prev.filter(req => req.id !== id));
  };
  
  const contextValue: UIContextType = {
    uiEvents,
    cameraRequests,
    currentTime,
    agentIsSpeaking,
    userIsSpeaking,
    speechIntensity,
    isAudioPlaybackEnabled,
    setIsAudioPlaybackEnabled,
    addUIEvent,
    addCameraRequest,
    removeCameraRequest,
    setSpeechIntensity,
    setUserIsSpeaking,
  };
  
  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  );
};

// Hook para usar o contexto
export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};