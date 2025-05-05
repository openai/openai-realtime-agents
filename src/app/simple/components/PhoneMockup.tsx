// src/app/simple/components/PhoneMockup.tsx
import React, { useRef, useEffect } from 'react';
import StatusBar from './StatusBar';
import BrowserNavbar from './BrowserNavbar';
import CameraView from './CameraView';
import VerificationProgress from './VerificationProgress';
import AnimatedFooter from './AnimatedFooter';
import { useUI } from '../contexts/UIContext';
import { useCamera } from '../contexts/CameraContext';
import { useVerification } from '../contexts/VerificationContext';
import Image from 'next/image';

const PhoneMockup: React.FC = () => {
  const { uiEvents, cameraRequests, removeCameraRequest } = useUI();
  const { state: cameraState, openCamera } = useCamera();
  const { state: verificationState } = useVerification();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Quando receber o stream, anexar ao <video>
  useEffect(() => {
    if (cameraState.stream && videoRef.current) {
      videoRef.current.srcObject = cameraState.stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
    }
  }, [cameraState.stream]);
  
  return (
    <div className="phone-mockup">
      <div className="button-vol-up" />
      <div className="button-vol-down" />
      <div className="button-power" />
      <div className="camera-hole" />
      <div className="notch" />
      
      <div className="screen">
        {/* Barra de status */}
        <StatusBar />
        
        {/* Barra de navegação do browser */}
        <BrowserNavbar />
        
        {/* Logo do Itaú */}
        <div className="itau-logo">
          <Image 
            src="/images/brand.svg" 
            alt="Itaú Logo" 
            width={0}
            height={0}
            style={{ width: 'auto', height: 'auto', maxHeight: '40px' }}
            priority
          />
        </div>
        
        {/* Header com título e nome */}
        <div className="header-content">
          <h1 className="page-title">Crédito Consignado</h1>
          <p className="user-name">Maria Justina Linhares</p>
        </div>
        
        {/* Indicador de verificação */}
        {verificationState.active && (
          <VerificationProgress />
        )}
        
        {/* Ícones de evento */}
        {uiEvents.map((evt, i) => (
          <div key={i} className="ui-event-icon" style={{ color: evt.color }}>
            {evt.icon}
          </div>
        ))}
        
        {/* Balõezinhos de câmera */}
        {cameraRequests.map(req => (
          <div
            key={req.id}
            className="camera-request-bubble"
            style={{ left: `${req.left}%` }}
            onClick={() => {
              openCamera();
              removeCameraRequest(req.id);
            }}
          >
            📷
          </div>
        ))}
        
        {/* Preview da câmera */}
        {cameraState.active && cameraState.stream && (
          <CameraView videoRef={videoRef} />
        )}
        
        {/* Footer com animação */}
        <AnimatedFooter />
      </div>
    </div>
  );
};

export default PhoneMockup;