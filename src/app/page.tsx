// src/app/simple/page.tsx
"use client";

import React, { useEffect } from "react";
import "@/app/styles/simple-page-styles.css";
import { ConnectionProvider } from "./simple/contexts/ConnectionContext";
import { CameraProvider } from "./simple/contexts/CameraContext";
import { VerificationProvider } from "./simple/contexts/VerificationContext";
import { UIProvider, useUI } from "./simple/contexts/UIContext";
import { SimulationProvider } from "./simple/contexts/SimulationContext";
import PhoneMockup from "./simple/components/PhoneMockup";
import { useConnection } from "./simple/contexts/ConnectionContext";

// Componente para lidar com o evento global
const LoanAnimationHandler: React.FC = () => {
  const { loanState, showLoanAnimation } = useUI();
  
  useEffect(() => {
    // Handler para o evento global
    const handleLoanAnimationTrigger = () => {
      console.log("Global loan animation event captured");
      if (loanState.requestedAmount) {
        showLoanAnimation();
      } else {
        console.warn("No loan amount set when animation was triggered");
      }
    };
    
    // Adicionar listener
    document.addEventListener('loan-animation-trigger', handleLoanAnimationTrigger);
    
    // Remover listener na desmontagem
    return () => {
      document.removeEventListener('loan-animation-trigger', handleLoanAnimationTrigger);
    };
  }, [loanState.requestedAmount, showLoanAnimation]);
  
  return null; // Componente não renderiza nada visualmente
};

// Componente para logar mudanças de conexão
const ConnectionLogger: React.FC = () => {
  const { state } = useConnection();
  useEffect(() => {
    console.log('[ConnectionLogger] state', {
      status: state.status,
      sessionId: state.sessionId,
      error: state.error?.message,
    });
  }, [state.status, state.sessionId, state.error]);
  return null;
};

// Componente principal da página
const SimplePage: React.FC = () => {
  useEffect(() => {
    // Debug logging
    console.log("SimplePage mounted");
    // console.log(
    //   "API Key format check:",
    //   process.env.NEXT_PUBLIC_OPENAI_API_KEY
    //     ? `Key starts with: ${process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 3)}...`
    //     : "No API key found"
    // );
      
    
    // Intercept Audio playback events
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
      console.log("Audio play attempted", this);
      return originalPlay.apply(this);
    };
    
    return () => {
      // Restore original function
      HTMLAudioElement.prototype.play = originalPlay;
    };
  }, []);

  return (
    <SimulationProvider>
      <ConnectionProvider>
        <CameraProvider>
          <VerificationProvider>
            <UIProvider>
              <ConnectionLogger />
              {/* Componente handler para eventos globais */}
              <LoanAnimationHandler />

              <div className="stage">
                <div className="blur-backdrop"></div>
                <PhoneMockup />
              </div>
            </UIProvider>
          </VerificationProvider>
        </CameraProvider>
      </ConnectionProvider>
    </SimulationProvider>
  );
};

export default SimplePage;