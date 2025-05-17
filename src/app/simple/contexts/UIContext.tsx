"use client";

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
  const lastAnimationTimeRef = useRef<number>(0);
  
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
    console.log("💰 Setting requested loan amount:", amount);
    
    // Formatar o valor como R$ X.XXX,XX se necessário
    let formattedAmount = amount;
    if (!amount.includes('R$')) {
      formattedAmount = `R$ ${amount}`;
    }
    
    setLoanState(prev => ({
      ...prev,
      requestedAmount: formattedAmount
    }));
  };
  
  // Função para mostrar a animação do valor
  const showLoanAnimation = () => {
    // Evitar múltiplas animações em curto período
    const now = Date.now();
    if (now - lastAnimationTimeRef.current < 3000) {
      console.log("🔄 Ignorando animação - muito recente desde a última");
      return;
    }
    
    lastAnimationTimeRef.current = now;
    console.log("🎬 Showing loan animation for amount:", loanState.requestedAmount);
    
    // Disparar evento global - isso vai garantir que outros componentes saibam
    try {
      document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
    } catch (e) {
      console.error("Erro ao disparar evento global:", e);
    }
    
    // Apenas mostrar se houver um valor de empréstimo definido
    if (!loanState.requestedAmount) {
      console.warn("⚠️ Tentando mostrar animação sem valor definido");
      // Definir um valor padrão para debug
      setLoanState(prev => ({
        ...prev,
        requestedAmount: 'R$ 10.000,00',
        showAnimation: true,
        animationProgress: 0
      }));
    } else {
      setLoanState(prev => ({
        ...prev,
        showAnimation: true,
        animationProgress: 0
      }));
    }
    
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
  
  // Escuta eventos globais para detecção de valor e animação
  useEffect(() => {
    // Handler para detectar valor
    const handleDetectAmount = (e: CustomEvent) => {
      console.log("🔍 Evento detect-loan-amount capturado:", e.detail);
      if (e.detail && e.detail.amount) {
        setRequestedLoanAmount(e.detail.amount);
      }
    };
    
    // Handler para acionar animação
    const handleAnimationTrigger = () => {
      console.log("🎬 Evento loan-animation-trigger capturado");
      
      // Verificar se temos um valor definido
      if (!loanState.requestedAmount) {
        console.log("⚠️ Nenhum valor definido ao acionar animação. Definindo padrão...");
        setRequestedLoanAmount('R$ 10.000,00');
      }
      
      // Definir estado da animação diretamente, não apenas via showLoanAnimation
      // Isso garante que a animação aconteça mesmo se os timers estiverem bagunçados
      setLoanState(prev => ({
        ...prev,
        showAnimation: true,
        animationProgress: 0
      }));
      
      // Animar o progresso
      const startTime = Date.now();
      const duration = 2000; // 2 segundos para animação completa
      
      // Limpar qualquer animação anterior
      if (loanAnimationTimerRef.current) {
        window.cancelAnimationFrame(loanAnimationTimerRef.current);
      }
      
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
        setLoanState(prev => ({ ...prev, showAnimation: false }));
      }, 8000);
    };
    
    // Adicionar event listeners
    document.addEventListener('detect-loan-amount', handleDetectAmount as EventListener);
    document.addEventListener('loan-animation-trigger', handleAnimationTrigger);
    
    // Remover event listeners na desmontagem
    return () => {
      document.removeEventListener('detect-loan-amount', handleDetectAmount as EventListener);
      document.removeEventListener('loan-animation-trigger', handleAnimationTrigger);
    };
  }, [loanState.requestedAmount]);
  
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
  
  // Função para extrair e normalizar valor monetário de um texto
  const extractMoneyValue = (text: string) => {
    // Padrão para detectar valores monetários (R$ 1.000,00 ou 1000 ou mil)
    const moneyRegex = /R\$\s*(\d{1,3}(\.\d{3})*(\,\d{1,2})?|\d+)|(\d+)\s*(mil|milhão|milhões)/i;
    const match = text.match(moneyRegex);
    
    if (match) {
      console.log("💰 Raw money match:", match[0]);
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
      
      // Se não começar com R$, adicionar
      if (!amount.includes('R$')) {
        amount = `R$ ${amount}`;
      }
      
      console.log("💰 Formatted money amount:", amount);
      return amount;
    }
    
    return null;
  }
  
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
        
        const content = Array.isArray(msg.item.content) 
          ? msg.item.content[0]?.text || '' 
          : typeof msg.item.content === 'string' 
            ? msg.item.content 
            : '';
        
        console.log("💬 Mensagem do usuário:", content);
        const amount = extractMoneyValue(content);
        
        if (amount) {
          console.log("💰 Valor monetário detectado na mensagem do usuário:", amount);
          setRequestedLoanAmount(amount);
          
          // Quando o usuário menciona um valor, não mostramos a animação ainda
          // Esperamos que o agente repita o valor ou use a ferramenta animate_loan_value
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
        
        console.log("💬 Mensagem do agente:", content);
        
        // Normalizar tanto o valor solicitado quanto o conteúdo para comparação
        const normalizeForComparison = (text: string) => {
          return text.replace(/[R$\s\.]/g, '').replace(',', '.').toLowerCase();
        };
        
        const normalizedRequestedAmount = normalizeForComparison(loanState.requestedAmount);
        
        // Procurar por valores monetários na mensagem do agente
        const moneyRegex = /R\$\s*(\d{1,3}(\.\d{3})*(\,\d{1,2})?|\d+)|(\d+)\s*(mil|milhão|milhões)/gi;
        let match;
        let foundMatch = false;
        
        while ((match = moneyRegex.exec(content)) !== null) {
          const rawValue = match[0];
          console.log("💰 Encontrado valor monetário na mensagem do agente:", rawValue);
          
          // Normalizar o valor encontrado
          const normalizedValue = normalizeForComparison(rawValue);
          
          // Verificar se é o mesmo valor que o usuário solicitou
          // Sendo mais flexível na comparação
          if (normalizedValue === normalizedRequestedAmount || 
              (parseFloat(normalizedValue) > 0 && 
              Math.abs(parseFloat(normalizedValue) - parseFloat(normalizedRequestedAmount)) < 1)) {
            
            console.log("🎯 Agente mencionou o valor solicitado pelo usuário! Acionando animação!");
            foundMatch = true;
            
            // Acionar a animação após um pequeno atraso para sincronizar com a fala
            setTimeout(() => {
              showLoanAnimation();
            }, 300);
            
            break;
          }
        }
        
        // Se não encontrou nenhuma correspondência mas a mensagem é pequena e contém algum valor,
        // acionar a animação de qualquer maneira (pode ser uma confirmação simples)
        if (!foundMatch && content.length < 100 && moneyRegex.test(content)) {
          console.log("⚠️ Nenhuma correspondência exata, mas mensagem curta com valor monetário. Acionando animação.");
          setTimeout(() => {
            showLoanAnimation();
          }, 300);
        }
      }
      
      // Detectar quando o agente usa funções específicas
      if (msg.type === 'response.done' && 
          msg.response?.output) {
        
        // Verificar cada item de saída
        msg.response.output.forEach((output: any) => {
          // Detectar especificamente chamadas da função animate_loan_value
          if (output.type === 'function_call' && 
              output.name === 'animate_loan_value') {
            
            console.log("🎭 Função animate_loan_value detectada!");
            
            // Verificar se temos argumentos e tentar extrair um valor específico
            if (output.arguments) {
              try {
                const args = JSON.parse(output.arguments);
                console.log("🎭 Argumentos da função:", args);
                
                if (args.amount) {
                  console.log("🎭 Definindo valor da animação:", args.amount);
                  setRequestedLoanAmount(args.amount);
                }
              } catch (e) {
                console.error("Erro ao analisar argumentos da função:", e);
              }
            }
            
            // Acionar a animação após um pequeno atraso
            setTimeout(() => {
              console.log("🎭 Acionando animação a partir da chamada de função");
              showLoanAnimation();
            }, 300);
          }
        });
      }
      
      // Processar chamadas de função
      if (msg.type === 'response.done' && Array.isArray(msg.response?.output)) {
        msg.response.output.forEach((item: any) => {
          // Processar eventos de UI
          if (item.type === 'function_call' && item.name === 'ui_event' && item.arguments) {
            try {
              const args = JSON.parse(item.arguments);
              addUIEvent(args);
            } catch (err) {
              console.error('Failed to parse ui_event arguments:', err, item.arguments);
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
  
  // Logging do estado de animação quando muda
  useEffect(() => {
    console.log("🔄 Estado de animação atualizado:", loanState);
  }, [loanState]);
  
  const contextValue: UIContextType = {
    // Valores existentes
    uiEvents,
    cameraRequests,
    currentTime,
    agentIsSpeaking,
    userIsSpeaking,
    speechIntensity,
    isAudioPlaybackEnabled,
    addUIEvent,
    addCameraRequest,
    removeCameraRequest,
    setSpeechIntensity,
    setUserIsSpeaking,
    setIsAudioPlaybackEnabled,
    
    // Valores para o empréstimo
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