"use client";

// src/app/simple/contexts/SimulationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface SimulationContextType {
  simulationMode: boolean;
  setSimulationMode: (mode: boolean) => void;
  offlineMode: boolean;
  setOfflineMode: (mode: boolean) => void;
}

// Criar o contexto
const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

// Provider
export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  
  // Verificar localStorage na montagem para persistir configurações
  useEffect(() => {
    const savedSimMode = localStorage.getItem('simulation_mode');
    const savedOfflineMode = localStorage.getItem('offline_mode');
    
    if (savedSimMode) {
      setSimulationMode(savedSimMode === 'true');
    }
    
    if (savedOfflineMode) {
      setOfflineMode(savedOfflineMode === 'true');
    }
  }, []);
  
  // Salvar no localStorage quando mudarem
  useEffect(() => {
    localStorage.setItem('simulation_mode', simulationMode.toString());
  }, [simulationMode]);
  
  useEffect(() => {
    localStorage.setItem('offline_mode', offlineMode.toString());
  }, [offlineMode]);
  
  // Adicionar ouvintes para eventos de função
  useEffect(() => {
    if (!simulationMode) return;
    
    const handleFunctionDetected = (e: CustomEvent) => {
      // Se estamos em modo de simulação e a função foi acionada
      console.log("🧪 Função detectada no modo simulação:", e.detail);
      
      // Processar função com base no tipo
      if (e.detail?.name) {
        switch (e.detail.name) {
          case 'open_camera':
            // Disparar evento de câmera
            processCameraOpen();
            break;
            
          case 'close_camera':
            // Disparar evento de fechamento de câmera
            processCameraClose();
            break;
            
          case 'ui_event':
            // Processar evento de UI
            processUIEvent(e.detail.arguments);
            break;
            
          case 'animate_loan_value':
            // Esta função é tratada diretamente pelo UIContext
            // A animação será acionada automaticamente
            break;
            
          default:
            console.log("Função não implementada no modo simulação:", e.detail.name);
        }
      }
    };
    
    // Registrar listener
    document.addEventListener('function-detected', handleFunctionDetected as EventListener);
    
    // Limpar listener
    return () => {
      document.removeEventListener('function-detected', handleFunctionDetected as EventListener);
    };
  }, [simulationMode]);
  
  // Funções auxiliares para processar eventos simulados
  
  const processCameraOpen = () => {
    // Criar evento simulado para abrir câmera
    const simulatedEvent = {
      type: 'camera_request',
      position: 50 // posição central na tela
    };
    
    // Disparar evento para quem estiver ouvindo
    document.dispatchEvent(new CustomEvent('simulated-camera-request', {
      detail: simulatedEvent
    }));
  };
  
  const processCameraClose = () => {
    // Criar evento simulado para fechar câmera
    document.dispatchEvent(new CustomEvent('simulated-camera-close'));
  };
  
  const processUIEvent = (argsString: string) => {
    try {
      // Analisar argumentos
      const args = JSON.parse(argsString);
      
      // Criar evento simulado de UI
      document.dispatchEvent(new CustomEvent('simulated-ui-event', {
        detail: args
      }));
    } catch (e) {
      console.error("Erro ao processar argumentos do ui_event:", e);
    }
  };
  
  return (
    <SimulationContext.Provider value={{
      simulationMode,
      setSimulationMode,
      offlineMode,
      setOfflineMode
    }}>
      {children}
    </SimulationContext.Provider>
  );
};

// Hook para acessar o contexto
export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};