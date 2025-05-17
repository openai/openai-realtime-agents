"use client";
// src/app/simple/hooks/useCamera.ts
import { useState, useCallback } from 'react';
import { handleError } from '../utils/errorHandling';

interface UseCameraResult {
  stream: MediaStream | null;
  isActive: boolean;
  error: Error | null;
  openCamera: () => Promise<boolean>;
  closeCamera: () => void;
}

export const useCamera = (): UseCameraResult => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const openCamera = useCallback(async (): Promise<boolean> => {
    try {
      // Fechar qualquer stream existente
      closeCamera();
      
      // Solicitar acesso à câmera
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Atualizar estado
      setStream(mediaStream);
      setIsActive(true);
      setError(null);
      
      return true;
    } catch (err) {
      const errorResult = handleError(err, 'abrir câmera');
      setError(new Error(errorResult.message));
      setIsActive(false);
      return false;
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
    }
  }, [stream]);

  return {
    stream,
    isActive,
    error,
    openCamera,
    closeCamera
  };
};