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
  faceDetectionStatus: {
    detected: false,
    centered: false,
    verified: false
  }
};

// Tipos de ações
type VerificationAction = 
  | { type: 'START_VERIFICATION' }
  | { type: 'SET_STEP', step: number }
  | { type: 'COMPLETE_VERIFICATION' }
  | { type: 'CANCEL_VERIFICATION' }
  | { type: 'VERIFICATION_ERROR', error: Error }
  | { type: 'FACE_STATUS', status: 'detected' | 'centered' | 'verified', value: boolean };

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
        faceDetectionStatus: {
          detected: false,
          centered: false,
          verified: false
        }
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
      return initialState;
    case 'VERIFICATION_ERROR':
      return { 
        ...state, 
        error: action.error, 
        active: false, 
        step: 0 
      };
    case 'FACE_STATUS':
      return {
        ...state,
        faceDetectionStatus: {
          ...state.faceDetectionStatus,
          [action.status]: action.value
        }
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
  const cameraEventListenerRef = useRef<EventListener | null>(null);
  
  // Limpar temporizadores ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      if (cameraEventListenerRef.current) {
        document.removeEventListener('camera-event', cameraEventListenerRef.current);
      }
    };
  }, []);
  
  // Função para iniciar a verificação
  const startVerification = () => {
    if (state.active) return; // Evitar iniciar mais de uma vez
    
    dispatch({ type: 'START_VERIFICATION' });
    
    // Configurar listener para eventos da câmera
    const handleCameraEvent = (event: CustomEvent) => {
      const { type, direction } = event.detail;
      
      console.log("Camera event received:", type, direction);
      
      switch (type) {
        case 'CAMERA_OPENED':
          // Marlene reconhece que a câmera foi aberta
          sendMessage({ 
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "[CÂMERA ABERTA]" }],
            },
          });
          sendMessage({ type: "response.create" });
          dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          break;
          
        case 'FACE_NOT_VISIBLE':
          // Marlene não consegue ver o rosto
          if (state.faceDetectionStatus.detected) {
            sendMessage({ 
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "[ROSTO NÃO VISÍVEL]" }],
              },
            });
            sendMessage({ type: "response.create" });
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          }
          break;
          
        case 'FACE_NEEDS_ADJUSTMENT':
          // Marlene dá instruções para ajustar posição
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            
            sendMessage({ 
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: `[AJUSTE NECESSÁRIO${direction}]` }],
              },
            });
            sendMessage({ type: "response.create" });
          }
          break;
          
        case 'FACE_CENTERED':
          // Marlene confirma que o rosto está centralizado
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            dispatch({ type: 'FACE_STATUS', status: 'centered', value: true });
            dispatch({ type: 'SET_STEP', step: 2 });
            
            sendMessage({ 
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "[ROSTO CENTRALIZADO]" }],
              },
            });
            sendMessage({ type: "response.create" });
            
            // Avançar para verificação após um breve atraso
            timerRef.current = setTimeout(() => {
              if (!state.faceDetectionStatus.verified) {
                dispatch({ type: 'SET_STEP', step: 3 });
                
                sendMessage({ 
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "[VERIFICANDO IDENTIDADE]" }],
                  },
                });
                sendMessage({ type: "response.create" });
                
                // Simular verificação de identidade (tempo para reconhecimento)
                timerRef.current = setTimeout(() => {
                  dispatch({ type: 'FACE_STATUS', status: 'verified', value: true });
                  dispatch({ type: 'SET_STEP', step: 4 });
                  
                  sendMessage({ 
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "user",
                      content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }],
                    },
                  });
                  sendMessage({ type: "response.create" });
                  
                  // Fechar a câmera automaticamente
                  timerRef.current = setTimeout(() => {
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
                    
                    // Completar verificação e avançar na máquina de estados
                    dispatch({ type: 'COMPLETE_VERIFICATION' });
                    
                    // Avançar para o próximo estado da Marlene
                    timerRef.current = setTimeout(() => {
                      sendMessage({ 
                        type: "conversation.item.create",
                        item: {
                          type: "message",
                          role: "user",
                          content: [{ type: "input_text", text: "[AVANÇAR PARA SIMULAÇÃO DE EMPRÉSTIMO]" }],
                        },
                      });
                      sendMessage({ type: "response.create" });
                    }, 1000);
                  }, 3000);
                }, 2000);
              }
            }, 2000);
          }
          break;
          
        case 'CAMERA_CLOSED':
          // Câmera fechada, avançar na máquina de estados se verificação foi concluída
          if (state.faceDetectionStatus.verified) {
            // Aqui você poderia adicionar lógica adicional para avançar definitivamente
            // na máquina de estados da Marlene
          }
          break;
      }
    };
    
    // Registrar o listener
    cameraEventListenerRef.current = handleCameraEvent as EventListener;
    document.addEventListener('camera-event', cameraEventListenerRef.current);
    
    // IMPORTANTE: NÃO abrimos a câmera automaticamente aqui!
    // Em vez disso, o PhoneMockup.tsx vai abrir a câmera quando o usuário clicar no balão
    // Apenas configuramos o listener para os eventos
    
    // Passo 1: Iniciando
    dispatch({ type: 'SET_STEP', step: 1 });
  };
  
  // Função para cancelar a verificação
  const cancelVerification = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Remover listener
    if (cameraEventListenerRef.current) {
      document.removeEventListener('camera-event', cameraEventListenerRef.current);
      cameraEventListenerRef.current = null;
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