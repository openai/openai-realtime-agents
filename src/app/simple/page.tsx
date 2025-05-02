// File: src/app/simple/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { createRealtimeConnection } from "@/app/lib/realtimeConnection";
import marleneConfig from "@/app/agentConfigs/marlene";
import Image from "next/image";
import "@/app/styles/simple-page-styles.css";

interface CameraRequest { id: string; left: number; }
interface UIEvent { name: string; icon: string; color: string; }

export default function SimplePage() {
  const [connected, setConnected] = useState(false);
  const [uiEvents, setUiEvents] = useState<UIEvent[]>([]);
  const [cameraRequests, setCameraRequests] = useState<CameraRequest[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const [speechIntensity, setSpeechIntensity] = useState(0);
  const [verificationActive, setVerificationActive] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [messagesDisabled, setMessagesDisabled] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intensityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

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
      
      if (intensityTimerRef.current) {
        clearInterval(intensityTimerRef.current);
      }
      
      if (verificationTimerRef.current) {
        clearTimeout(verificationTimerRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Função para configurar análise de áudio
  const setupAudioAnalysis = () => {
    if (!audioRef.current || !audioRef.current.srcObject) return;
    
    try {
      // Criar contexto de áudio apenas se ainda não existir
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      
      // Criar source do áudio
      const stream = audioRef.current.srcObject as MediaStream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Criar analisador
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Configurar timer para atualizar intensidade
      if (intensityTimerRef.current) {
        clearInterval(intensityTimerRef.current);
      }
      
      intensityTimerRef.current = setInterval(() => {
        if (!analyserRef.current || !agentIsSpeaking) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calcular média de intensidade (0-255)
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Normalizar para 0-100
        const intensity = Math.min(100, Math.max(0, average / 2.55));
        setSpeechIntensity(intensity);
      }, 100);
    } catch (error) {
      console.error("Erro ao configurar análise de áudio:", error);
    }
  };

  // Função segura para enviar mensagens pelo DataChannel
  const safelySendMessage = (message: any): boolean => {
    try {
      if (dcRef.current && dcRef.current.readyState === "open") {
        dcRef.current.send(JSON.stringify(message));
        return true;
      } else {
        console.warn("DataChannel não está aberto, mas continuando o fluxo");
        return false;
      }
    } catch (err) {
      console.warn("Erro ao enviar mensagem:", err);
      return false;
    }
  };

  // Função atualizada para simular o processo de verificação natural
  const startVerificationSequence = () => {
    if (verificationActive) return; // Evita iniciar mais de uma vez
    
    setVerificationActive(true);
    setVerificationStep(1);
    // Desabilita mensagens de texto durante a verificação
    setMessagesDisabled(true);
    
    // Limpa qualquer timer existente
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
    }
    
    // Determina se é possível enviar mensagens
    const canSendMessages = dcRef.current && dcRef.current.readyState === "open";
    if (!canSendMessages) {
      console.warn("Não é possível iniciar a sequência: DataChannel não está aberto");
      setVerificationActive(false);
      setMessagesDisabled(false);
      return;
    }
    
    // Passo 1: Marlene fala naturalmente (sem texto)
    verificationTimerRef.current = setTimeout(() => {
      setVerificationStep(2);
      
      // Solicita uma resposta do agente, sem mostrar texto
      try {
        safelySendMessage({ 
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "[VERIFICAÇÃO INICIADA]" }],
          },
        });
        
        safelySendMessage({ type: "response.create" });
      } catch (err) {
        console.warn("Erro ao solicitar resposta durante verificação:", err);
      }
      
      // Passo 2: Segunda etapa da verificação (3 segundos depois)
      verificationTimerRef.current = setTimeout(() => {
        setVerificationStep(3);
        
        // Passo 3: Verificação concluída (4 segundos depois)
        verificationTimerRef.current = setTimeout(() => {
          setVerificationStep(4);
          
          // Passo 4: Fechamento da câmera (1 segundo depois)
          verificationTimerRef.current = setTimeout(() => {
            try {
              // Envia a chamada de função close_camera
              safelySendMessage({
                type: "conversation.item.create",
                item: {
                  id: uuidv4(),
                  type: "function_call",
                  function: {
                    name: "close_camera",
                    arguments: "{}",
                  },
                },
              });
              
              // Fecha a câmera na UI independente da resposta
              closeCamera();
              
            } catch (error) {
              console.warn("Erro ao fechar câmera, mas continuando fluxo:", error);
              closeCamera(); // Garante que a câmera seja fechada mesmo com erro
            }
            
            // Passo 5: Continuação do fluxo (1 segundo depois)
            verificationTimerRef.current = setTimeout(() => {
              try {
                // Solicita uma resposta do agente para continuar o fluxo
                safelySendMessage({ 
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "[VERIFICAÇÃO CONCLUÍDA]" }],
                  },
                });
                
                safelySendMessage({ type: "response.create" });
                
                // Finaliza o ciclo de verificação
                setVerificationActive(false);
                setVerificationStep(0);
                // Reabilita mensagens de texto
                setMessagesDisabled(false);
                
              } catch (err) {
                console.warn("Erro na etapa final, mas verificação foi concluída:", err);
                setVerificationActive(false);
                setVerificationStep(0);
                setMessagesDisabled(false);
              }
            }, 1000);
            
          }, 1000);
        }, 4000);
      }, 3000);
    }, 2000);
  };

  // Quando receber o stream, anexa ao <video>
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
        
        // Inicia automaticamente a sequência de verificação depois de garantir que o vídeo está reproduzindo
        setTimeout(() => {
          startVerificationSequence();
        }, 1000);
      };
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
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }

  function triggerIcon(evt: UIEvent) {
    setUiEvents(u => [...u, evt]);
    setTimeout(() => setUiEvents(u => u.slice(1)), 3000);
  }

  // Função melhorada para lidar com desconexões inesperadas
  const handleUnexpectedDisconnection = () => {
    // Se estiver em verificação, conclui o fluxo local
    if (verificationActive) {
      console.warn("Conexão interrompida durante verificação. Finalizando localmente.");
      closeCamera();
      setVerificationActive(false);
      setVerificationStep(0);
      setMessagesDisabled(false);
    } else {
      setConnected(false);
      setAgentIsSpeaking(false);
    }
  };

  async function startConnection() {
    if (connected) return;

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

      // Configurar áudio e análise quando a conexão for estabelecida
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          setupAudioAnalysis();
        }
      };

      // Adicionar tratamento de erros mais robusto
      pc.onerror = (err) => {
        console.warn("PeerConnection erro - tratando graciosamente:", err);
        // Só altera o estado se não estiver em verificação
        if (!verificationActive) {
          setConnected(false);
          setAgentIsSpeaking(false);
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state change:", pc.iceConnectionState);
        if (pc.iceConnectionState === "disconnected" || 
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "closed") {
          handleUnexpectedDisconnection();
        }
      };

      dc.onopen = () => {
        console.log("DataChannel aberto");
        setConnected(true);
        
        // Envia a configuração da sessão
        safelySendMessage({
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
        });
        
        // Inicia a conversa
        safelySendMessage({ type: "response.create" });
      };

      dc.onmessage = e => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch (err) {
          console.error("Falha ao parsear mensagem RTC:", e.data);
          return;
        }

        // Salva o sessionId se recebido
        if (msg.type === "session.created" && msg.session?.id) {
          sessionIdRef.current = msg.session.id;
        }

        // Detectar quando o agente começa e termina de falar
        if (msg.type === "audio_started") {
          setAgentIsSpeaking(true);
        } else if (msg.type === "audio_ended") {
          setAgentIsSpeaking(false);
          setSpeechIntensity(0);
        }

        if (msg.type === "response.done" && Array.isArray(msg.response?.output)) {
          msg.response.output.forEach((it: any) => {
            // solicita o balãozinho de câmera
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

            // fechamento manual da câmera (caso não esteja em verificação)
            if (it.type === "function_call" && it.name === "close_camera" && !verificationActive) {
              closeCamera();
            }
          });
        }
      };

      dc.onerror = (ev) => {
        console.warn("DataChannel erro - tratando graciosamente:", ev);
        // Não interrompe o fluxo de verificação se estiver ativo
        if (!verificationActive) {
          setConnected(false);
          setAgentIsSpeaking(false);
        }
      };
      
      dc.onclose = () => {
        console.log("DataChannel fechado");
        handleUnexpectedDisconnection();
      };

    } catch (err) {
      console.error("startConnection falhou:", err);
      setConnected(false);
      setAgentIsSpeaking(false);
    }
  }

  function stopConnection() {
    // Limpar todos os timers
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    
    if (intensityTimerRef.current) {
      clearInterval(intensityTimerRef.current);
      intensityTimerRef.current = null;
    }
    
    // Cancelar qualquer verificação em andamento
    setVerificationActive(false);
    setVerificationStep(0);
    setMessagesDisabled(false);
    
    // Fechar a câmera
    closeCamera();
    
    // Fechar a conexão
    const dc = dcRef.current, pc = pcRef.current;
    if (dc?.readyState === "open") {
      try { 
        dc.send(JSON.stringify({ type: "stop" })); 
      } catch (err) {
        console.warn("Erro ao enviar mensagem de parada:", err);
      }
    }
    
    if (dc) {
      try {
        dc.close();
      } catch (err) {
        console.warn("Erro ao fechar DataChannel:", err);
      }
    }
    
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn("Erro ao fechar PeerConnection:", err);
      }
    }
    
    // Limpar contexto de áudio
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn("Erro ao fechar AudioContext:", err);
      }
    }
    
    setConnected(false);
    setAgentIsSpeaking(false);
    sessionIdRef.current = null;
  }

  return (
    <div className="stage">
      <div className="blur-backdrop"></div>
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

          {/* Browser navbar */}
          <div className="browser-navbar">
            <div className="browser-navbar-left">
              <button className="browser-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="browser-navbar-center">
              <div className="browser-urlbar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="browser-lock-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2"/>
                </svg>
                <span className="browser-url">formalizacao.com.br</span>
              </div>
            </div>
            <div className="browser-navbar-right">
              <button className="browser-btn">
                <div className="browser-tab">1</div>
              </button>
              <button className="browser-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="1" strokeWidth="3"/>
                  <circle cx="12" cy="5" r="1" strokeWidth="3"/>
                  <circle cx="12" cy="19" r="1" strokeWidth="3"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Logo do Itaú */}
          <div className="itau-logo">
            <Image 
              src="/images/brand.svg" 
              alt="Itaú Logo" 
              width={0}
              height={0}
              style={{ width: 'auto', height: 'auto', maxHeight: '40px' }}
              priority
            />
          </div>
          
          {/* Header com título e nome */}
          <div className="header-content">
            <h1 className="page-title">Crédito Consignado</h1>
            <p className="user-name">Maria Justina Linhares</p>
          </div>

          {/* Indicador de verificação */}
          {verificationActive && (
            <div className="verification-indicator">
              <div className="verification-step-text">
                {verificationStep === 1 && "Aguardando análise..."}
                {verificationStep === 2 && "Analisando documento..."}
                {verificationStep === 3 && "Verificando identidade..."}
                {verificationStep === 4 && "Verificação concluída!"}
              </div>
              <div className="verification-progress">
                <div 
                  className="verification-bar" 
                  style={{ 
                    width: `${(verificationStep / 4) * 100}%`,
                    backgroundColor: verificationStep === 4 ? '#2cb67d' : '#ff8548'
                  }}
                ></div>
              </div>
            </div>
          )}

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
              <button className="camera-close" onClick={() => {
                // Cancela a verificação se estiver em andamento
                if (verificationActive) {
                  if (verificationTimerRef.current) {
                    clearTimeout(verificationTimerRef.current);
                  }
                  setVerificationActive(false);
                  setVerificationStep(0);
                  setMessagesDisabled(false);
                }
                closeCamera();
              }}>×</button>
            </div>
          )}

          {/* botão PTT */}
          <button
            className={`ptt-button ${connected ? "speaking" : "paused"}`}
            onClick={() => connected ? stopConnection() : startConnection()}
          />
          
          {/* Footer com gradiente animado */}
          <div className={`animated-footer ${agentIsSpeaking ? "speaking" : ""}`}></div>
          <audio ref={audioRef} autoPlay hidden />
        </div>
      </div>
    </div>
  );
}