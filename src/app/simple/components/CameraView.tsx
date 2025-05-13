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
  const [showCheckmark, setShowCheckmark] = useState(false);
  
  // Atualizar guias baseado na posição do rosto - sem texto na tela
  useEffect(() => {
    // Detectar quando a verificação foi concluída com sucesso
    if (verificationState.step === 4 && !showCheckmark) {
      // Mostrar o checkmark quando a verificação estiver concluída
      setShowCheckmark(true);
      
      // Esconder o checkmark após alguns segundos antes de fechar a câmera
      setTimeout(() => {
        setShowCheckmark(false);
      }, 2000);
    }
  }, [verificationState.step, showCheckmark]);
  
  const handleClose = () => {
    // Cancela a verificação se estiver em andamento
    if (verificationState.active) {
      cancelVerification();
    } else {
      closeCamera();
    }
  };
  
  // Determinar a classe da borda baseado no estado da verificação
  const getBorderClass = () => {
    if (verificationState.step === 4) {
      return 'verification-success';
    }
    return '';
  };
  
  return (
    <div className={`camera-bubble ${getBorderClass()}`}>
      {/* Invertendo a câmera horizontal com transform: scaleX(-1) */}
      <video 
        ref={videoRef} 
        className="camera-video" 
        style={{ transform: 'scaleX(-1)' }} 
      />
      
      {/* Checkmark de verificação concluída */}
      {showCheckmark && (
        <div className="verification-checkmark">
          <svg viewBox="0 0 24 24" width="60" height="60">
            <circle cx="12" cy="12" r="11" fill="#00FF7F" fillOpacity="0.3" stroke="#00FF7F" strokeWidth="2"/>
            <path d="M7 13l3 3 7-7" stroke="#00FF7F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      
      <button className="camera-close" onClick={handleClose}>×</button>
    </div>
  );
};

export default CameraView;