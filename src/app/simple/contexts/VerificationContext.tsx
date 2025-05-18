"use client";

// src/app/simple/contexts/VerificationContext.tsx
import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { VerificationState } from '../types';
import { useConnection } from './ConnectionContext';
import { useCamera } from './CameraContext';
import { setCameraVerified } from "@/app/agentConfigs/utils";

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
  },
  pendingMessages: [] // Nova propriedade para armazenar mensagens pendentes
};

// Tipos de ações
type VerificationAction = 
  | { type: 'START_VERIFICATION' }
  | { type: 'SET_STEP', step: number }
  | { type: 'COMPLETE_VERIFICATION' }
  | { type: 'CANCEL_VERIFICATION' }
  | { type: 'VERIFICATION_ERROR', error: Error }
  | { type: 'FACE_STATUS', status: 'detected' | 'centered' | 'verified', value: boolean }
  | { type: 'ADD_PENDING_MESSAGE', message: any }
  | { type: 'CLEAR_PENDING_MESSAGES' };

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
        },
        pendingMessages: []
      };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'COMPLETE_VERIFICATION':
      return { 
        ...state, 
        active: false, 
        step: 0, 
        completionTime: Date.now(),
        pendingMessages: []
      };
    case 'CANCEL_VERIFICATION':
      return { ...initialState, pendingMessages: [] };
    case 'VERIFICATION_ERROR':
      return { 
        ...state, 
        error: action.error, 
        active: false, 
        step: 0,
        pendingMessages: []
      };
    case 'FACE_STATUS':
      return {
        ...state,
        faceDetectionStatus: {
          ...state.faceDetectionStatus,
          [action.status]: action.value
        }
      };
    case 'ADD_PENDING_MESSAGE':
      return {
        ...state,
        pendingMessages: [...state.pendingMessages, action.message]
      };
    case 'CLEAR_PENDING_MESSAGES':
      return {
        ...state,
        pendingMessages: []
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
  processPendingMessages: () => void;
}

// Criar o contexto
const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

// Provider
export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(verificationReducer, initialState);
  const { state: connectionState, sendMessage } = useConnection();
  const { closeCamera } = useCamera();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraEventListenerRef = useRef<EventListener | null>(null);
  const verificationCompleteRef = useRef<boolean>(false);
  
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
  
  // Função segura para enviar mensagens, armazenando-as se a conexão cair
  const safeSendMessage = (message: any) => {
    // Se a conexão estiver ativa, envie a mensagem
    if (connectionState.status === 'connected') {
      const success = sendMessage(message);
      
      // Se falhar, armazenar como pendente
      if (!success) {
        console.log("Mensagem não pôde ser enviada, armazenando para reenvio:", message);
        dispatch({ type: 'ADD_PENDING_MESSAGE', message });
      }
      
      return success;
    } else {
      // Se não estiver conectado, armazenar como pendente
      console.log("Conexão inativa, armazenando mensagem para envio posterior:", message);
      dispatch({ type: 'ADD_PENDING_MESSAGE', message });
      return false;
    }
  };
  
  // Função para processar mensagens pendentes quando a conexão for restaurada
  const processPendingMessages = () => {
    if (connectionState.status !== 'connected' || state.pendingMessages.length === 0) {
      return;
    }
    
    console.log(`Processando ${state.pendingMessages.length} mensagens pendentes`);
    
    // Envia cada mensagem armazenada
    state.pendingMessages.forEach(message => {
      sendMessage(message);
    });
    
    // Enviar mensagem de resposta após o último item
    sendMessage({ type: "response.create" });
    
    // Limpar a fila de mensagens
    dispatch({ type: 'CLEAR_PENDING_MESSAGES' });
  };
  
  // Monitorar mudanças no estado da conexão
  useEffect(() => {
    // Quando a conexão for restaurada, processar mensagens pendentes
    if (connectionState.status === 'connected' && state.pendingMessages.length > 0) {
      processPendingMessages();
    }
  }, [connectionState.status]);
  
  // Função para iniciar a verificação
  const startVerification = () => {
    if (state.active) return; // Evitar iniciar mais de uma vez
    
    dispatch({ type: 'START_VERIFICATION' });
    verificationCompleteRef.current = false;
    
    // Configurar listener para eventos da câmera
    const handleCameraEvent = (event: CustomEvent) => {
      const { type, direction } = event.detail;
      
      console.log("Camera event received:", type, direction);
      
      switch (type) {
        case 'CAMERA_OPENED':
          // Marlene reconhece que a câmera foi aberta
          safeSendMessage({ 
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "[CÂMERA ABERTA]" }],
            },
          });
          safeSendMessage({ type: "response.create" });
          dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          break;
          
        case 'FACE_NOT_VISIBLE':
          // Marlene não consegue ver o rosto
          if (state.faceDetectionStatus.detected) {
            safeSendMessage({ 
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "[ROSTO NÃO VISÍVEL]" }],
              },
            });
            safeSendMessage({ type: "response.create" });
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          }
          break;
          
        case 'FACE_NEEDS_ADJUSTMENT':
          // Marlene dá instruções para ajustar posição - sem texto na tela
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            
            safeSendMessage({ 
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: `[AJUSTE NECESSÁRIO${direction}]` }],
              },
            });
            safeSendMessage({ type: "response.create" });
          }
          break;
          
        case 'FACE_CENTERED':
          // Marlene confirma que o rosto está centralizado - sem texto na tela
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            dispatch({ type: 'FACE_STATUS', status: 'centered', value: true });
            dispatch({ type: 'SET_STEP', step: 2 });

            safeSendMessage({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "[ROSTO CENTRALIZADO]" }],
              },
            });
            safeSendMessage({ type: "response.create" });
          }
          break;

        case 'CAMERA_CLOSING':
          safeSendMessage({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "[FECHANDO CÂMERA]" }],
            },
          });
          safeSendMessage({ type: "response.create" });
          safeSendMessage({
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
          safeSendMessage({ type: "response.create" });
          break;

        case 'VERIFICATION_API_RESULT':
          dispatch({ type: 'SET_STEP', step: 3 });

          safeSendMessage({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "[VERIFICANDO IDENTIDADE]" }],
            },
          });
          safeSendMessage({ type: "response.create" });

          const verified = !!event.detail.result?.verified;

          if (verified) {
            dispatch({ type: 'FACE_STATUS', status: 'verified', value: true });
            dispatch({ type: 'SET_STEP', step: 4 });
            verificationCompleteRef.current = true;
            setCameraVerified(true);

            safeSendMessage({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }],
              },
            });
            safeSendMessage({ type: "response.create" });

            timerRef.current = setTimeout(() => {
              dispatch({ type: 'COMPLETE_VERIFICATION' });
              timerRef.current = setTimeout(() => {
                safeSendMessage({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "[AVANÇAR PARA SIMULAÇÃO DE EMPRÉSTIMO]" }],
                  },
                });
                safeSendMessage({ type: "response.create" });
              }, 1000);
            }, 1000);

            document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_CONFIRMED' } }));
          } else {
            document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_FAILED' } }));
          }
          break;
          
        case 'CAMERA_CLOSED':
          // Câmera fechada, avançar na máquina de estados se verificação foi concluída
          if (verificationCompleteRef.current) {
            // Transição concluída
          }
          break;

        case 'VERIFICATION_CANCELLED':
          dispatch({ type: 'CANCEL_VERIFICATION' });
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
    
    verificationCompleteRef.current = false;
    closeCamera();
    dispatch({ type: 'CANCEL_VERIFICATION' });
    safeSendMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "[CANCELAR VERIFICAÇÃO]" }],
      },
    });
    safeSendMessage({ type: "response.create" });
    document.dispatchEvent(
      new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_CANCELLED' } })
    );
  };
  
  const contextValue: VerificationContextType = {
    state,
    startVerification,
    cancelVerification,
    processPendingMessages
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