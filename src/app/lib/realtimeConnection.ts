// src/app/lib/realtimeConnection.ts
import { RefObject } from "react";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  console.log("Starting WebRTC connection setup...");
  
  // Configuração básica do RTCPeerConnection
  const pcConfig: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };
  
  const pc = new RTCPeerConnection(pcConfig);

  // Configurar evento de track
  pc.ontrack = (e) => {
    console.log("Track received from server");
    if (audioElement.current) {
      audioElement.current.srcObject = e.streams[0];
      audioElement.current.autoplay = true;
      audioElement.current.play()
        .then(() => console.log("Audio playback started successfully"))
        .catch(err => console.error("Failed to start audio playback:", err));
    } else {
      console.warn("No audio element available to attach track");
    }
  };

  // Solicitar acesso ao microfone
  console.log("Requesting microphone access...");
  const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log("Microphone access granted");
  
  // Adicionar track de áudio
  pc.addTrack(ms.getTracks()[0]);

  // Criar canal de dados
  const dc = pc.createDataChannel("oai-events");
  console.log("Data channel created");

  // Criar oferta SDP sem modificações
  console.log("Creating offer...");
  const offer = await pc.createOffer({ 
    offerToReceiveAudio: true,
    offerToReceiveVideo: false
  });
  
  // Definir a descrição local sem modificações
  await pc.setLocalDescription(offer);
  console.log("Local description set");

  // Fazer a solicitação para a API
  console.log("Making request to OpenAI Realtime API...");
  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview"; // Usando apenas o modelo base sem a data
  
  try {
    // Log para debug
    console.log("SDP offer being sent:", offer.sdp?.substring(0, 100) + "...");
    
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
    throw error;
  }
}