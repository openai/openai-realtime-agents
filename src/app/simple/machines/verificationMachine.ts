// src/app/simple/machines/verificationMachine.ts
import { createMachine, assign } from '@xstate/fsm';

// Tipos de eventos
type VerificationEvent =
  | { type: 'START' }
  | { type: 'PROGRESS', step: number }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'ERROR', error: Error };

// Tipos de contexto
interface VerificationContext {
  step: number;
  startTime: number | null;
  completionTime: number | null;
  error: Error | null;
}

// Tipos de estado
type VerificationState = {
  value: 'idle' | 'preparing' | 'analyzing' | 'verifying' | 'completed' | 'failed';
  context: VerificationContext;
};

// Criar a máquina de estados
export const verificationMachine = createMachine<VerificationContext, VerificationEvent, VerificationState>({
  id: 'verification',
  initial: 'idle',
  context: {
    step: 0,
    startTime: null,
    completionTime: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'preparing',
          actions: assign<any, any>({
            step: 1,
            startTime: () => Date.now(),
            error: null,
          }),
        },
      },
    },
    preparing: {
      on: {
        PROGRESS: {
          target: 'analyzing',
          actions: assign<any, any>({
            step: (_: any, event: any) => event.step,
          }),
        },
        ERROR: {
          target: 'failed',
          actions: assign<any, any>({
            error: (_: any, event: any) => event.error,
          }),
        },
        CANCEL: {
          target: 'idle',
          actions: assign<any, any>({
            step: 0,
            startTime: null,
            error: null,
          }),
        },
      },
    },
    analyzing: {
      on: {
        PROGRESS: {
          target: 'verifying',
          actions: assign<any, any>({
            step: (_: any, event: any) => event.step,
          }),
        },
        ERROR: {
          target: 'failed',
          actions: assign<any, any>({
            error: (_: any, event: any) => event.error,
          }),
        },
        CANCEL: {
          target: 'idle',
          actions: assign<any, any>({
            step: 0,
            startTime: null,
            error: null,
          }),
        },
      },
    },
    verifying: {
      on: {
        COMPLETE: {
          target: 'completed',
          actions: assign<any, any>({
            step: 4,
            completionTime: () => Date.now(),
          }),
        },
        ERROR: {
          target: 'failed',
          actions: assign<any, any>({
            error: (_: any, event: any) => event.error,
          }),
        },
        CANCEL: {
          target: 'idle',
          actions: assign<any, any>({
            step: 0,
            startTime: null,
            error: null,
          }),
        },
      },
    },
    completed: {
      on: {
        START: {
          target: 'preparing',
          actions: assign<any, any>({
            step: 1,
            startTime: () => Date.now(),
            error: null,
            completionTime: null,
          }),
        },
      },
    },
    failed: {
      on: {
        START: {
          target: 'preparing',
          actions: assign<any, any>({
            step: 1,
            startTime: () => Date.now(),
            error: null,
          }),
        },
      },
    },
  },
});
