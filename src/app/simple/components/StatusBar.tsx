// src/app/simple/components/StatusBar.tsx
import React from 'react';
import { useUI } from '../contexts/UIContext';

const StatusBar: React.FC = () => {
  const { currentTime } = useUI();
  
  return (
    <div className="status-bar">
      <div className="status-bar-time">{currentTime}</div>
      <div className="status-bar-icons">
        {/* Ícone de sinal de celular */}
        <svg className="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 16h2v4H4v-4zm4-4h2v8H8v-8zm4-4h2v12h-2V8zm4-4h2v16h-2V4z" strokeWidth="2"/>
        </svg>
        {/* Ícone de WiFi */}
        <svg className="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 6c5.52 0 10 4.48 10 10H2c0-5.52 4.48-10 10-10z" strokeWidth="1.5"/>
          <path d="M12 11c2.76 0 5 2.24 5 5H7c0-2.76 2.24-5 5-5z" strokeWidth="1.5"/>
          <circle cx="12" cy="18" r="1" strokeWidth="1.5"/>
        </svg>
        {/* Ícone de bateria */}
        <svg className="status-icon" width="24" height="18" viewBox="0 0 24 12" fill="none" stroke="currentColor">
          <rect x="2" y="2" width="18" height="8" rx="1" strokeWidth="1.5"/>
          <path d="M22 5v2" strokeWidth="2" strokeLinecap="round"/>
          <rect x="4" y="4" width="13" height="4" fill="currentColor"/>
        </svg>
      </div>
    </div>
  );
};

export default StatusBar;