// src/app/lib/realtimeConnection.ts
import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  console.log("Starting WebRTC connection setup...");
  
  // Configurações para melhor qualidade de áudio
  const pcConfig: RTCConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ],
    // Prioriza a qualidade e confiabilidade sobre a latência
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
  
  const pc = new RTCPeerConnection(pcConfig);

  pc.ontrack = (e) => {
    console.log("Track received from server");
    if (audioElement.current) {
      // Configurar o elemento de áudio para melhor qualidade
      audioElement.current.srcObject = e.streams[0];
      
      // Configurar para priorizar qualidade de áudio
      audioElement.current.autoplay = true;
      audioElement.current.volume = 1.0;
      audioElement.current.muted = false;
      
      // Eventos para depuração
      audioElement.current.onplay = () => console.log("🔊 Áudio começou a reproduzir!");
      audioElement.current.onplaying = () => console.log("🎵 Áudio está tocando!");
      audioElement.current.onpause = () => console.log("⏸️ Áudio pausado");
      audioElement.current.onended = () => console.log("🏁 Áudio terminou");
      audioElement.current.onerror = (err) => console.error("❌ Erro no elemento de áudio:", err);
      
      // Tenta iniciar a reprodução automaticamente
      audioElement.current.play()
        .then(() => console.log("Reprodução de áudio iniciada com sucesso na conexão inicial"))
        .catch(err => {
          console.error("Erro ao iniciar reprodução de áudio na conexão inicial:", err);
          console.log("O navegador pode estar bloqueando o áudio automático. Aguardando interação do usuário.");
        });
      
      console.log("Audio track attached to audio element");
    } else {
      console.warn("No audio element available to attach track");
    }
  };

  console.log("Requesting microphone access...");
  // Configurando o microfone para melhor qualidade
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1, // Mono é geralmente melhor para voz
      sampleRate: 48000, // Alta taxa de amostragem
      sampleSize: 16 // 16 bits por amostra
    }
  };
  
  const ms = await navigator.mediaDevices.getUserMedia(constraints);
  console.log("Microphone access granted with high quality settings");
  
  // Otimizar a configuração de áudio para comunicação de voz
  const audioTracks = ms.getAudioTracks();
  if (audioTracks.length > 0) {
    const audioSettings = audioTracks[0].getSettings();
    console.log("Audio track settings:", audioSettings);
  }
  
  pc.addTrack(ms.getTracks()[0]);

  // Criação de canal de dados com configurações aprimoradas
  const dcOptions: RTCDataChannelInit = {
    ordered: true, // Entrega ordenada para consistência
    maxRetransmits: 10 // Permite algumas retransmissões
  };
  
  const dc = pc.createDataChannel("oai-events", dcOptions);
  console.log("Data channel created with reliability settings");

  dc.onopen = () => console.log("Data channel opened successfully");
  dc.onerror = (err) => console.error("Data channel error:", err);

  console.log("Creating offer...");
  // Personalizar a oferta para melhor qualidade de áudio
  const offerOptions: RTCOfferOptions = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
    voiceActivityDetection: true // Ativar detecção de atividade de voz
  };
  
  const offer = await pc.createOffer(offerOptions);
  
  // Ajustar SDP para priorizar qualidade de áudio
  if (offer.sdp) {
    offer.sdp = offer.sdp
      // Aumente a prioridade dos codecs de áudio de alta qualidade
      .replace('a=rtpmap:111 opus/48000/2', 'a=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1;stereo=1;maxplaybackrate=48000')
      // Adicione outros parâmetros Opus para melhor qualidade de voz
      .replace('m=audio', 'm=audio 9 UDP/TLS/RTP/SAVPF 111');
  }
  
  await pc.setLocalDescription(offer);
  console.log("Local description set with optimized audio settings");

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview-2024-12-17";

  console.log("Making request to OpenAI Realtime API...");
  
  try {
    console.log(`Using auth token: Bearer ${EPHEMERAL_KEY.substring(0, 5)}...`);
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      console.error("API response error:", sdpResponse.status, errorText);
      throw new Error(`API returned ${sdpResponse.status}: ${errorText}`);
    }

    const answerSdp = await sdpResponse.text();
    console.log("Received SDP answer from server");
    
    // Debug check for valid SDP format
    if (!answerSdp.trim().startsWith("v=")) {
      console.error("Invalid SDP response:", answerSdp.substring(0, 100));
      throw new Error("Invalid SDP response from API - missing 'v=' line");
    }
    
    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: answerSdp,
    };

    console.log("Setting remote description...");
    await pc.setRemoteDescription(answer);
    console.log("Remote description set successfully");
    
    return { pc, dc };
  } catch (error) {
    console.error("Realtime connection error:", error);
    throw error;
  }
}