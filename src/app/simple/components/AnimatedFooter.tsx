// src/app/simple/components/AnimatedFooter.tsx
import React, { useEffect } from 'react';
import { useUI } from '../contexts/UIContext';

const AnimatedFooter: React.FC = () => {
  const { agentIsSpeaking, userIsSpeaking } = useUI();
  
  // Debug logs to track state changes
  useEffect(() => {
    console.log("AnimatedFooter: agentIsSpeaking =", agentIsSpeaking);
  }, [agentIsSpeaking]);
  
  useEffect(() => {
    console.log("AnimatedFooter: userIsSpeaking =", userIsSpeaking);
  }, [userIsSpeaking]);
  
  // Determine the class based on who is speaking
  const speakingClass = agentIsSpeaking 
    ? "agent-speaking" 
    : (userIsSpeaking ? "user-speaking" : "");
  
  return (
    <div className={`animated-footer ${speakingClass}`}>
      {/* Added a log to see in the DOM when classes change */}
      {speakingClass && (
        <span style={{ display: 'none' }}>
          Current speaking state: {speakingClass}
        </span>
      )}
    </div>
  );
};

export default AnimatedFooter;