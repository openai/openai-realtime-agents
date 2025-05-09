// Alteração no AnimatedFooter.tsx
import React, { useEffect } from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { agentIsSpeaking, userIsSpeaking, isTransitioning } = useUI();
  
  // Determine a classe com base em quem está falando
  let speakingClass = "";
  if (isTransitioning) {
    speakingClass = "transitioning";
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