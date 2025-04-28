// File: src/app/simple/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createRealtimeConnection } from "@/app/lib/realtimeConnection";
import marleneConfig from "@/app/agentConfigs/marlene";

interface CameraRequest { id: string; left: number; }
interface UIEvent { name: string; icon: string; color: string; }

export default function SimplePage() {
  const [connected, setConnected] = useState(false);
  const [uiEvents, setUiEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    startConnection();
    
    // Atualizar o relógio a cada segundo
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    
    updateClock(); // Inicializar imediatamente
    const clockInterval = setInterval(updateClock, 60000); // Atualizar a cada minuto
    
    return () => { 
      stopConnection(); 
      closeCamera(); 
      clearInterval(clockInterval);
    };
  }, []);

  // Quando receber o stream, anexa ao <video>
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      videoRef.current.onloadedmetadata = () =>
        videoRef.current?.play().catch(console.error);
    }
  }, [cameraStream]);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
    } catch (err) {
      console.error("openCamera erro:", err);
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
  }

  function triggerIcon(evt: UIEvent) {
    setUiEvents(u => [...u, evt]);
    setTimeout(() => setUiEvents(u => u.slice(1)), 3000);
  }

  async function startConnection() {
    if (!audioRef.current) {
      const a = document.createElement("audio");
      a.autoplay = true;
      audioRef.current = a;
    }
    try {
      const { pc, dc } = await createRealtimeConnection(
        process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
        audioRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.onopen = () => {
        setConnected(true);
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: marleneConfig[0].instructions,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
              create_response: true,
            },
            tools: marleneConfig[0].tools,
          },
        }));
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      dc.onmessage = e => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch {
          console.error("Falha ao parsear mensagem RTC:", e.data);
          return;
        }

        if (msg.type === "response.done" && Array.isArray(msg.response.output)) {
          msg.response.output.forEach((it: any) => {
            // solicita o balaozinho de câmera
            if (it.type === "function_call" && it.name === "open_camera") {
              setCameraRequests(c => [...c, { id: uuidv4(), left: 50 }]);
            }

            // ícone de UI
            if (it.type === "function_call" && it.name === "ui_event") {
              let args: UIEvent | null = null;
              try {
                args = JSON.parse(it.arguments);
              } catch (err) {
                console.error("Falha ao parsear ui_event args:", it.arguments, err);
              }
              if (args) triggerIcon(args);
            }

            // fechamento automático da câmera
            if (it.type === "function_call" && it.name === "close_camera") {
              closeCamera();
            }
          });
        }
      };

      dc.onerror = ev => {
        console.error("DataChannel erro", ev);
        setConnected(false);
      };
      dc.onclose = () => setConnected(false);

    } catch (err) {
      console.error("startConnection falhou:", err);
      setConnected(false);
    }
  }

  function stopConnection() {
    const dc = dcRef.current, pc = pcRef.current;
    if (dc?.readyState === "open") {
      try { dc.send(JSON.stringify({ type: "stop" })); } catch {}
    }
    dc?.close();
    pc?.close();
    setConnected(false);
  }

  return (
    <div className="stage">
      <div className="phone-mockup">
        <div className="button-vol-up" />
        <div className="button-vol-down" />
        <div className="button-power" />
        <div className="camera-hole" />
        <div className="notch" />
        <div className="screen">
          {/* Barra de status do telefone */}
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

          {/* ícones de evento */}
          {uiEvents.map((evt, i) => (
            <div key={i} className="ui-event-icon" style={{ color: evt.color }}>
              {evt.icon}
            </div>
          ))}

          {/* balaozinho de câmera */}
          {cameraRequests.map(req => (
            <div
              key={req.id}
              className="camera-request-bubble"
              style={{ left: `${req.left}%` }}
              onClick={() => {
                openCamera();
                setCameraRequests(c => c.filter(x => x.id !== req.id));
              }}
            >
              📷
            </div>
          ))}

          {/* preview da câmera */}
          {cameraStream && (
            <div className="camera-bubble">
              <video ref={videoRef} className="camera-video" />
              <button className="camera-close" onClick={closeCamera}>×</button>
            </div>
          )}

          {/* botão PTT */}
          <button
            className={`ptt-button ${connected ? "speaking" : "paused"}`}
            onClick={() => connected ? stopConnection() : startConnection()}
          />
          <audio ref={audioRef} autoPlay hidden />
        </div>
      </div>

      <style>{`
        .stage {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    overflow: hidden;
    background-color: blue;
}

/* define as variáveis customizadas para os pontos de origem dos gradientes */
@property --25-x-position {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 20%;
}
@property --25-y-position {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 80%;
}
@property --26-x-position {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 80.24350649350647%;
}
@property --26-y-position {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 44.80468749999999%;
}

/* keyframes que animam ambos os gradientes em sincronia */
@keyframes main {
  12% {
    --25-x-position: 15%;
    --25-y-position: 15%;
  }
  19% {
    --26-x-position: 85%;
    --26-y-position: 80%;
  }
  50% {
    --25-x-position: 80%;
    --25-y-position: 15%;
    --26-x-position: 15%;
    --26-y-position: 85%;
  }
}
        /* mockup chapado */
        .phone-mockup {
          position: relative;
          width: 360px;
          height: 780px;
          border-radius: 48px;
          background: #FFF;
          box-shadow:
            0 20px 30px rgba(0,0,0,0.25),
            inset 0 0 0 2px rgba(255,255,255,0.05);
        }

        /* side buttons */
        .button-vol-up,
        .button-vol-down,
        .button-power {
          position: absolute;
          width: 4px;
          background: #333;
          border-radius: 2px;
        }
        .button-vol-up { left: -4px; top: 140px; height: 40px; }
        .button-vol-down { left: -4px; top: 200px; height: 40px; }
        .button-power { right: -4px; top: 180px; height: 80px; }

        /* top camera hole */
        .camera-hole {
          position: absolute;
          top: 16px;
          left: calc(50% - 6px);
          width: 12px;
          height: 12px;
          background: #000;
          border: 2px solid #222;
          border-radius: 50%;
          box-shadow: inset 0 0 2px rgba(255,255,255,0.2);
        }

        /* notch */
        .notch {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 30px;
          background: #e7e7e7;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        /* screen */
        .screen {
          position: absolute;
          top: 45px;
          left: 8px;
          width: calc(100% - 19px);
          height: calc(100% - 66px);
          background: rgb(249, 247, 245);;
          border-radius: 10px 10px 32px 32px;
          overflow: hidden;
          box-shadow: 
            inset 0 0 40px rgba(0,0,0,0.05),
            inset 0 0 2px rgba(0,0,0,0.1);
          position: relative;
        }
        
        /* Adiciona uma textura sutil de ruído */
        .screen::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("data:image/png;base64,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");
          opacity: 0.02;
          z-index: 2;
          pointer-events: none;
        }
        
        /* Adiciona reflexo e gradiente de vidro */
        .screen::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0) 50%),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.05) 100%);
          z-index: 3;
          pointer-events: none;
          border-radius: 10px 10px 32px 32px;
        }

        /* Status bar do telefone */
        .status-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px;
          color: #333;
          background: rgb(242 242 242 / 80%);
          z-index: 10;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .status-bar-time {
          font-weight: 600;
          font-size: 15px;
          color: #222;
        }
        
        .status-bar-icons {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .status-icon {
          height: 14px;
          width: auto;
          color: #222;
          opacity: 0.85;
        }

        /* UI icon */
        .ui-event-icon {
          position: absolute;
          top: 50px; /* Ajustado para ficar abaixo da barra de status */
          right: 16px;
          font-size: 2rem;
          animation: pop .4s ease-out;
          z-index: 11;
        }
        @keyframes pop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        /* camera request bubble */
        .camera-request-bubble {
          position: absolute;
          bottom: -90px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 80px;
          background: #fff;
          border-radius: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          cursor: pointer;
          z-index: 11;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          animation: rise 1.5s ease-out forwards;
        }
        @keyframes rise {
          from { transform: translate(-50%, 0); }
          to   { transform: translate(-50%, -200px); }
        }

        /* camera preview */
        .camera-bubble {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          width: 160px;
          height: 140px;
          border-radius: 16px;
          overflow: hidden;
          z-index: 12;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translate(-50%, 0); }
          50%     { transform: translate(-50%, -8px); }
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-close {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.4);
          color: #fff;
          border: none;
          border-radius: 12px;
          width: 24px;
          height: 24px;
          z-index: 13;
          cursor: pointer;
        }

        .ptt-button {
          position: absolute;
          bottom: 60px;
          left: 84%;
          transform: translateX(-50%);
          width: 70px;
          height: 70px;
          border: none;
          border-radius: 35px;
          background: linear-gradient(45deg, #ff9d55, #ff8548);
          box-shadow: 
            0 4px 12px rgba(255, 133, 0, 0.3),
            0 2px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          z-index: 11;
        }
        
        .ptt-button.speaking {
          animation: pulse 2s infinite;
        }
        
        .ptt-button.paused {
          opacity: 0.7;
          background: linear-gradient(45deg, #ff9d55, #ff8548);
          animation: none;
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 133, 0, 0.5);
            transform: translateX(-50%) scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 133, 0, 0);
            transform: translateX(-50%) scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 133, 0, 0);
            transform: translateX(-50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}