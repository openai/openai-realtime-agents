// src/app/simple/types.ts

// Tipos de eventos da UI
export interface UIEvent {
  name: string;
  icon: string;
  color: string;
}

// Solicitações de câmera
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
}

// Estado da conexão
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  sessionId: string | null;
  error: Error | null;
}

// Estado da câmera
export interface CameraState {
  stream: MediaStream | null;
  active: boolean;
  error: Error | null;
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
    }>;
  };
  [key: string]: any;
}