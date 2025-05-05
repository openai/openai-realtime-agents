// src/app/simple/contexts/UIContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UIEvent, CameraRequest } from '../types';
import { useConnection } from './ConnectionContext';

// Tipo do contexto
interface UIContextType {
  uiEvents: UIEvent[];
  cameraRequests: CameraRequest[];
  currentTime: string;
  agentIsSpeaking: boolean;
  speechIntensity: number;
  addUIEvent: (event: UIEvent) => void;
  addCameraRequest: (left: number) => string;
  removeCameraRequest: (id: string) => void;
  setSpeechIntensity: (intensity: number) => void;
}

// Criar o contexto
const UIContext = createContext<UIContextType | undefined>(undefined);

// Provider
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiEvents, setUIEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [agentIsSpeaking, setAgentIsSpeaking] = useState<boolean>(false);
  const [speechIntensity, setSpeechIntensity] = useState<number>(0);
  
  const { onAgentMessage } = useConnection();
  
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
  
  // Subscrever para mensagens do agente
  useEffect(() => {
    const unsubscribe = onAgentMessage((msg) => {
      // Detectar quando o agente começa e termina de falar
      if (msg.type === 'audio_started') {
        setAgentIsSpeaking(true);
      } else if (msg.type === 'audio_ended') {
        setAgentIsSpeaking(false);
        setSpeechIntensity(0);
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
    speechIntensity,
    addUIEvent,
    addCameraRequest,
    removeCameraRequest,
    setSpeechIntensity,
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