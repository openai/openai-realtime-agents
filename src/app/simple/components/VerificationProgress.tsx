// src/app/simple/components/VerificationProgress.tsx
import React from 'react';
import { useVerification } from '../contexts/VerificationContext';

const VerificationProgress: React.FC = () => {
  const { state } = useVerification();
  
  // Não mostrar o indicador de progresso durante a verificação facial
  // Apenas mostrar antes e depois do processo completo
  if (state.step > 0 && state.step < 4) {
    return null;
  }
  
  return (
    <div className="verification-indicator">
      <div className="verification-step-text">
        {state.step === 0 && "Verificação não iniciada"}
        {state.step === 4 && "Verificação concluída!"}
      </div>
      <div className="verification-progress">
        <div 
          className="verification-bar" 
          style={{ 
            width: `${(state.step / 4) * 100}%`,
            backgroundColor: state.step === 4 ? '#2cb67d' : '#ff8548'
          }}
        ></div>
      </div>
    </div>
  );
};

export default VerificationProgress;