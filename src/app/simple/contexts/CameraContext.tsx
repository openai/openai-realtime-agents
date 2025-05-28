"use client";

import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { CameraState } from '../types';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

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
  | { type: 'CAMERA_OPENED'; stream: MediaStream }
  | { type: 'CAMERA_CLOSED' }
  | { type: 'CAMERA_ERROR'; error: Error }
  | { type: 'FACE_DETECTED'; position: { x: number; y: number; size: number } | null }
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
  const modelsLoadingRef = useRef<boolean>(false);
  const detectorRef = useRef<FaceDetector | null>(null);
  const streamTrackRef = useRef<MediaStreamTrack[]>([]);
  const verificationInProgressRef = useRef<boolean>(false);

  // Carregar modelos de detecção facial
  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoadingRef.current || state.modelsLoaded) return;
      modelsLoadingRef.current = true;
      try {
        const vision = await FilesetResolver.forVisionTasks('/wasm');
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/face_detection_short_range.task' },
          runningMode: 'VIDEO'
        });
        dispatch({ type: 'MODELS_LOADED' });
      } catch (err) {
        console.error("Error loading face detection models:", err);
      } finally {
        modelsLoadingRef.current = false;
      }
    };
    loadModels();
  }, [state.modelsLoaded]);

  // Limpar recursos quando o componente desmonta
  useEffect(() => {
    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      closeCamera();
    };
  }, []);

  // Abre a câmera e inicia detecção
  const openCamera = async (): Promise<boolean> => {
    try {
      closeCamera();

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamTrackRef.current = stream.getTracks();
      dispatch({ type: 'CAMERA_OPENED', stream });

      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.autoplay = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        const handleUserInteraction = () => {
          videoRef.current?.play().catch(() => {});
          document.removeEventListener('click', handleUserInteraction);
        };
        document.addEventListener('click', handleUserInteraction, { once: true });
      }

      videoRef.current.onloadedmetadata = () => {
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'CAMERA_OPENED' } }));
        }, 1000);

        faceDetectionIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          if (!state.active) {
            clearInterval(faceDetectionIntervalRef.current!);
            return;
          }

          try {
            if (!detectorRef.current) return;
            const results = await detectorRef.current.detectForVideo(videoRef.current, Date.now());
            if (results && results.length > 0) {
              const det = results[0].boundingBox;
              const videoW = videoRef.current.videoWidth;
              const videoH = videoRef.current.videoHeight;
              const centerX = det.originX + det.width / 2;
              const centerY = det.originY + det.height / 2;
              const relX = -((centerX / videoW) * 2 - 1);
              const relY = (centerY / videoH) * 2 - 1;
              const faceSize = (det.width * det.height) / (videoW * videoH);
              const position = { x: relX, y: relY, size: faceSize };

              dispatch({ type: 'FACE_DETECTED', position });
              handleFaceDetection(position);
            } else {
              dispatch({ type: 'FACE_DETECTED', position: null });
              const now = Date.now();
              if (state.faceDetected && now - lastFeedbackTimeRef.current > 3000) {
                document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'FACE_NOT_VISIBLE' } }));
                lastFeedbackTimeRef.current = now;
              }
            }
          } catch (err) {
            console.error("Error in face detection:", err);
          }
        }, 500);
      };

      return true;
    } catch (err) {
      console.error('Error opening camera:', err);
      dispatch({
        type: 'CAMERA_ERROR',
        error: err instanceof Error ? err : new Error('Failed to open camera')
      });
      document.dispatchEvent(new CustomEvent('camera-event', {
        detail: { type: 'CAMERA_ERROR', error: err instanceof Error ? err.message : 'Unknown camera error' }
      }));
      return false;
    }
  };

  // Analisa posição do rosto e envia feedback ou captura para verificação
  const handleFaceDetection = (position: { x: number; y: number; size: number }) => {
    const { x, y, size } = position;
    const isCentered = Math.abs(x) < 0.2 && Math.abs(y) < 0.2;
    const isGoodSize = size > 0.1;
    const now = Date.now();
    if (now - lastFeedbackTimeRef.current < 2000) return;

    if (isCentered && isGoodSize) {
      document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'FACE_CENTERED', position } }));
      lastFeedbackTimeRef.current = now;

      if (!verificationInProgressRef.current && videoRef.current) {
        verificationInProgressRef.current = true;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');

          // Fecha câmera antes da verificação
          document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'CAMERA_CLOSING' } }));
          closeCamera();

          fetch('/api/verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
          })
            .then(res => res.json())
            .then(result => {
              document.dispatchEvent(new CustomEvent('camera-event', {
                detail: { type: 'VERIFICATION_API_RESULT', result }
              }));
            })
            .catch(error => {
              console.error('verification request failed', error);
              document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'VERIFICATION_API_RESULT', result: { error: error.message } } }));
            })
            .finally(() => {
              verificationInProgressRef.current = false;
            });
        } else {
          verificationInProgressRef.current = false;
        }
      }
    } else {
      let direction = '';
      if (x < -0.25) direction += ' à direita';
      else if (x > 0.25) direction += ' à esquerda';
      if (y < -0.25) direction += ' para cima';
      else if (y > 0.25) direction += ' para baixo';
      if (size < 0.08) direction += ', aproxime-se da câmera';

      if (direction) {
        document.dispatchEvent(new CustomEvent('camera-event', {
          detail: { type: 'FACE_NEEDS_ADJUSTMENT', direction: direction.trim(), position }
        }));
        lastFeedbackTimeRef.current = now;
      }
    }
  };

  // Fecha câmera e limpa recursos
  function closeCamera() {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    streamTrackRef.current.forEach(track => {
      try { track.stop(); }
      catch (e) { console.warn("Error stopping track:", e); }
    });
    streamTrackRef.current = [];

    if (state.stream) {
      state.stream.getTracks().forEach(track => {
        try { track.stop(); }
        catch (e) { console.warn("Error stopping stream tracks:", e); }
      });
      dispatch({ type: 'CAMERA_CLOSED' });
      document.dispatchEvent(new CustomEvent('camera-event', { detail: { type: 'CAMERA_CLOSED' } }));
    }

    if (videoRef.current) {
      try { videoRef.current.srcObject = null; }
      catch (e) { console.warn("Error clearing video source:", e); }
    }
  }

  useEffect(() => {
    const handleSimClose = () => {
      closeCamera();
    };
    document.addEventListener('simulated-camera-close', handleSimClose as EventListener);
    return () => {
      document.removeEventListener('simulated-camera-close', handleSimClose as EventListener);
    };
  }, []);

  const contextValue: CameraContextType = {
    state,
    openCamera,
    closeCamera
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
  if (!context) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};
