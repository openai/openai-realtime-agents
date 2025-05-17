// src/app/simple/page.tsx
"use client";

import React, { useEffect } from "react";
import "@/app/styles/simple-page-styles.css";
import { ConnectionProvider } from "./simple/contexts/ConnectionContext";
import { CameraProvider } from "./simple/contexts/CameraContext";
import { VerificationProvider } from "./simple/contexts/VerificationContext";
import { UIProvider, useUI } from "./simple/contexts/UIContext";
import PhoneMockup from "./simple/components/PhoneMockup";

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

// Componente principal da página
const SimplePage: React.FC = () => {
  useEffect(() => {
    // Debug logging
    console.log("SimplePage mounted");
    console.log("API Key format check:", process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 
      `Key starts with: ${process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 3)}...` : 
      "No API key found");
      
    // Define um valor de teste durante o desenvolvimento para ver a animação
    const testTimeout = setTimeout(() => {
      // Simular que o usuário mencionou um valor
      document.dispatchEvent(new CustomEvent('detect-loan-amount', {
        detail: { amount: '12.000,00' }
      }));
      
      // Depois de um tempo, simular que o agente está repetindo o valor
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
      }, 5000);
    }, 3000);
    
    // Intercept Audio playback events
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
      console.log("Audio play attempted", this);
      return originalPlay.apply(this);
    };
    
    return () => {
      // Restore original function
      HTMLAudioElement.prototype.play = originalPlay;
      clearTimeout(testTimeout);
    };
  }, []);

  return (
    <ConnectionProvider>
      <CameraProvider>
        <VerificationProvider>
          <UIProvider>
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
  );
};

export default SimplePage;