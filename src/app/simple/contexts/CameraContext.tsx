import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { CameraState } from '../types';
import * as faceapi from 'face-api.js';

// Estado inicial
const initialState: CameraState = {
  stream: null,
  active: false,
  error: null,
  faceDetected: false,
  facePosition: null,
  modelsLoaded: false
};

// Tipos de ações
type CameraAction = 
  | { type: 'CAMERA_OPENED', stream: MediaStream }
  | { type: 'CAMERA_CLOSED' }
  | { type: 'CAMERA_ERROR', error: Error }
  | { type: 'FACE_DETECTED', position: {x: number, y: number, size: number} | null }
  | { type: 'MODELS_LOADED' };

// Reducer
const cameraReducer = (state: CameraState, action: CameraAction): CameraState => {
  switch (action.type) {
    case 'CAMERA_OPENED':
      return { ...state, stream: action.stream, active: true, error: null };
    case 'CAMERA_CLOSED':
      return { ...state, stream: null, active: false, error: null, faceDetected: false, facePosition: null };
    case 'CAMERA_ERROR':
      return { ...state, error: action.error, active: false };
    case 'FACE_DETECTED':
      return { 
        ...state, 
        faceDetected: !!action.position, 
        facePosition: action.position 
      };
    case 'MODELS_LOADED':
      return { ...state, modelsLoaded: true };
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
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFeedbackTimeRef = useRef<number>(0);
  
  // Carregar modelos de detecção facial
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Carregar o modelo TinyFaceDetector que é mais leve
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        console.log("Face detection models loaded");
        dispatch({ type: 'MODELS_LOADED' });
      } catch (err) {
        console.error("Error loading face detection models:", err);
      }
    };
    
    loadModels();
  }, []);
  
  // Função para abrir a câmera com detecção facial
  const openCamera = async (): Promise<boolean> => {
    try {
      // Fechar qualquer stream existente
      closeCamera();
      
      // Solicitar acesso à câmera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', // Usar câmera frontal
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // Atualizar o estado
      dispatch({ type: 'CAMERA_OPENED', stream });
      
      // Criar elemento de vídeo para detecção facial
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.autoplay = true;
        videoRef.current.muted = true;
      }
      
      // Conectar stream ao vídeo
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error("Error playing video:", err));
      
      // Iniciar detecção facial após certificar que o vídeo está pronto
      videoRef.current.onloadedmetadata = () => {
        // Enviar mensagem inicial para Marlene
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('camera-event', {
            detail: { type: 'CAMERA_OPENED' }
          }));
        }, 1000);
        
        // Iniciar detecção facial
        faceDetectionIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const detections = await faceapi.detectAllFaces(
                videoRef.current, 
                new faceapi.TinyFaceDetectorOptions()
              );
              
              if (detections.length > 0) {
                const detection = detections[0];
                const { x, y, width, height } = detection.box;
                
                // Calcular posição relativa ao centro e tamanho
                const videoWidth = videoRef.current.videoWidth;
                const videoHeight = videoRef.current.videoHeight;
                const centerX = x + width/2;
                const centerY = y + height/2;
                
                // Valor normalizado entre -1 e 1 (0 é o centro)
                // Invertendo o valor de X para compensar o espelhamento da câmera
                const relX = -((centerX / videoWidth) * 2 - 1); // Invertido aqui
                const relY = (centerY / videoHeight) * 2 - 1;
                
                // Tamanho do rosto em relação ao frame
                const faceSize = (width * height) / (videoWidth * videoHeight);
                
                const position = { x: relX, y: relY, size: faceSize };
                
                // Atualizar estado
                dispatch({ type: 'FACE_DETECTED', position });
                
                // Gerar feedback para Marlene se houver mudança significativa
                handleFaceDetection(position);
              } else {
                // Nenhum rosto detectado
                dispatch({ type: 'FACE_DETECTED', position: null });
                
                // Avisar Marlene que não há rosto visível
                if (state.faceDetected) {
                  // Limitar a frequência de feedback para não sobrecarregar
                  const now = Date.now();
                  if (now - lastFeedbackTimeRef.current > 3000) {
                    document.dispatchEvent(new CustomEvent('camera-event', {
                      detail: { type: 'FACE_NOT_VISIBLE' }
                    }));
                    lastFeedbackTimeRef.current = now;
                  }
                }
              }
            } catch (err) {
              console.error("Error in face detection:", err);
            }
          }
        }, 200); // Executar a cada 200ms
      };
      
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
  
  // Função para analisar a posição do rosto e enviar feedback
  const handleFaceDetection = (position: {x: number, y: number, size: number}) => {
    const { x, y, size } = position;
    const isCentered = Math.abs(x) < 0.2 && Math.abs(y) < 0.2;
    const isGoodSize = size > 0.1; // O rosto ocupa pelo menos 10% do frame
    
    // Limitar a frequência de feedback para não sobrecarregar
    const now = Date.now();
    if (now - lastFeedbackTimeRef.current < 2000) {
      return;  // Só dá feedback a cada 2 segundos
    }
    
    // Verificar centralização do rosto
    if (isCentered && isGoodSize) {
      document.dispatchEvent(new CustomEvent('camera-event', {
        detail: { 
          type: 'FACE_CENTERED',
          position
        }
      }));
      lastFeedbackTimeRef.current = now;
    } else {
      // Gerar feedback direcional
      let direction = "";
      // Inverter direções para corresponder à visão do usuário com a câmera espelhada
      if (x < -0.2) direction += " à direita"; // Invertido de "à esquerda"
      else if (x > 0.2) direction += " à esquerda"; // Invertido de "à direita"
      
      if (y < -0.2) direction += " para cima";
      else if (y > 0.2) direction += " para baixo";
      
      if (size < 0.1) direction += ", aproxime-se da câmera";
      
      if (direction) {
        document.dispatchEvent(new CustomEvent('camera-event', {
          detail: { 
            type: 'FACE_NEEDS_ADJUSTMENT',
            direction,
            position
          }
        }));
        lastFeedbackTimeRef.current = now;
      }
    }
  };
  
  // Função para fechar a câmera
  const closeCamera = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      dispatch({ type: 'CAMERA_CLOSED' });
      
      document.dispatchEvent(new CustomEvent('camera-event', {
        detail: { type: 'CAMERA_CLOSED' }
      }));
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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