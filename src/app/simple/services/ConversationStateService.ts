import { localStorageService } from './LocalStorageService';

const CONTEXT_KEY = 'conversation_context';
const RUN_ID_KEY = 'run_id';

export interface StoredConversation {
  context: any;
  runId: string | null;
}

export function saveContext(context: any, runId?: string): void {
  if (runId) localStorageService.setItem(RUN_ID_KEY, runId);
  localStorageService.setItem(CONTEXT_KEY, context);
}

export function loadContext(): any | null {
  return localStorageService.getItem<any | null>(CONTEXT_KEY, null);
}

export function clearContext(): void {
  localStorageService.removeItem(CONTEXT_KEY);
  localStorageService.removeItem(RUN_ID_KEY);
}

export function getStoredRunId(): string | null {
  return localStorageService.getItem<string | null>(RUN_ID_KEY, null);
}
