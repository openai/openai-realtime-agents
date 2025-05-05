// src/app/simple/components/VerificationProgress.tsx
import React from 'react';
import { useVerification } from '../contexts/VerificationContext';

const VerificationProgress: React.FC = () => {
  const { state } = useVerification();
  
  return (
    <div className="verification-indicator">
      <div className="verification-step-text">
        {state.step === 1 && "Aguardando análise..."}
        {state.step === 2 && "Analisando documento..."}
        {state.step === 3 && "Verificando identidade..."}
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