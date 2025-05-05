// src/app/simple/services/AudioService.ts
/**
 * Classe para análise de áudio e detecção de intensidade de fala
 */
export class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private intensityCallback: ((intensity: number) => void) | null = null;
  private intervalId: number | null = null;
  
  /**
   * Configura a análise de áudio a partir de um stream
   * @param stream Stream de áudio a ser analisado
   * @param callback Função de callback para receber a intensidade
   * @returns Sucesso da configuração
   */
  setup(stream: MediaStream, callback: (intensity: number) => void): boolean {
    // Limpar qualquer configuração anterior
    this.cleanup();
    
    try {
      // Criar contexto de áudio
      this.audioContext = new AudioContext();
      
      // Criar analisador
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Criar source de áudio
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      // Criar array de dados
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      // Armazenar callback
      this.intensityCallback = callback;
      
      // Iniciar análise periódica
      this.startAnalysis();
      
      return true;
    } catch (err) {
      console.error('Error setting up audio analysis:', err);
      this.cleanup();
      return false;
    }
  }
  
  /**
   * Inicia a análise periódica de intensidade
   */
  private startAnalysis(): void {
    // Parar análise anterior, se houver
    this.stopAnalysis();
    
    if (!this.analyser || !this.dataArray || !this.intensityCallback) return;
    
    // Iniciar nova análise
    this.intervalId = window.setInterval(() => {
      if (!this.analyser || !this.dataArray) return;
      
      // Obter dados de frequência
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calcular média de intensidade (0-255)
      const average = this.dataArray.reduce((sum, value) => sum + value, 0) / 
                    this.dataArray.length;
      
      // Normalizar para 0-100
      const intensity = Math.min(100, Math.max(0, average / 2.55));
      
      // Notificar callback
      if (this.intensityCallback) {
        this.intensityCallback(intensity);
      }
    }, 100);
  }
  
  /**
   * Para a análise periódica
   */
  private stopAnalysis(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Limpa todos os recursos
   */
  cleanup(): void {
    // Parar análise
    this.stopAnalysis();
    
    // Desconectar source
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    // Fechar contexto de áudio
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
    }
    
    // Limpar referências
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.intensityCallback = null;
  }
  
  /**
   * Define uma função de callback para receber a intensidade
   * @param callback Função de callback
   */
  setIntensityCallback(callback: (intensity: number) => void): void {
    this.intensityCallback = callback;
  }
  
  /**
   * Obtém o contexto de áudio atual
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
  
  /**
   * Obtém o analisador atual
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }
}

// Exporta uma instância singleton
export const audioService = new AudioService();