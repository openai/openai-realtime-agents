// src/app/simple/contexts/UIContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UIEvent, CameraRequest, LoanState } from '../types';
import { useConnection } from './ConnectionContext';

// Tipo do contexto
interface UIContextType {
  // Estados existentes
  uiEvents: UIEvent[];
  cameraRequests: CameraRequest[];
  currentTime: string;
  agentIsSpeaking: boolean;
  userIsSpeaking: boolean;
  speechIntensity: number;
  isAudioPlaybackEnabled: boolean;
  isTransitioning: boolean;
  
  // Funções existentes
  addUIEvent: (event: UIEvent) => void;
  addCameraRequest: (left: number) => string;
  removeCameraRequest: (id: string) => void;
  setSpeechIntensity: (intensity: number) => void;
  setUserIsSpeaking: (isSpeaking: boolean) => void;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
  
  // Estados e funções para valor de empréstimo
  loanState: LoanState;
  setRequestedLoanAmount: (amount: string) => void;
  showLoanAnimation: () => void;
  hideLoanAnimation: () => void;
}

// Criar o contexto
const UIContext = createContext<UIContextType | undefined>(undefined);

// Provider
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estados existentes
  const [uiEvents, setUIEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [agentIsSpeaking, setAgentIsSpeaking] = useState<boolean>(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState<boolean>(false);
  const [speechIntensity, setSpeechIntensity] = useState<number>(0);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Estado do empréstimo
  const [loanState, setLoanState] = useState<LoanState>({
    requestedAmount: null,
    showAnimation: false,
    animationProgress: 0
  });
  
  // Referências para temporizadores
  const agentSpeakingTimerRef = useRef<number | null>(null);
  const userSpeakingTimerRef = useRef<number | null>(null);
  const loanAnimationTimerRef = useRef<number | null>(null);
  
  const { onAgentMessage } = useConnection();
  
  // Debounced state setters (código existente)
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
  
  // Função para definir o valor do empréstimo solicitado
  const setRequestedLoanAmount = (amount: string) => {
    console.log("Setting requested loan amount:", amount);
    
    // Formatar o valor como R$ X.XXX,XX
    // Remover quaisquer caracteres não numéricos, exceto vírgulas e pontos
    const cleanAmount = amount.replace(/[^\d,.]/g, '');
    
    let formattedAmount;
    if (amount.includes('R$') || amount.match(/^\d+(\.\d{3})*(,\d{2})?$/)) {
      // Já está formatado como R$ ou como número com separadores
      formattedAmount = amount.includes('R$') ? amount : `R$ ${cleanAmount}`;
    } else {
      try {
        // Converter para número - substituir vírgula por ponto para parse
        const numberValue = parseFloat(cleanAmount.replace(',', '.'));
        formattedAmount = isNaN(numberValue) ? amount : `R$ ${numberValue.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      } catch (e) {
        // Se falhar, usar o valor original
        formattedAmount = amount;
      }
    }
    
    setLoanState(prev => ({
      ...prev,
      requestedAmount: formattedAmount
    }));
  };
  
  // Função para mostrar a animação do valor
  const showLoanAnimation = () => {
    console.log("Showing loan animation for amount:", loanState.requestedAmount);
    
    // Apenas mostrar se houver um valor de empréstimo definido
    if (loanState.requestedAmount) {
      setLoanState(prev => ({
        ...prev,
        showAnimation: true,
        animationProgress: 0
      }));
      
      // Animar o progresso
      const startTime = Date.now();
      const duration = 2000; // 2 segundos para animação completa
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / duration) * 100);
        
        setLoanState(prev => ({
          ...prev,
          animationProgress: progress
        }));
        
        if (progress < 100) {
          loanAnimationTimerRef.current = window.requestAnimationFrame(updateProgress);
        }
      };
      
      loanAnimationTimerRef.current = window.requestAnimationFrame(updateProgress);
      
      // Esconder após um tempo
      setTimeout(() => {
        hideLoanAnimation();
      }, 8000);
    }
  };
  
  // Função para esconder a animação
  const hideLoanAnimation = () => {
    setLoanState(prev => ({
      ...prev,
      showAnimation: false
    }));
    
    if (loanAnimationTimerRef.current) {
      window.cancelAnimationFrame(loanAnimationTimerRef.current);
      loanAnimationTimerRef.current = null;
    }
  };
  
  // Função para adicionar evento de UI (existente)
  const addUIEvent = (event: UIEvent) => {
    setUIEvents(prev => [...prev, event]);
    // Remover após 3 segundos
    setTimeout(() => {
      setUIEvents(prev => prev.filter(e => e !== event));
    }, 3000);
  };
  
  // Função para adicionar solicitação de câmera (existente)
  const addCameraRequest = (left: number): string => {
    const id = Math.random().toString(36).substring(2, 15);
    setCameraRequests(prev => [...prev, { id, left }]);
    return id;
  };
  
  // Função para remover solicitação de câmera (existente)
  const removeCameraRequest = (id: string) => {
    setCameraRequests(prev => prev.filter(req => req.id !== id));
  };
  
  // Atualizar o relógio a cada minuto (código existente)
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
  
  // Subscrever para mensagens do agente para detectar quando mencionar o valor do empréstimo
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
      
      // Detectar quando o usuário menciona valores monetários
      if (msg.type === 'conversation.item.created' && 
          msg.item?.role === 'user' && 
          msg.item?.content) {
        
        const content = msg.item.content[0]?.text || '';
        
        // Padrão para detectar valores monetários (R$ 1.000,00 ou 1000 ou mil)
        const moneyRegex = /R\$\s*(\d{1,3}(\.\d{3})*(\,\d{1,2})?|\d+)|(\d+)\s*(mil|milhão|milhões)/i;
        const match = content.match(moneyRegex);
        
        if (match) {
          console.log("Detected money amount in user message:", match[0]);
          let amount = match[0];
          
          // Se for "mil" ou similar, converter para número
          if (match[5] && match[4]) {
            const baseNumber = parseInt(match[4], 10);
            if (match[5].toLowerCase() === 'mil') {
              amount = `R$ ${(baseNumber * 1000).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}`;
            } else if (match[5].toLowerCase() === 'milhão' || match[5].toLowerCase() === 'milhões') {
              amount = `R$ ${(baseNumber * 1000000).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}`;
            }
          }
          
          setRequestedLoanAmount(amount);
        }
      }
      
      // Detectar quando o agente menciona o valor de empréstimo
      if (msg.type === 'conversation.item.created' && 
          msg.item?.role === 'assistant' && 
          msg.item?.content && 
          loanState.requestedAmount) {
        
        const content = Array.isArray(msg.item.content) 
          ? msg.item.content[0]?.text || '' 
          : typeof msg.item.content === 'string' 
            ? msg.item.content 
            : '';
        
        // Remover R$ e formatar para comparação
        const cleanAmount = loanState.requestedAmount.replace(/R\$\s*/, '').trim();
        
        // Verificar se o texto contém o valor do empréstimo
        if (content.includes(cleanAmount) || content.includes(loanState.requestedAmount)) {
          console.log("Agent is mentioning the loan amount:", loanState.requestedAmount);
          showLoanAnimation();
        }
      }
      
      // Detectar quando o agente menciona a ferramenta animate_loan_value
      if (msg.type === 'response.done' && 
          Array.isArray(msg.response?.output)) {
        
        for (const output of msg.response.output) {
          if (output.type === 'function_call' && 
              output.name === 'animate_loan_value') {
            console.log("Detected animate_loan_value function call");
            showLoanAnimation();
            break;
          }
        }
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
  }, [onAgentMessage, loanState.requestedAmount]);
  
  // Limpar temporizadores na desmontagem
  useEffect(() => {
    return () => {
      if (agentSpeakingTimerRef.current !== null) {
        clearTimeout(agentSpeakingTimerRef.current);
      }
      if (userSpeakingTimerRef.current !== null) {
        clearTimeout(userSpeakingTimerRef.current);
      }
      if (loanAnimationTimerRef.current) {
        window.cancelAnimationFrame(loanAnimationTimerRef.current);
      }
    };
  }, []);
  
  const contextValue: UIContextType = {
    // Valores existentes
    uiEvents,
    cameraRequests,
    currentTime,
    agentIsSpeaking,
    userIsSpeaking,
    speechIntensity,
    isAudioPlaybackEnabled,
    isTransitioning,
    addUIEvent,
    addCameraRequest,
    removeCameraRequest,
    setSpeechIntensity,
    setUserIsSpeaking,
    setIsAudioPlaybackEnabled,
    
    // Novos valores para o empréstimo
    loanState,
    setRequestedLoanAmount,
    showLoanAnimation,
    hideLoanAnimation
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