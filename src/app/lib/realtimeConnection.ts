// src/app/lib/realtimeConnection.ts
import { RefObject } from "react";

// Helper to create an AbortSignal with a timeout.
// Uses AbortSignal.timeout when available (Node 18+, some browsers)
// and falls back to AbortController with setTimeout for compatibility.
function timeoutSignal(ms: number): AbortSignal {
  const anyAbortSignal = AbortSignal as any;
  if (typeof anyAbortSignal.timeout === "function") {
    return anyAbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  console.log("Starting WebRTC connection setup...");
  
  // Configuração aprimorada do RTCPeerConnection com servidores STUN e TURN
  const pcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      // Adicione seus próprios servidores TURN aqui se disponíveis
      // { 
      //   urls: "turn:your-turn-server.com",
      //   username: "username",
      //   credential: "password"
      // }
    ],
    iceCandidatePoolSize: 10, // Melhorar a coleta de candidatos ICE
    iceTransportPolicy: 'all' // Permitir todos os tipos de conexões
  };
  
  const pc = new RTCPeerConnection(pcConfig);

  // Configuração avançada para melhorar a qualidade de áudio/vídeo
  try {
    pc.setConfiguration({
      ...pcConfig,
      sdpSemantics: 'unified-plan'
    } as RTCConfiguration & { sdpSemantics?: string });
  } catch (e) {
    console.warn("Advanced config not supported:", e);
  }

  // Configurar evento de track com melhor tratamento de erros
  pc.ontrack = (e) => {
    console.log("Track received from server");
    if (audioElement.current) {
      if (audioElement.current.srcObject !== e.streams[0]) {
        audioElement.current.srcObject = e.streams[0];
        audioElement.current.autoplay = true;
        
        // Melhor tratamento de erros na reprodução de áudio
        audioElement.current.play()
          .then(() => console.log("Audio playback started successfully"))
          .catch(err => {
            console.error("Failed to start audio playback:", err);
            // Tentar novamente após interação do usuário
            const retryPlayback = () => {
              audioElement.current?.play()
                .then(() => {
                  console.log("Audio playback started on user interaction");
                  document.removeEventListener("click", retryPlayback);
                })
                .catch(e => console.error("Still failed to play audio:", e));
            };
            document.addEventListener("click", retryPlayback, { once: true });
          });
      }
    } else {
      console.warn("No audio element available to attach track");
    }
  };

  // Tratamento de eventos de estado de conexão
  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state changed:", pc.iceConnectionState);
  };

  // Solicitar acesso ao microfone com tratamento de erros aprimorado
  console.log("Requesting microphone access...");
  try {
    const ms = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    console.log("Microphone access granted");
    
    // Adicionar track de áudio
    ms.getTracks().forEach(track => {
      pc.addTrack(track, ms);
      console.log(`Added track: ${track.kind}`);
    });
  } catch (err) {
    console.error("Failed to get microphone access:", err);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Microphone access denied: ${message}`);
  }

  // Criar canal de dados com configurações otimizadas
  const dc = pc.createDataChannel("oai-events", {
    ordered: true,
    maxRetransmits: 3  // Limitar número de retransmissões para mensagens mais recentes
  });
  console.log("Data channel created");

  // Criar oferta SDP com preferências para áudio de alta qualidade
  console.log("Creating offer...");
  const offerOptions = { 
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
    voiceActivityDetection: true
  };
  
  const offer = await pc.createOffer(offerOptions);
  
  // Melhorar a qualidade de áudio
  if (offer.sdp) {
    let sdp = offer.sdp;
    // Aumentar prioridade de áudio
    sdp = sdp.replace('a=mid:0', 'a=mid:0\na=content:main');
    
    // Definir a descrição local com SDP aprimorado
    const enhancedOffer = new RTCSessionDescription({
      type: 'offer',
      sdp: sdp
    });
    
    await pc.setLocalDescription(enhancedOffer);
  } else {
    await pc.setLocalDescription(offer);
  }
  
  console.log("Local description set");

  // Fazer a solicitação para a API com tratamento de erro aprimorado
  console.log("Making request to OpenAI Realtime API...");
  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview"; // Usando apenas o modelo base sem a data
  
  try {
    // Log para debug
    console.log("SDP offer being sent:", pc.localDescription?.sdp?.substring(0, 100) + "...");
    
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: pc.localDescription?.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
      // Adicionar timeout e melhorar tolerância a falhas de rede
      signal: timeoutSignal(20000) // 20 segundos de timeout
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      console.error("API response error:", sdpResponse.status, errorText);
      throw new Error(`API returned ${sdpResponse.status}: ${errorText}`);
    }

    const answerSdp = await sdpResponse.text();
    console.log("Received SDP answer from server:", answerSdp.substring(0, 100) + "...");
    
    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: answerSdp,
    };

    await pc.setRemoteDescription(answer);
    console.log("Remote description set successfully");
    
    return { pc, dc };
  } catch (error) {
    console.error("Realtime connection error:", error);
    
    // Limpar recursos em caso de erro
    pc.getSenders().forEach(sender => {
      if (sender.track) {
        sender.track.stop();
      }
    });
    
    pc.close();
    throw error;
  }
}