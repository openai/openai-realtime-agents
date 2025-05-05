// src/app/simple/components/CameraView.tsx
import React, { RefObject } from 'react';
import { useCamera } from '../contexts/CameraContext';
import { useVerification } from '../contexts/VerificationContext';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>;
}

const CameraView: React.FC<CameraViewProps> = ({ videoRef }) => {
  const { closeCamera } = useCamera();
  const { state: verificationState, cancelVerification } = useVerification();
  
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
      <button className="camera-close" onClick={handleClose}>×</button>
    </div>
  );
};

export default CameraView;