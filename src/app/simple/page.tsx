// File: src/app/simple/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createRealtimeConnection } from "@/app/lib/realtimeConnection";

interface Bubble {
  id: string;
  left: number;
}

export default function SimplePage() {
  const [connected, setConnected] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startConnection();
    return () => stopConnection();
  }, []);

  const startConnection = async () => {
    try {
      const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY!;
      if (!audioRef.current) audioRef.current = document.createElement("audio");
      audioRef.current.autoplay = true;

      const { pc, dc } = await createRealtimeConnection(key, audioRef);
      pcRef.current = pc;
      dcRef.current = dc;

      dc.onopen = () => {
        setConnected(true);
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: { instructions: "Oi Lucas, tudo bom?" },
          })
        );
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = () => {
        triggerBubble();
      };
    } catch (err) {
      console.error("Erro ao conectar:", err);
    }
  };

  const stopConnection = () => {
    if (dcRef.current?.readyState === "open") {
      try {
        dcRef.current.send(JSON.stringify({ type: "stop" }));
      } catch {}
    }
    dcRef.current?.close();
    pcRef.current?.close();
    setConnected(false);
  };

  const triggerBubble = () => {
    const id = uuidv4();
    const left = 10 + Math.random() * 80; // posição aleatória em %
    setBubbles((prev) => [...prev, { id, left }]);
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 3000);
  };

  return (
    <div className="stage">
      {/* Moldura real do aparelho */}
      <div className="device-frame">
        {/* Área interna da “tela” */}
        <div className="phone-screen">
          {/* Header simulado */}
          <div className="mobile-header">
            <div className="status-bar">
              <span className="time">20:05</span>
              <div className="status-icons">
                <svg className="icon wifi" viewBox="0 0 24 24">
                  <path d="M2 8.5l10 7 10-7v-2l-10 7-10-7v2z" />
                </svg>
                <svg className="icon battery" viewBox="0 0 24 24">
                  <rect x="2" y="7" width="18" height="10" ry="2" />
                  <rect x="20" y="10" width="2" height="4" />
                </svg>
              </div>
            </div>
            <div className="browser-bar">
              <svg className="icon home" viewBox="0 0 24 24">
                <path d="M3 9.5l9-7 9 7v11h-6v-7h-6v7h-6v-11z" />
              </svg>
              <svg className="icon lock" viewBox="0 0 24 24">
                <path d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6-8h-1V7a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8h16v-8a2 2 0 0 0-2-2z" />
              </svg>
              <span className="domain">formalização.com.br</span>
              <div className="controls">
                <div className="tabs">1</div>
                <div className="menu">⋮</div>
              </div>
            </div>
          </div>

          {/* Bolhas de reação */}
          {bubbles.map((b) => (
            <div key={b.id} className="bubble" style={{ left: `${b.left}%` }} />
          ))}

          {/* Luz fluida no bottom com blur */}
          <div className="bottom-light" />

          {/* Botão PTT */}
          <button
            className="ptt-button"
            onClick={() => connected && stopConnection()}
            disabled={!connected}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3zm-1 18.93V23h2v-3.07a8 8 0 0 0 6.938-6.938H20a1 1 0 1 0 0-2h-1a8 8 0 0 0-6.938-6.938V1h-2v3.07a8 8 0 0 0-6.938 6.938H4a1 1 0 1 0 0 2h1a8 8 0 0 0 6.938 6.938z" />
            </svg>
          </button>
          <audio ref={audioRef} autoPlay hidden />
        </div>
      </div>

      <style>{`
        .stage {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111;
          height: 100vh;
        }
        /* 1. Mockup real de Galaxy (ou outro) */
        .device-frame {
          position: relative;
          width: 360px;
          height: 800px;
          background: url("/images/mockup.png") no-repeat center;
          background-size: contain;
        }
        /* 2. Conteúdo dentro da moldura */
        .phone-screen {
          position: absolute;
          top: 80px;    /* ajuste conforme seu PNG */
          left: 20px;   /* ajuste conforme seu PNG */
          width: 320px; /* ajuste conforme seu PNG */
          height: 640px;
          overflow: hidden;
          border-radius: 24px; /* canto interno */
          background: #fafafa;
        }
        /* Header */
        .mobile-header { position: relative; }
        .status-bar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 4px 12px; background: #fff;
        }
        .status-bar .time { font-size: 12px; color: #333; }
        .status-icons { display: flex; gap: 6px; }
        .icon { width: 16px; height: 16px; fill: #333; }
        .browser-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 4px 12px; background: #f0f0f0;
        }
        .domain {
          flex: 1; font-size: 12px; color: #333;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .controls { display: flex; gap: 8px; }
        .tabs, .menu { font-size: 12px; color: #333; }

        /* Bolhas */
        .bubble {
          position: absolute; bottom: 100px;
          width: 16px; height: 16px;
          background: rgba(233,30,99,0.5);
          border-radius: 50%;
          animation: rise 2.5s ease-out forwards;
          z-index: 2;
        }
        @keyframes rise {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-180px) scale(0.5); opacity: 0; }
        }

        /* Bottom-light com movimento de cor, blur e controle de altura */
        .bottom-light {
          position: absolute;
          bottom: 0; left: 0;
          width: 100%; height: 80px;  /* ajuste aqui a altura desejada */
          background: linear-gradient(
            180deg,
            transparent,
            rgba(233,30,99,0.2),
            rgba(0,188,212,0.2) /* transição para azul */
          );
          filter: blur(30px);
          animation: hueShift 6s ease-in-out infinite alternate;
          pointer-events: none;
          z-index: 1;
        }
        @keyframes hueShift {
          0% { filter: blur(30px) hue-rotate(0deg); }
          100% { filter: blur(30px) hue-rotate(60deg); }
        }

        /* Botão PTT */
        .ptt-button {
          position: absolute; bottom: 40px;
          left: 50%; transform: translateX(-50%);
          width: 80px; height: 80px;
          background: #e91e63;
          border: none; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          z-index: 2;
        }
        .ptt-button svg { width: 36px; height: 36px; fill: white; }
        .ptt-button:active { background: #ad1457; }
      `}</style>
    </div>
  );
}