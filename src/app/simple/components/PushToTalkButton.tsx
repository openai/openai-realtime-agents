// src/app/simple/components/PushToTalkButton.tsx
import React from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { useUI } from '../contexts/UIContext';

const PushToTalkButton: React.FC = () => {
  const { state, connect, disconnect } = useConnection();
  const { agentIsSpeaking } = useUI();
  const isConnected = state.status === 'connected';
  
  return (
    <button
      className={`ptt-button ${isConnected ? (agentIsSpeaking ? "speaking" : "") : "paused"}`}
      onClick={() => isConnected ? disconnect() : connect()}
    />
  );
};

export default PushToTalkButton;