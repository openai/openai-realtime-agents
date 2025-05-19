// src/app/simple/components/PushToTalkButton.tsx
import React from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { useUI } from '../contexts/UIContext';

const PushToTalkButton: React.FC = () => {
  const { state, connect, disconnect } = useConnection();
  const { currentSpeaker } = useUI();
  const isConnected = state.status === 'connected';
  
  // Não precisamos mais de uma conexão iniciada manualmente
  // Agora a conexão é iniciada automaticamente no ConnectionContext
  
  // No entanto, mantemos o botão para mostrar o status e para desconectar se necessário
  return (
    <button
      className={`ptt-button ${isConnected ? (currentSpeaker === 'agent' ? 'speaking' : '') : 'paused'}`}
      onClick={() => {
        if (isConnected) {
          disconnect();
        } else {
          connect();
        }
      }}
      title={isConnected ? "Desconectar" : "Reconectar"}
    />
  );
};

export default PushToTalkButton;