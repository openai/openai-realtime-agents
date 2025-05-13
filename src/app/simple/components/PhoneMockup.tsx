// src/app/simple/components/PhoneMockup.tsx
import React, { useRef, useEffect } from 'react';
import StatusBar from './StatusBar';
import BrowserNavbar from './BrowserNavbar';
import CameraView from './CameraView';
import VerificationProgress from './VerificationProgress';
import AnimatedFooter from './AnimatedFooter';
import LoanValueAnimation from './LoanValueAnimation';
import { useUI } from '../contexts/UIContext';
import { useCamera } from '../contexts/CameraContext';
import { useVerification } from '../contexts/VerificationContext';
import Image from 'next/image';

const PhoneMockup: React.FC = () => {
  const { uiEvents, cameraRequests, removeCameraRequest, setRequestedLoanAmount, showLoanAnimation } = useUI();
  const { state: cameraState, openCamera } = useCamera();
  const { state: verificationState, startVerification } = useVerification();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Função de teste para a animação de valor
  const testAnimation = () => {
    console.log("⭐ Teste de animação iniciado");
    
    // Definir valor
    setRequestedLoanAmount('R$ 10.000,00');
    console.log("⭐ Valor definido: R$ 10.000,00");
    
    // Mostrar a animação com um breve atraso
    setTimeout(() => {
      console.log("⭐ Acionando animação");
      showLoanAnimation();
    }, 500);
  };
  
  // Quando receber o stream, anexar ao <video>
  useEffect(() => {
    if (cameraState.stream && videoRef.current) {
      videoRef.current.srcObject = cameraState.stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      
      // Tentar reproduzir o vídeo e lidar com qualquer erro
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
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
        
        {/* Balõezinhos de câmera - PARTE CRUCIAL MODIFICADA */}
        {cameraRequests.map(req => (
          <div
            key={req.id}
            className="camera-request-bubble"
            style={{ left: `${req.left}%` }}
            onClick={() => {
              // 1. Iniciar a verificação primeiro para configurar os listeners
              if (!verificationState.active) {
                startVerification();
              }
              
              // 2. Abrir a câmera
              openCamera();
              
              // 3. Remover o balãozinho da tela
              removeCameraRequest(req.id);
            }}
          >
            📷
          </div>
        ))}
        
        {/* Botão de teste da animação */}
        <button 
          onClick={testAnimation}
          style={{
            position: 'absolute',
            top: '150px',
            left: '10px',
            zIndex: 100,
            padding: '5px',
            background: '#ff8548',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          Testar animação
        </button>
        
        {/* Preview da câmera */}
        {cameraState.active && (
          <CameraView videoRef={videoRef} />
        )}
        
        {/* Animação do valor do empréstimo */}
        <LoanValueAnimation />
        
        {/* Footer com animação */}
        <AnimatedFooter />
      </div>
    </div>
  );
};

export default PhoneMockup;