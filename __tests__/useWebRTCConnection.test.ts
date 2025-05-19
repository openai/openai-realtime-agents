import React from 'react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { useWebRTCConnection } from '@/app/simple/hooks/useWebRTCConnection';
import marleneConfig from '@/app/agentConfigs/marlene';

jest.mock('@/app/lib/realtimeConnection', () => ({
  createRealtimeConnection: jest.fn()
}));

import { createRealtimeConnection } from '@/app/lib/realtimeConnection';

function renderHook<T>(fn: () => T) {
  const result: { current: T | null } = { current: null };
  function Test() {
    result.current = fn();
    return null;
  }
  act(() => {
    renderToString(React.createElement(Test));
  });
  return { result };
}

describe('useWebRTCConnection', () => {
  test('handles function_call output and triggers new response', async () => {
    (global as any).document = {
      createElement: () => ({ autoplay: false })
    } as any;

    const sendMock = jest.fn();
    const dc: any = { readyState: 'open', send: sendMock };
    const pc: any = {};
    (createRealtimeConnection as jest.Mock).mockResolvedValue({ pc, dc });

    const originalToolLogic = marleneConfig[0].toolLogic;
    const functionResult = { ok: true };
    marleneConfig[0].toolLogic = {
      test_fn: jest.fn().mockResolvedValue(functionResult)
    } as any;

    process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'testkey';

    const { result } = renderHook(() => useWebRTCConnection());
    const hook = result.current!;

    await act(async () => {
      await hook.connect();
    });

    act(() => {
      dc.onopen && dc.onopen();
    });

    const initialCalls = sendMock.mock.calls.length;

    const message = {
      type: 'response.done',
      response: {
        output: [
          {
            type: 'function_call',
            name: 'test_fn',
            arguments: JSON.stringify({ foo: 'bar' }),
            call_id: 'abc'
          }
        ]
      }
    };

    await act(async () => {
      dc.onmessage && dc.onmessage({ data: JSON.stringify(message) });
      await Promise.resolve();
    });

    expect((marleneConfig[0].toolLogic as any).test_fn).toHaveBeenCalledWith({ foo: 'bar' });
    expect(sendMock).toHaveBeenCalledTimes(initialCalls + 2);

    const callOutput = JSON.parse(sendMock.mock.calls[initialCalls][0]);
    expect(callOutput).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'abc',
        output: JSON.stringify(functionResult)
      }
    });
    const nextResponse = JSON.parse(sendMock.mock.calls[initialCalls + 1][0]);
    expect(nextResponse).toEqual({ type: 'response.create' });

    marleneConfig[0].toolLogic = originalToolLogic;
  });
});
