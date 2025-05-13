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
import { useSimulation } from '../contexts/SimulationContext';
import Image from 'next/image';

const PhoneMockup: React.FC = () => {
  const {
    uiEvents,
    cameraRequests,
    addCameraRequest,
    removeCameraRequest,
    setRequestedLoanAmount,
    showLoanAnimation,
  } = useUI();
  const { state: cameraState, openCamera } = useCamera();
  const { state: verificationState } = useVerification();
  const { simulationMode } = useSimulation();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Função de teste para a animação de valor
  const testAnimation = () => {
    console.log("⭐ Teste de animação iniciado");
    document.dispatchEvent(
      new CustomEvent('detect-loan-amount', {
        detail: { amount: 'R$ 10.000,00' },
      })
    );
    setTimeout(() => {
      console.log("⭐ Acionando animação");
      document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
    }, 300);
  };

  // Quando receber o stream, anexar ao <video>
  useEffect(() => {
    if (cameraState.stream && videoRef.current) {
      videoRef.current.srcObject = cameraState.stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
    }
  }, [cameraState.stream]);

  // Ouvir eventos de solicitação de câmera simulados
  useEffect(() => {
    if (!simulationMode) return;

    const handleCameraRequest = (e: CustomEvent) => {
      console.log("🧪 Simulando solicitação de câmera");
      const position = e.detail?.position || 50;
      const id = addCameraRequest(position);
      // Opcional: remover automaticamente após uso ou timeout
      // removeCameraRequest(id);
    };

    document.addEventListener(
      'simulated-camera-request',
      handleCameraRequest as EventListener
    );

    return () => {
      document.removeEventListener(
        'simulated-camera-request',
        handleCameraRequest as EventListener
      );
    };
  }, [simulationMode, addCameraRequest, removeCameraRequest]);

  return (
    <div className="phone-mockup">
      <div className="button-vol-up" />
      <div className="button-vol-down" />
      <div className="button-power" />
      <div className="camera-hole" />
      <div className="notch" />
      <div className="screen">
        <StatusBar />
        <BrowserNavbar />
        {simulationMode && (
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(255, 133, 0, 0.8)',
              color: 'white',
              padding: '2px 10px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 100,
            }}
          >
            MODO SIMULAÇÃO
          </div>
        )}
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
        <div className="header-content">
          <h1 className="page-title">Crédito Consignado</h1>
          <p className="user-name">Maria Justina Linhares</p>
        </div>
        {verificationState.active && <VerificationProgress />}
        {uiEvents.map((evt, i) => (
          <div key={i} className="ui-event-icon" style={{ color: evt.color }}>
            {evt.icon}
          </div>
        ))}
        {cameraRequests.map((req) => (
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
        {!simulationMode && (
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
              borderRadius: '5px',
            }}
          >
            Testar animação
          </button>
        )}
        {cameraState.active && cameraState.stream && (
          <CameraView videoRef={videoRef} />
        )}
        <LoanValueAnimation />
        <AnimatedFooter />
      </div>
    </div>
  );
};

export default PhoneMockup;
