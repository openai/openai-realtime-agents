// src/app/simple/components/AnimatedFooter.tsx
import React from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { agentIsSpeaking, userIsSpeaking } = useUI();
  
  // Determina a classe de acordo com quem está falando
  const speakingClass = agentIsSpeaking 
    ? "agent-speaking" 
    : (userIsSpeaking ? "user-speaking" : "");
  
  return (
    <div className={`animated-footer ${speakingClass}`} />
  );
};

export default AnimatedFooter;