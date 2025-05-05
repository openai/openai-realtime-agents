// src/app/simple/services/AgentService.ts
import marleneConfig from '@/app/agentConfigs/marlene';

/**
 * Classe para gerenciar a comunicação com o agente Marlene
 */
export class AgentService {
  private connection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map();
  private sessionId: string | null = null;
  
  /**
   * Inicializa a conexão com o agente
   * @param apiKey Chave de API para o serviço Realtime
   * @param audioElement Elemento de áudio para reprodução
   * @returns Promise que resolve quando a conexão estiver estabelecida
   */
  async connect(apiKey: string, audioElement: HTMLAudioElement | null): Promise<boolean> {
    try {
      const { createRealtimeConnection } = await import('@/app/lib/realtimeConnection');
      
      // Garantir que temos um elemento de áudio
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.autoplay = true;
      }
      
      // Criar conexão WebRTC
      const { pc, dc } = await createRealtimeConnection(apiKey, { current: audioElement });
      
      this.connection = pc;
      this.dataChannel = dc;
      
      // Configurar handlers de eventos
      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'closed'
        ) {
          this.dispatchEvent('connectionClosed', {});
        }
      };
      
      dc.onopen = () => {
        this.dispatchEvent('connectionOpened', {});
        
        // Enviar a configuração da sessão
        this.sendMessage({
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
        this.sendMessage({ type: "response.create" });
      };
      
      dc.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          
          // Extrair sessionId se disponível
          if (message.type === 'session.created' && message.session?.id) {
            this.sessionId = message.session.id;
            this.dispatchEvent('sessionCreated', { sessionId: this.sessionId });
          }
          
          // Despachar eventos específicos
          if (message.type === 'audio_started') {
            this.dispatchEvent('audioStarted', message);
          } else if (message.type === 'audio_ended') {
            this.dispatchEvent('audioEnded', message);
          }
          
          // Despachar o evento genérico de mensagem
          this.dispatchEvent('message', message);
        } catch (err) {
          console.error('Failed to parse RTC message:', e.data);
        }
      };
      
      dc.onerror = (err) => {
        console.warn('DataChannel error:', err);
        this.dispatchEvent('error', { error: err });
      };
      
      dc.onclose = () => {
        this.dispatchEvent('connectionClosed', {});
      };
      
      return true;
    } catch (err) {
      console.error('Connection error:', err);
      this.dispatchEvent('error', { error: err });
      return false;
    }
  }
  
  /**
   * Envia uma mensagem para o agente
   * @param message Mensagem a ser enviada
   * @returns Sucesso do envio
   */
  sendMessage(message: any): boolean {
    try {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(message));
        return true;
      } else {
        console.warn('Cannot send message - DataChannel not open');
        return false;
      }
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  }
  
  /**
   * Adiciona um ouvinte de eventos
   * @param event Nome do evento
   * @param callback Função de callback
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)!.push(callback);
  }
  
  /**
   * Remove um ouvinte de eventos
   * @param event Nome do evento
   * @param callback Função de callback
   */
  removeEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event)!;
    this.eventListeners.set(
      event,
      listeners.filter(cb => cb !== callback)
    );
  }
  
  /**
   * Despacha um evento para todos os ouvintes
   * @param event Nome do evento
   * @param data Dados do evento
   */
  private dispatchEvent(event: string, data: any): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event)!;
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    });
  }
  
  /**
   * Desconecta do agente
   */
  disconnect(): void {
    const dc = this.dataChannel, pc = this.connection;
    
    // Tentar enviar mensagem de parada
    if (dc?.readyState === 'open') {
      try {
        dc.send(JSON.stringify({ type: 'stop' }));
      } catch (err) {
        console.warn('Error sending stop message:', err);
      }
    }
    
    // Fechar o DataChannel
    if (dc) {
      try {
        dc.close();
      } catch (err) {
        console.warn('Error closing DataChannel:', err);
      }
    }
    
    // Fechar a PeerConnection
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        console.warn('Error closing PeerConnection:', err);
      }
    }
    
    this.dataChannel = null;
    this.connection = null;
    this.sessionId = null;
  }
  
  /**
   * Obtém o ID da sessão atual
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * Verifica se a conexão está ativa
   */
  isConnected(): boolean {
    return !!this.dataChannel && this.dataChannel.readyState === 'open';
  }
}

// Exporta uma instância singleton
export const agentService = new AgentService();