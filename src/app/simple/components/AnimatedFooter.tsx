// src/app/simple/components/AnimatedFooter.tsx
import React, { useEffect } from 'react';
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

  // Logar sempre que a classe do rodapé mudar
  useEffect(() => {
    if (speakingClass) {
      console.log("🎨 Classe do rodapé:", speakingClass);
    } else {
      console.log("🎨 Rodapé sem classe de fala");
    }
  }, [speakingClass]);
  return (
    <div className={`animated-footer ${speakingClass}`}></div>
  );
};

export default AnimatedFooter;