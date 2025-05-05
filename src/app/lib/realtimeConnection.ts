// src/app/lib/realtimeConnection.ts
import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  console.log("Starting WebRTC connection setup...");
  
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    console.log("Track received from server");
    if (audioElement.current) {
      // Configurar o elemento de áudio
      audioElement.current.srcObject = e.streams[0];
      
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
  const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log("Microphone access granted");
  pc.addTrack(ms.getTracks()[0]);

  const dc = pc.createDataChannel("oai-events");
  console.log("Data channel created");

  dc.onopen = () => console.log("Data channel opened successfully");
  dc.onerror = (err) => console.error("Data channel error:", err);

  console.log("Creating offer...");
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log("Local description set");

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