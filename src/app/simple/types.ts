// src/app/simple/types.ts
// Tipo para eventos da UI
export interface UIEvent {
  name: string;
  icon: string;
  color: string;
}

// Tipo para solicitações de câmera
export interface CameraRequest {
  id: string;
  left: number;
}

// Estado de verificação
export interface VerificationState {
  active: boolean;
  step: number;
  startTime: number | null;
  completionTime: number | null;
  error: Error | null;
  faceDetectionStatus: {
    detected: boolean;
    centered: boolean;
    verified: boolean;
  };
  pendingMessages: any[]; // Adiciona um campo para armazenar mensagens pendentes durante falhas de conexão
}

// Estado da conexão
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  sessionId: string | null;
  error: Error | null;
  reconnectAttempts?: number; // Contagem de tentativas de reconexão
}

// Estado da câmera
export interface CameraState {
  stream: MediaStream | null;
  active: boolean;
  error: Error | null;
  faceDetected: boolean;
  facePosition: {x: number, y: number, size: number} | null;
  modelsLoaded: boolean;
}
// Estado da animação de empréstimo
export interface LoanState {
  requestedAmount: string | null; // Valor solicitado pelo usuário
  showAnimation: boolean;         // Controla visibilidade da animação
  animationProgress: number;      // Progresso da animação (0-100)
}

// Mensagens do agente
export interface AgentMessage {
  type: string;
  eventId?: string;
  response?: {
    output?: Array<{
      type: string;
      name?: string;
      arguments?: string;
      call_id?: string;
    }>;
  };
  item?: {
    role?: 'user' | 'assistant';
    content?: Array<{
      type?: string;
      text?: string;
    }> | string;
    [key: string]: any;
  };
  [key: string]: any;
}