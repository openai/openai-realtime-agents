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
  
  // Determine positioning guide style based on face detection status
  const getFaceGuideStyle = () => {
    if (!cameraState.faceDetected) {
      return { borderColor: 'rgba(255, 255, 255, 0.7)' }; // Initial state - white
    }
    
    // If face is detected but not properly positioned
    if (cameraState.facePosition) {
      // Check if face is centered and good size
      const { x, y, size } = cameraState.facePosition;
      const isCentered = Math.abs(x) < 0.2 && Math.abs(y) < 0.2;
      const isGoodSize = size > 0.1;
      
      if (isCentered && isGoodSize) {
        if (verificationState.step === 4) {
          return { borderColor: '#00FF7F', boxShadow: '0 0 0 4px #00FF7F, 0 0 20px rgba(0, 255, 127, 0.7)' }; // Success - green
        }
        return { borderColor: '#ADFF2F', boxShadow: '0 0 10px rgba(173, 255, 47, 0.5)' }; // Ready - yellow-green
      }
      
      return { borderColor: 'rgba(255, 255, 255, 0.9)' }; // Detected but not centered - brighter white
    }
    
    return { borderColor: 'rgba(255, 255, 255, 0.7)' }; // Default - white
  };
  
  // Update checkmark visibility based on verification state
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
      
      {/* Face positioning guide oval */}
      <div 
        className="face-positioning-guide" 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '70%',
          height: '85%',
          transform: 'translate(-50%, -50%)',
          border: '3px solid white',
          borderRadius: '50%',
          pointerEvents: 'none',
          transition: 'all 0.3s ease-in-out',
          ...getFaceGuideStyle()
        }}
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