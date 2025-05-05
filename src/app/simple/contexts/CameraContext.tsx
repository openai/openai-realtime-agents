// src/app/simple/contexts/CameraContext.tsx
import React, { createContext, useContext, useReducer, useRef } from 'react';
import { CameraState } from '../types';

// Estado inicial
const initialState: CameraState = {
  stream: null,
  active: false,
  error: null,
};

// Tipos de ações
type CameraAction = 
  | { type: 'CAMERA_OPENED', stream: MediaStream }
  | { type: 'CAMERA_CLOSED' }
  | { type: 'CAMERA_ERROR', error: Error };

// Reducer
const cameraReducer = (state: CameraState, action: CameraAction): CameraState => {
  switch (action.type) {
    case 'CAMERA_OPENED':
      return { ...state, stream: action.stream, active: true, error: null };
    case 'CAMERA_CLOSED':
      return { ...state, stream: null, active: false, error: null };
    case 'CAMERA_ERROR':
      return { ...state, error: action.error, active: false };
    default:
      return state;
  }
};

// Tipo do contexto
interface CameraContextType {
  state: CameraState;
  openCamera: () => Promise<boolean>;
  closeCamera: () => void;
}

// Criar o contexto
const CameraContext = createContext<CameraContextType | undefined>(undefined);

// Provider
export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cameraReducer, initialState);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Função para abrir a câmera
  const openCamera = async (): Promise<boolean> => {
    try {
      // Fechar qualquer stream existente
      closeCamera();
      
      // Solicitar acesso à câmera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Atualizar o estado
      dispatch({ type: 'CAMERA_OPENED', stream });
      
      return true;
    } catch (err) {
      console.error('Error opening camera:', err);
      dispatch({ 
        type: 'CAMERA_ERROR', 
        error: err instanceof Error ? err : new Error('Failed to open camera') 
      });
      return false;
    }
  };
  
  // Função para fechar a câmera
  const closeCamera = () => {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      dispatch({ type: 'CAMERA_CLOSED' });
    }
  };
  
  const contextValue: CameraContextType = {
    state,
    openCamera,
    closeCamera,
  };
  
  return (
    <CameraContext.Provider value={contextValue}>
      {children}
    </CameraContext.Provider>
  );
};

// Hook para usar o contexto
export const useCamera = () => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};