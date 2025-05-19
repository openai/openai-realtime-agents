// src/app/simple/components/AnimatedFooter.tsx
import React from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { currentSpeaker, loanState } = useUI();

  // Determinar a classe com base em quem está falando
  let speakingClass = "";

  if (loanState.showAnimation) {
    // Se a animação de valor estiver visível, priorizar coloração para isso
    speakingClass = "loan-animation";
  } else if (currentSpeaker === 'agent') {
    speakingClass = "agent-speaking";
  } else if (currentSpeaker === 'user') {
    speakingClass = "user-speaking";
  }
  
  return (
    <div className={`animated-footer ${speakingClass}`}></div>
  );
};

export default AnimatedFooter;