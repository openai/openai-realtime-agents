// src/app/simple/components/CameraView.tsx
import React, { RefObject, useEffect, useState } from 'react';
import { useCamera } from '../contexts/CameraContext';
import { useVerification } from '../contexts/VerificationContext';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>;
}

const CameraView: React.FC<CameraViewProps> = ({ videoRef }) => {
  const { closeCamera, state: cameraState } = useCamera();
  const { state: verificationState, cancelVerification } = useVerification();
  const [guideDirection, setGuideDirection] = useState<string | null>(null);
  
  // Atualizar guias baseado na posição do rosto
  useEffect(() => {
    if (cameraState.facePosition) {
      const { x, y, size } = cameraState.facePosition;
      
      // Determinar a direção necessária
      const isCentered = Math.abs(x) < 0.2 && Math.abs(y) < 0.2;
      const isGoodSize = size > 0.1;
      
      if (isCentered && isGoodSize) {
        setGuideDirection('centered');
      } else {
        let direction = '';
        
        if (x < -0.2) direction += 'left';
        else if (x > 0.2) direction += 'right';
        
        if (y < -0.2) direction += 'up';
        else if (y > 0.2) direction += 'down';
        
        if (size < 0.1) direction += 'closer';
        
        setGuideDirection(direction || null);
      }
    } else {
      setGuideDirection('no-face');
    }
  }, [cameraState.facePosition]);
  
  const handleClose = () => {
    // Cancela a verificação se estiver em andamento
    if (verificationState.active) {
      cancelVerification();
    } else {
      closeCamera();
    }
  };
  
  return (
    <div className="camera-bubble">
      <video ref={videoRef} className="camera-video" />
      
      {/* Guias Visuais */}
      {guideDirection && (
        <div className={`guide-overlay ${guideDirection}`}>
          {guideDirection === 'centered' && (
            <div className="face-centered">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#2cb67d" strokeWidth="3" />
                <path d="M35,50 L45,60 L65,40" stroke="#2cb67d" strokeWidth="3" fill="none" />
              </svg>
            </div>
          )}
          
          {guideDirection === 'no-face' && (
            <div className="no-face-detected">
              <div className="face-icon">👤</div>
              <div className="direction-text">Posicione seu rosto na câmera</div>
            </div>
          )}
          
          {guideDirection !== 'centered' && guideDirection !== 'no-face' && (
            <div className="direction-arrows">
              {guideDirection.includes('left') && <div className="arrow left">⬅️</div>}
              {guideDirection.includes('right') && <div className="arrow right">➡️</div>}
              {guideDirection.includes('up') && <div className="arrow up">⬆️</div>}
              {guideDirection.includes('down') && <div className="arrow down">⬇️</div>}
              {guideDirection.includes('closer') && <div className="zoom">🔍</div>}
            </div>
          )}
        </div>
      )}
      
      {/* Indicador de status da verificação */}
      <div className="verification-status">
        {verificationState.step === 1 && "Posicionando..."}
        {verificationState.step === 2 && "Analisando..."}
        {verificationState.step === 3 && "Verificando..."}
        {verificationState.step === 4 && "Concluído!"}
      </div>
      
      <button className="camera-close" onClick={handleClose}>×</button>
    </div>
  );
};

export default CameraView;