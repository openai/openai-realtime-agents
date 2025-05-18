import { verificationMachine } from '@/app/simple/machines/verificationMachine';

describe('verificationMachine', () => {
  test('progresses through successful flow', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    let state = verificationMachine.initialState;

    state = verificationMachine.transition(state, { type: 'START' });
    expect(state.value).toBe('preparing');
    expect(state.context.step).toBe(1);
    expect(state.context.startTime).toBe(Date.now());

    state = verificationMachine.transition(state, { type: 'PROGRESS', step: 2 });
    expect(state.value).toBe('analyzing');
    expect(state.context.step).toBe(2);

    state = verificationMachine.transition(state, { type: 'PROGRESS', step: 3 });
    expect(state.value).toBe('verifying');
    expect(state.context.step).toBe(3);

    jest.setSystemTime(new Date('2024-01-01T01:00:00Z'));
    state = verificationMachine.transition(state, { type: 'COMPLETE' });
    expect(state.value).toBe('completed');
    expect(state.context.step).toBe(4);
    expect(state.context.completionTime).toBe(Date.now());

    jest.useRealTimers();
  });

  test('handles cancellation from preparing', () => {
    let state = verificationMachine.initialState;
    state = verificationMachine.transition(state, { type: 'START' });
    state = verificationMachine.transition(state, { type: 'CANCEL' });
    expect(state.value).toBe('idle');
    expect(state.context.step).toBe(0);
    expect(state.context.startTime).toBeNull();
  });

  test('handles error and restart', () => {
    let state = verificationMachine.initialState;
    state = verificationMachine.transition(state, { type: 'START' });
    const err = new Error('boom');
    state = verificationMachine.transition(state, { type: 'ERROR', error: err });
    expect(state.value).toBe('failed');
    expect(state.context.error).toBe(err);

    state = verificationMachine.transition(state, { type: 'START' });
    expect(state.value).toBe('preparing');
    expect(state.context.step).toBe(1);
    expect(state.context.error).toBeNull();
  });
});
