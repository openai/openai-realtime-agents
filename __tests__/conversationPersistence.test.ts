import { jest } from '@jest/globals';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  } as Storage;
}

describe('conversation persistence', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).localStorage = mockLocalStorage();
  });

  test('rehydrates context when run-id matches', async () => {
    const utils = await import('@/app/agentConfigs/utils');
    const service = await import('@/app/simple/services/ConversationStateService');

    utils.resetConversationContext();
    utils.updateContext({ name: 'Ana' });
    service.saveContext(utils.exportContext(), 'run1');
    utils.resetConversationContext();

    (global as any).fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ runId: 'run1' }),
    });

    const restored = await utils.rehydrateContext();
    expect(restored).toBe(true);
    expect(utils.exportContext().name).toBe('Ana');
  });

  test('clears context when run-id changes', async () => {
    const utils = await import('@/app/agentConfigs/utils');
    const service = await import('@/app/simple/services/ConversationStateService');

    utils.resetConversationContext();
    utils.updateContext({ name: 'Ana' });
    service.saveContext(utils.exportContext(), 'run1');
    utils.resetConversationContext();

    (global as any).fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ runId: 'run2' }),
    });

    const restored = await utils.rehydrateContext();
    expect(restored).toBe(false);
    expect(utils.exportContext().name).toBeUndefined();
    expect(service.getStoredRunId()).toBe('run2');
  });
});
