// src/app/simple/components/SimulationPanel.tsx
import React, { useState, useEffect } from 'react';
import { useSimulation } from '../contexts/SimulationContext';
// Static presetNames removed; use context.presetNames

const SimulationPanel: React.FC = () => {
  const {
    currencySymbol,
    setCurrencySymbol,
    locale,
    setLocale,
    show3DCoin,
    setShow3DCoin,
    presets,
    presetNames,
    selectedPreset,
    setSelectedPreset,
    addPreset,
    removePreset
  } = useSimulation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [moneyValue, setMoneyValue] = useState('10.000,00');

  // Simular detecção de valor monetário
  const simulateMoneyDetection = () => {
    const formattedValue = moneyValue.includes(currencySymbol) ? moneyValue : `${currencySymbol} ${moneyValue}`;
    console.log("💰 Simulando detecção de valor:", formattedValue);
    
    // Usar o evento global para garantir que todos os componentes sejam notificados
    document.dispatchEvent(new CustomEvent('detect-loan-amount', {
      detail: { amount: formattedValue }
    }));
  };

  // Simular animação de valor
  const simulateValueAnimation = () => {
    console.log("🎬 Simulando animação de valor");
    document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
  };

  // Simular sequência de deteção + animação
  const simulateFullSequence = () => {
    simulateMoneyDetection();
    
    // Aguardar um pouco para simular o tempo que o agente levaria para processar
    setTimeout(() => {
      simulateValueAnimation();
    }, 800);
  };

  // Simular chamada da ferramenta animate_loan_value
  const simulateAnimateValueTool = () => {
    const formattedValue = moneyValue.includes(currencySymbol) ? moneyValue : `${currencySymbol} ${moneyValue}`;
    console.log("🛠️ Simulando chamada da ferramenta animate_loan_value");
    
    // Primeiro definir o valor
    document.dispatchEvent(new CustomEvent('detect-loan-amount', {
      detail: { amount: formattedValue }
    }));
    
    // Simular evento de função detectada
    document.dispatchEvent(new CustomEvent('function-detected', {
      detail: { 
        name: 'animate_loan_value',
        arguments: JSON.stringify({ amount: formattedValue })
      }
    }));
    
    // Acionar a animação após um pequeno atraso
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('loan-animation-trigger'));
    }, 300);
  };

  // Simular abertura da câmera
  const simulateOpenCamera = () => {
    console.log("📷 Simulando chamada da ferramenta open_camera");
    document.dispatchEvent(new CustomEvent('function-detected', {
      detail: { 
        name: 'open_camera',
        arguments: '{}'
      }
    }));
  };

  // Simular fechamento da câmera
  const simulateCloseCamera = () => {
    console.log("🔒 Simulando chamada da ferramenta close_camera");
    document.dispatchEvent(new CustomEvent('function-detected', {
      detail: { 
        name: 'close_camera',
        arguments: '{}'
      }
    }));
  };

  // Simular evento de UI
  const simulateUIEvent = () => {
    console.log("🎮 Simulando chamada da ferramenta ui_event");
    document.dispatchEvent(new CustomEvent('function-detected', {
      detail: { 
        name: 'ui_event',
        arguments: JSON.stringify({
          name: "Verificação concluída",
          icon: "✅",
          color: "#2cb67d"
        })
      }
    }));
  };

  // Se o painel estiver recolhido, mostrar apenas botão de expandir
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: '#ff8548',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          padding: '5px 10px',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}
      >
        Modo Simulação ▶
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '300px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      borderRadius: '8px',
      padding: '12px',
      zIndex: 1000,
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        paddingBottom: '8px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          🧪 Modo Simulação
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0 5px'
          }}
        >
          ▼
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
          Moeda:
        </label>
        <select
          value={currencySymbol}
          onChange={(e) => setCurrencySymbol(e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#333',
            color: 'white',
            fontSize: '14px'
          }}
        >
          <option value="R$">R$</option>
          <option value="$">$</option>
          <option value="€">€</option>
          <option value="£">£</option>
          <option value="¥">¥</option>
        </select>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
          Ambiente (locale):
        </label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#333',
            color: 'white',
            fontSize: '14px'
          }}
        >
          <option value="pt-BR">pt-BR</option>
          <option value="en-US">en-US</option>
          <option value="es-ES">es-ES</option>
        </select>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
          Preset da Moeda 3D:
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#333',
            color: 'white',
            fontSize: '14px'
          }}
        >
          {presetNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShow3DCoin(!show3DCoin)}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: show3DCoin ? '#2cb67d' : '#555',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {show3DCoin ? 'Ocultar Moeda 3D' : 'Ver Moeda 3D'}
        </button>
      </div>
      {/* Edit preset JSON */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px' }}>Editar Preset JSON:</label>
        <textarea
          value={JSON.stringify(presets[selectedPreset], null, 2)}
          onChange={(e) => {
            try {
              const obj = JSON.parse(e.target.value);
              addPreset(selectedPreset, obj);
            } catch {}
          }}
          rows={6}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
        />
      </div>
      {/* Delete preset */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => removePreset(selectedPreset)}
          disabled={selectedPreset === 'default'}
          style={{ flex: 1, padding: '6px', cursor: 'pointer' }}
        >
          Excluir Preset
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
          Valor a simular:
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ 
              position: 'absolute', 
              left: '8px', 
              top: '7px',
              color: '#aaa',
              fontSize: '14px'
            }}>
              {currencySymbol}
            </span>
            <input
              type="text"
              value={moneyValue}
              onChange={(e) => setMoneyValue(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 6px 6px 28px',
                borderRadius: '4px',
                border: '1px solid #555',
                background: '#333',
                color: 'white',
                fontSize: '14px'
              }}
            />
          </div>
          
          <button
            onClick={simulateFullSequence}
            style={{
              background: '#ff8548',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Testar
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={{ gridColumn: '1 / -1', fontSize: '14px', opacity: 0.7, marginBottom: '2px' }}>
          Animação de Valor:
        </div>
        
        <button
          onClick={simulateMoneyDetection}
          style={{
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left'
          }}
        >
          💰 Detectar Valor
        </button>
        
        <button
          onClick={simulateValueAnimation}
          style={{
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left'
          }}
        >
          🎬 Animar Valor
        </button>
        
        <button
          onClick={simulateAnimateValueTool}
          style={{
            background: '#003366',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            gridColumn: '1 / -1'
          }}
        >
          🛠️ Simular animate_loan_value
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px',
        marginBottom: '5px'
      }}>
        <div style={{ gridColumn: '1 / -1', fontSize: '14px', opacity: 0.7, marginBottom: '2px' }}>
          Outras Ferramentas:
        </div>
        
        <button
          onClick={simulateOpenCamera}
          style={{
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left'
          }}
        >
          📷 open_camera
        </button>
        
        <button
          onClick={simulateCloseCamera}
          style={{
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left'
          }}
        >
          🔒 close_camera
        </button>
        
        <button
          onClick={simulateUIEvent}
          style={{
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            gridColumn: '1 / -1'
          }}
        >
          🎮 ui_event
        </button>
      </div>

      <div style={{ fontSize: '11px', opacity: 0.6, paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        Modo offline: não consome créditos da API
      </div>
    </div>
  );
};

export default SimulationPanel;