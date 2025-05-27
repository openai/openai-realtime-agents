/*
 * Thin wrapper that exposes a subset of functionality needed by the React UI,
 * implemented on top of @openai/agents-core RealtimeSession.
 *
 * NOTE: This is a **work-in-progress** migration helper; it only supports the
 * basic flows required by the `simpleExample` scenario.
 */

import { RealtimeSession, RealtimeAgent } from '@openai/agents-core/realtime';
import { moderationGuardrail } from './guardrails';

// Minimal event emitter (browser-safe, no Node polyfill)
type Listener<Args extends any[]> = (...args: Args) => void;

class MiniEmitter<Events extends Record<string, any[]>> {
  #events = new Map<keyof Events, Listener<any[]>[]>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>) {
    const arr = this.#events.get(event) || [];
    arr.push(fn);
    this.#events.set(event, arr);
  }

  off<K extends keyof Events>(event: K, fn: Listener<Events[K]>) {
    const arr = this.#events.get(event) || [];
    this.#events.set(
      event,
      arr.filter((f) => f !== fn),
    );
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]) {
    const arr = this.#events.get(event) || [];
    arr.forEach((fn) => fn(...args));
  }
}

export type ClientEvents = {
  connection_change: ['connected' | 'connecting' | 'disconnected'];
  message: [any]; // raw transport events (will be refined later)
  audio_interrupted: [];
};

export interface RealtimeClientOptions {
  getEphemeralKey: () => Promise<string>; // returns ek_ string
  initialAgents: RealtimeAgent[]; // first item is root agent
}

export class RealtimeClient {
  #session: RealtimeSession | null = null;
  #events = new MiniEmitter<ClientEvents>();
  #options: RealtimeClientOptions;

  constructor(options: RealtimeClientOptions) {
    this.#options = options;
  }

  on<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void) {
    this.#events.on(event, listener as any);
  }

  off<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void) {
    this.#events.off(event, listener as any);
  }

  async connect() {
    if (this.#session) return;

    const ek = await this.#options.getEphemeralKey();
    const rootAgent = this.#options.initialAgents[0];

    this.#session = new RealtimeSession(rootAgent, {
      transport: 'webrtc',
      outputGuardrails: [moderationGuardrail as any],
    });

    (this.#session as any).on('connection_change', (status: any) => {
      this.#events.emit('connection_change', status as any);
    });

    // Forward every transport event as message for legacy handler
    (this.#session.transport as any).on('*', (ev: any) => {
      this.#events.emit('message', ev);
    });

    this.#session.on('audio_interrupted', () => {
      this.#events.emit('audio_interrupted');
    });

    await this.#session.connect({ apiKey: ek });
  }

  disconnect() {
    this.#session?.close();
    this.#session = null;
    this.#events.emit('connection_change', 'disconnected');
  }

  sendUserText(text: string) {
    if (!this.#session) throw new Error('not connected');
    this.#session.sendMessage(text);
  }

  pushToTalkStart() {
    if (!this.#session) return;
    this.#session.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }

  pushToTalkStop() {
    if (!this.#session) return;
    this.#session.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    this.#session.transport.sendEvent({ type: 'response.create' } as any);
  }

  sendEvent(event: any) {
    this.#session?.transport.sendEvent(event);
  }

  interrupt() {
    this.#session?.transport.interrupt();
  }
}
