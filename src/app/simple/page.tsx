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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    startConnection();
    return () => { stopConnection(); closeCamera(); };
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
    background: radial-gradient(100% 100% at var(--25-x-position) var(--25-y-position), #898989 0%, #eaa8a800), radial-gradient(100% 100% at var(--26-x-position) var(--26-y-position), #ffcdcd 0%, #ffd8d800), #ffffff;
    animation: main 8s infinite ease-out;
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
          background: #111;
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
          background: #111;
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
          background: #000de;
          border-radius: 10px 10px 32px 32px;
          overflow: hidden;
        }

        /* UI icon */
        .ui-event-icon {
          position: absolute;
          top: 16px;
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

        /* PTT button */
        .ptt-button {
          position: absolute;
          bottom: 60px;
          left: 84%;
          transform: translateX(-50%);
          width: 70px;
          height: 70px;
          border: none;
          border-radius: 35px;
          background: linear-gradient(45deg, #ff8a00, #ff6400);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: gradientAnim 2s infinite;
          cursor: pointer;
          z-index: 11;
        }
        .ptt-button.paused {
          animation-play-state: paused;
          opacity: .6;
        }
        @keyframes gradientAnim {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}