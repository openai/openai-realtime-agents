// src/app/simple/hooks/useAudioAnalysis.ts
import { useEffect, useRef } from 'react';
import { useUI } from '../contexts/UIContext';

export const useAudioAnalysis = (audioStream: MediaStream | null) => {
  const { agentIsSpeaking, setSpeechIntensity } = useUI();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Limpar qualquer análise anterior
    const cleanup = () => {
      if (intervalIdRef.current) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      
      audioContextRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
      setSpeechIntensity(0);
    };
    
    // Se não houver stream ou o agente não estiver falando, limpar
    if (!audioStream || !agentIsSpeaking) {
      cleanup();
      return;
    }
    
    // Configurar análise de áudio
    try {
      // Criar contexto de áudio
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      
      // Criar analisador
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Criar source de áudio
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);
      
      // Criar array de dados
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      // Iniciar análise periódica
      intervalIdRef.current = window.setInterval(() => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        // Obter dados de frequência
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calcular média de intensidade (0-255)
        const average = dataArrayRef.current.reduce((sum, value) => sum + value, 0) / 
                      dataArrayRef.current.length;
        
        // Normalizar para 0-100
        const intensity = Math.min(100, Math.max(0, average / 2.55));
        
        // Atualizar estado
        setSpeechIntensity(intensity);
      }, 100);
    } catch (err) {
      console.error('Error setting up audio analysis:', err);
      cleanup();
    }
    
    // Limpar ao desmontar
    return cleanup;
  }, [audioStream, agentIsSpeaking, setSpeechIntensity]);
};