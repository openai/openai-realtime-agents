"use client";
// src/app/simple/hooks/useVerificationProcess.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useCamera } from './useCamera';
import { useConnection } from '../contexts/ConnectionContext';

interface VerificationProcessState {
  active: boolean;
  step: number;
  startTime: number | null;
  completionTime: number | null;
  error: Error | null;
}

interface UseVerificationProcessResult {
  state: VerificationProcessState;
  startVerification: () => void;
  cancelVerification: () => void;
}

export const useVerificationProcess = (): UseVerificationProcessResult => {
  const [state, setState] = useState<VerificationProcessState>({
    active: false,
    step: 0,
    startTime: null,
    completionTime: null,
    error: null
  });
  
  const { openCamera, closeCamera } = useCamera();
  const { sendMessage } = useConnection();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Limpar temporizadores ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  const startVerification = useCallback(() => {
    if (state.active) return; // Evitar iniciar mais de uma vez
    
    setState(prev => ({ 
      ...prev, 
      active: true, 
      step: 1, 
      startTime: Date.now(),
      completionTime: null,
      error: null
    }));
    
    // Abrir a câmera
    openCamera().then(success => {
      if (!success) {
        setState(prev => ({ 
          ...prev, 
          error: new Error('Failed to open camera'),
          active: false,
          step: 0
        }));
        return;
      }
      
      // Sequência de verificação simulada
      // Passo 1: Iniciando
      timerRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, step: 2 }));
        
        // Passo 2: Analisando
        sendMessage({ 
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "[VERIFICAÇÃO INICIADA]" }],
          },
        });
        
        sendMessage({ type: "response.create" });
        
        timerRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, step: 3 }));
          
          // Passo 3: Verificando identidade
          timerRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, step: 4 }));
            
            // Passo 4: Concluído
            timerRef.current = setTimeout(() => {
              // Fechar a câmera
              sendMessage({
                type: "conversation.item.create",
                item: {
                  id: Math.random().toString(36).substring(2, 15),
                  type: "function_call",
                  function: {
                    name: "close_camera",
                    arguments: "{}",
                  },
                },
              });
              
              closeCamera();
              
              // Passo 5: Finalização
              timerRef.current = setTimeout(() => {
                sendMessage({ 
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }],
                  },
                });
                
                sendMessage({ type: "response.create" });
                
                setState(prev => ({ 
                  ...prev, 
                  active: false,
                  step: 0,
                  completionTime: Date.now()
                }));
              }, 1000);
            }, 1000);
          }, 4000);
        }, 3000);
      }, 2000);
    });
  }, [state.active, openCamera, closeCamera, sendMessage]);
  
  const cancelVerification = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    closeCamera();
    setState({
      active: false,
      step: 0,
      startTime: null,
      completionTime: null,
      error: null
    });
  }, [closeCamera]);
  
  return {
    state,
    startVerification,
    cancelVerification
  };
};