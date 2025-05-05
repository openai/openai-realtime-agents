// src/app/simple/contexts/VerificationContext.tsx
import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { VerificationState } from '../types';
import { useConnection } from './ConnectionContext';
import { useCamera } from './CameraContext';

// Estado inicial
const initialState: VerificationState = {
  active: false,
  step: 0,
  startTime: null,
  completionTime: null,
  error: null,
};

// Tipos de ações
type VerificationAction = 
  | { type: 'START_VERIFICATION' }
  | { type: 'SET_STEP', step: number }
  | { type: 'COMPLETE_VERIFICATION' }
  | { type: 'CANCEL_VERIFICATION' }
  | { type: 'VERIFICATION_ERROR', error: Error };

// Reducer
const verificationReducer = (state: VerificationState, action: VerificationAction): VerificationState => {
  switch (action.type) {
    case 'START_VERIFICATION':
      return { 
        ...state, 
        active: true, 
        step: 1, 
        startTime: Date.now(), 
        completionTime: null,
        error: null,
      };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'COMPLETE_VERIFICATION':
      return { 
        ...state, 
        active: false, 
        step: 0, 
        completionTime: Date.now() 
      };
    case 'CANCEL_VERIFICATION':
      return { 
        ...initialState 
      };
    case 'VERIFICATION_ERROR':
      return { 
        ...state, 
        error: action.error, 
        active: false, 
        step: 0 
      };
    default:
      return state;
  }
};

// Tipo do contexto
interface VerificationContextType {
  state: VerificationState;
  startVerification: () => void;
  cancelVerification: () => void;
}

// Criar o contexto
const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

// Provider
export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(verificationReducer, initialState);
  const { sendMessage } = useConnection();
  const { openCamera, closeCamera } = useCamera();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Limpar temporizadores ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  // Função para iniciar a verificação
  const startVerification = () => {
    if (state.active) return; // Evitar iniciar mais de uma vez
    
    dispatch({ type: 'START_VERIFICATION' });
    
    // Abrir a câmera
    openCamera().then(success => {
      if (!success) {
        dispatch({ 
          type: 'VERIFICATION_ERROR', 
          error: new Error('Failed to open camera') 
        });
        return;
      }
      
      // Sequência de verificação simulada
      // Passo 1: Iniciando
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_STEP', step: 2 });
        
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
          dispatch({ type: 'SET_STEP', step: 3 });
          
          // Passo 3: Verificando identidade
          timerRef.current = setTimeout(() => {
            dispatch({ type: 'SET_STEP', step: 4 });
            
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
                
                dispatch({ type: 'COMPLETE_VERIFICATION' });
              }, 1000);
            }, 1000);
          }, 4000);
        }, 3000);
      }, 2000);
    });
  };
  
  // Função para cancelar a verificação
  const cancelVerification = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    closeCamera();
    dispatch({ type: 'CANCEL_VERIFICATION' });
  };
  
  const contextValue: VerificationContextType = {
    state,
    startVerification,
    cancelVerification,
  };
  
  return (
    <VerificationContext.Provider value={contextValue}>
      {children}
    </VerificationContext.Provider>
  );
};

// Hook para usar o contexto
export const useVerification = () => {
  const context = useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};