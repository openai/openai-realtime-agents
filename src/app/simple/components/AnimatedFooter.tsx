// src/app/simple/components/AnimatedFooter.tsx
import React from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { agentIsSpeaking, speechIntensity } = useUI();
  
  return (
    <div 
      className={`animated-footer ${agentIsSpeaking ? "speaking" : ""}`}
      style={agentIsSpeaking ? { '--speech-intensity': speechIntensity } as React.CSSProperties : undefined}
    />
  );
};

export default AnimatedFooter;