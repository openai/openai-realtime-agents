// src/app/simple/components/AnimatedFooter.tsx
import React, { useEffect, useState } from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { agentIsSpeaking, userIsSpeaking, loanState } = useUI();
  const [transitioning, setTransitioning] = useState(false);
  
  // Usar efeito para criar transições suaves
  useEffect(() => {
    let transitionTimer: NodeJS.Timeout | null = null;
    
    // Se mudar quem está falando, adicionar uma transição
    if (agentIsSpeaking || userIsSpeaking) {
      setTransitioning(true);
      
      transitionTimer = setTimeout(() => {
        setTransitioning(false);
      }, 400);
    }
    
    return () => {
      if (transitionTimer) {
        clearTimeout(transitionTimer);
      }
    };
  }, [agentIsSpeaking, userIsSpeaking]);
  
  // Determinar a classe com base em quem está falando
  let speakingClass = "";
  
  if (transitioning) {
    speakingClass = "transitioning";
  } else if (loanState.showAnimation) {
    // Se a animação de valor estiver visível, priorizar coloração para isso
    speakingClass = "loan-animation";
  } else if (agentIsSpeaking) {
    speakingClass = "agent-speaking";
  } else if (userIsSpeaking) {
    speakingClass = "user-speaking";
  }
  
  return (
    <div className={`animated-footer ${speakingClass}`}></div>
  );
};

export default AnimatedFooter;