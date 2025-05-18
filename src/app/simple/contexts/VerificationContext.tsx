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
  pendingMessages: [] // Armazena mensagens quando a conexão está caída
};

// Tipos de ações
type VerificationAction =
  | { type: 'START_VERIFICATION' }
  | { type: 'SET_STEP'; step: number }
  | { type: 'COMPLETE_VERIFICATION' }
  | { type: 'CANCEL_VERIFICATION' }
  | { type: 'VERIFICATION_ERROR'; error: Error }
  | { type: 'FACE_STATUS'; status: 'detected' | 'centered' | 'verified'; value: boolean }
  | { type: 'ADD_PENDING_MESSAGE'; message: any }
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
        faceDetectionStatus: { detected: false, centered: false, verified: false },
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
      return { ...state, error: action.error, active: false, step: 0, pendingMessages: [] };
    case 'FACE_STATUS':
      return {
        ...state,
        faceDetectionStatus: { ...state.faceDetectionStatus, [action.status]: action.value }
      };
    case 'ADD_PENDING_MESSAGE':
      return { ...state, pendingMessages: [...state.pendingMessages, action.message] };
    case 'CLEAR_PENDING_MESSAGES':
      return { ...state, pendingMessages: [] };
    default:
      return state;
  }
};

// Context e Provider
interface VerificationContextType {
  state: VerificationState;
  startVerification: () => void;
  cancelVerification: () => void;
  processPendingMessages: () => void;
}
const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(verificationReducer, initialState);
  const { state: connectionState, sendMessage } = useConnection();
  const { closeCamera } = useCamera();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraEventListenerRef = useRef<EventListener | null>(null);
  const verificationCompleteRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (cameraEventListenerRef.current) document.removeEventListener('camera-event', cameraEventListenerRef.current);
    };
  }, []);

  // Envio seguro: guarda mensagens se offline
  const safeSendMessage = (message: any) => {
    if (connectionState.status === 'connected') {
      const ok = sendMessage(message);
      if (!ok) dispatch({ type: 'ADD_PENDING_MESSAGE', message });
      return ok;
    } else {
      dispatch({ type: 'ADD_PENDING_MESSAGE', message });
      return false;
    }
  };

  // Processa fila quando reconecta
  const processPendingMessages = () => {
    if (connectionState.status !== 'connected' || state.pendingMessages.length === 0) return;
    state.pendingMessages.forEach(msg => sendMessage(msg));
    sendMessage({ type: "response.create" });
    dispatch({ type: 'CLEAR_PENDING_MESSAGES' });
  };

  useEffect(() => {
    if (connectionState.status === 'connected' && state.pendingMessages.length > 0) {
      processPendingMessages();
    }
  }, [connectionState.status]);

  // Inicia o fluxo de verificação
  const startVerification = () => {
    if (state.active) return;
    dispatch({ type: 'START_VERIFICATION' });
    verificationCompleteRef.current = false;

    const handleCameraEvent = (event: CustomEvent) => {
      const { type, direction } = event.detail;
      switch (type) {
        case 'CAMERA_OPENED':
          safeSendMessage({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: "[CÂMERA ABERTA]" }] },
          });
          safeSendMessage({ type: "response.create" });
          dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          break;

        case 'FACE_NOT_VISIBLE':
          if (state.faceDetectionStatus.detected) {
            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "[ROSTO NÃO VISÍVEL]" }] },
            });
            safeSendMessage({ type: "response.create" });
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: false });
          }
          break;

        case 'FACE_NEEDS_ADJUSTMENT':
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: `[AJUSTE NECESSÁRIO${direction}]` }] },
            });
            safeSendMessage({ type: "response.create" });
          }
          break;

        case 'FACE_CENTERED':
          if (!state.faceDetectionStatus.centered) {
            dispatch({ type: 'FACE_STATUS', status: 'detected', value: true });
            dispatch({ type: 'FACE_STATUS', status: 'centered', value: true });
            dispatch({ type: 'SET_STEP', step: 2 });
            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "[ROSTO CENTRALIZADO]" }] },
            });
            safeSendMessage({ type: "response.create" });
          }
          break;

        case 'CAMERA_CLOSING':
          safeSendMessage({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: "[FECHANDO CÂMERA]" }] },
          });
          safeSendMessage({ type: "response.create" });
          safeSendMessage({
            type: "conversation.item.create",
            item: {
              id: Math.random().toString(36).substring(2, 15),
              type: "function_call",
              function: { name: "close_camera", arguments: "{}" },
            },
          });
          safeSendMessage({ type: "response.create" });
          break;

        case 'VERIFICATION_API_RESULT': {
          dispatch({ type: 'SET_STEP', step: 3 });
          safeSendMessage({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: "[VERIFICANDO IDENTIDADE]" }] },
          });
          safeSendMessage({ type: "response.create" });

          const errorMsg = event.detail.result?.error;
          if (errorMsg) {
            dispatch({ type: 'VERIFICATION_ERROR', error: new Error(errorMsg) });
            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "[ERRO NA VERIFICAÇÃO]" }] },
            });
            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "[TENTE NOVAMENTE OU USE OUTRO MÉTODO]" }] },
            });
            safeSendMessage({ type: "response.create" });
            document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_ERROR' } }));
            break;
          }

          const verified = !!event.detail.result?.verified;
          if (verified) {
            dispatch({ type: 'FACE_STATUS', status: 'verified', value: true });
            dispatch({ type: 'SET_STEP', step: 4 });
            verificationCompleteRef.current = true;
            setCameraVerified(true);

            safeSendMessage({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }] },
            });
            safeSendMessage({ type: "response.create" });

            safeSendMessage({
              type: "conversation.item.create",
              item: {
                id: Math.random().toString(36).substring(2, 15),
                type: "function_call",
                function: { name: "close_camera", arguments: "{}" },
              },
            });
            safeSendMessage({ type: "response.create" });

            timerRef.current = setTimeout(() => {
              dispatch({ type: 'COMPLETE_VERIFICATION' });
              timerRef.current = setTimeout(() => {
                safeSendMessage({
                  type: "conversation.item.create",
                  item: { type: "message", role: "user", content: [{ type: "input_text", text: "[AVANÇAR PARA SIMULAÇÃO DE EMPRÉSTIMO]" }] },
                });
                safeSendMessage({ type: "response.create" });
              }, 1000);
            }, 1000);

            document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_CONFIRMED' } }));
          } else {
            document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_FAILED' } }));
          }
          break;
        }

        case 'CAMERA_CLOSED':
          // Se verificação já estiver completa, a máquina de estados pode prosseguir
          break;

        case 'VERIFICATION_CANCELLED':
          dispatch({ type: 'CANCEL_VERIFICATION' });
          break;
      }
    };

    cameraEventListenerRef.current = handleCameraEvent as EventListener;
    document.addEventListener('camera-event', cameraEventListenerRef.current);
    dispatch({ type: 'SET_STEP', step: 1 });
  };

  // Cancela o fluxo de verificação
  const cancelVerification = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cameraEventListenerRef.current) {
      document.removeEventListener('camera-event', cameraEventListenerRef.current);
      cameraEventListenerRef.current = null;
    }
    verificationCompleteRef.current = false;
    document.dispatchEvent(
      new CustomEvent('camera-event', { detail: { type: 'CAMERA_CLOSING' } })
    );
    closeCamera();
    dispatch({ type: 'CANCEL_VERIFICATION' });

    safeSendMessage({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text: "[CANCELAR VERIFICAÇÃO]" }] },
    });
    safeSendMessage({ type: "response.create" });
    document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_CANCELLED' } }));
  };

  return (
    <VerificationContext.Provider
      value={{
        state,
        startVerification,
        cancelVerification,
        processPendingMessages
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
};

// Hook de consumo
export const useVerification = () => {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error('useVerification must be used within a VerificationProvider');
  return ctx;
};
