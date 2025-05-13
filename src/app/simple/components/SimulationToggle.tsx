// src/app/simple/components/SimulationToggle.tsx
import React from 'react';
import { useSimulation } from '../contexts/SimulationContext';

interface SimulationToggleProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const SimulationToggle: React.FC<SimulationToggleProps> = ({ 
  position = 'top-right'
}) => {
  const { simulationMode, setSimulationMode, offlineMode, setOfflineMode } = useSimulation();
  
  // Determinar posição com base na prop
  let positionStyles: React.CSSProperties = {};
  
  switch (position) {
    case 'top-right':
      positionStyles = { top: '10px', right: '10px' };
      break;
    case 'top-left':
      positionStyles = { top: '10px', left: '10px' };
      break;
    case 'bottom-right':
      positionStyles = { bottom: '10px', right: '10px' };
      break;
    case 'bottom-left':
      positionStyles = { bottom: '10px', left: '10px' };
      break;
  }
  
  return (
    <div style={{
      position: 'absolute',
      ...positionStyles,
      zIndex: 1001,
      display: 'flex',
      flexDirection: 'column',
      gap: '5px'
    }}>
      <div style={{
        background: simulationMode ? '#ff8548' : '#333',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        transition: 'background-color 0.3s'
      }}
      onClick={() => setSimulationMode(!simulationMode)}
      >
        <span style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: simulationMode ? '#4CAF50' : '#ccc'
        }}></span>
        {simulationMode ? 'Modo Simulação: ON' : 'Modo Simulação: OFF'}
      </div>
      
      {simulationMode && (
        <div style={{
          background: offlineMode ? '#2980b9' : '#555',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          transition: 'background-color 0.3s'
        }}
        onClick={() => setOfflineMode(!offlineMode)}
        >
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: offlineMode ? '#4CAF50' : '#ccc'
          }}></span>
          {offlineMode ? 'Modo Offline: ON' : 'Modo Offline: OFF'}
        </div>
      )}
    </div>
  );
};

export default SimulationToggle;