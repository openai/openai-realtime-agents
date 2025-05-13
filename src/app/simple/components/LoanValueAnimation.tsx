// src/app/simple/components/LoanValueAnimation.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useUI } from '../contexts/UIContext';

const LoanValueAnimation: React.FC = () => {
  const { loanState } = useUI();
  const [moneyEmojis, setMoneyEmojis] = useState<Array<{
    id: number, 
    left: number, 
    delay: number, 
    floatDistance: number,
    rotation: number,
    scale: number
  }>>([]);
  const [overlayVisible, setOverlayVisible] = useState(false);
  
  // Ref para armazenar o timer da animação
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Gerar emojis quando a animação começa
  useEffect(() => {
    if (loanState.showAnimation) {
      console.log('Animação iniciada para valor:', loanState.requestedAmount);
      
      // Mostrar o overlay primeiro
      setOverlayVisible(true);
      
      // Limpar timers anteriores
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      
      // Gerar entre 10-20 emojis em posições aleatórias
      const emojiCount = Math.floor(Math.random() * 11) + 10;
      const newEmojis = Array.from({ length: emojiCount }, (_, i) => ({
        id: i,
        left: Math.random() * 85 + 5, // 5% a 90% da largura
        delay: Math.random() * 2000, // Atraso aleatório até 2s
        floatDistance: -(Math.random() * 100 + 150), // Distância aleatória de flutuação
        rotation: Math.random() * 40 - 20, // Rotação aleatória entre -20 e 20 graus
        scale: Math.random() * 0.6 + 0.7 // Escala aleatória entre 0.7 e 1.3
      }));
      
      setMoneyEmojis(newEmojis);
      
      // Esconder após um tempo
      animationTimerRef.current = setTimeout(() => {
        setOverlayVisible(false);
        
        // Pequeno atraso antes de limpar os emojis
        setTimeout(() => {
          setMoneyEmojis([]);
        }, 500);
      }, 7000);
    } else {
      // Quando a animação termina
      setOverlayVisible(false);
      
      // Pequeno atraso antes de limpar os emojis
      const clearTimer = setTimeout(() => {
        setMoneyEmojis([]);
      }, 500);
      
      return () => clearTimeout(clearTimer);
    }
    
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [loanState.showAnimation]);
  
  if (!loanState.showAnimation && !overlayVisible && moneyEmojis.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Overlay de fundo */}
      <div className={`loan-value-overlay ${overlayVisible ? 'visible' : ''}`} />
      
      {/* Container para a animação */}
      <div className="loan-value-animation">
        {/* Emojis de dinheiro */}
        {moneyEmojis.map(emoji => (
          <div 
            key={emoji.id}
            className="money-emoji"
            style={{
              left: `${emoji.left}%`,
              animationDelay: `${emoji.delay}ms`,
              '--float-distance': `${emoji.floatDistance}px`,
              '--rotation': `${emoji.rotation}deg`,
              transform: `scale(${emoji.scale})`,
            } as React.CSSProperties}
          >
            💵
          </div>
        ))}
        
        {/* Valor do empréstimo */}
        <div 
          className="loan-amount-display"
          style={{
            opacity: loanState.animationProgress > 60 ? 1 : loanState.animationProgress / 60,
          }}
        >
          {loanState.requestedAmount}
        </div>
      </div>
    </>
  );
};

export default LoanValueAnimation;