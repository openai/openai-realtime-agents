let POST: typeof import('@/app/api/loan/consult/route').POST;
import { NextResponse } from 'next/server';
import { consultarBeneficio } from '@/app/loanSimulator';
import fs from 'fs';
import path from 'path';
import os from 'os';

// mock OpenAI module
// use `var` so the variable is hoisted and available inside the factory
var createMock: jest.Mock;

function makeRequest(body: any) {
  return new Request('http://localhost/api/loan/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('loan consult route', () => {
  let cwdSpy: jest.SpyInstance;
  let tmpDir: string;
  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-test-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    createMock = jest.fn();
    jest.doMock('openai', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        chat: { completions: { create: createMock } },
      })),
    }));
    POST = require('@/app/api/loan/consult/route').POST;
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns valid JSON when LLM responds', async () => {
    const mockData = consultarBeneficio('1', 'Jo');
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify(mockData) } },
      ],
    });
    const req = makeRequest({ numeroBeneficio: '1', nomeCliente: 'Jo' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('beneficiario');
  });

  test('uses cache on subsequent call', async () => {
    const mockData = consultarBeneficio('2', 'Ana');
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify(mockData) } },
      ],
    });
    const body = { numeroBeneficio: '2', nomeCliente: 'Ana' };
    const res1 = await POST(makeRequest(body));
    expect(res1.status).toBe(200);
    await res1.json();
    const res2 = await POST(makeRequest(body));
    expect(res2.status).toBe(200);
    await res2.json();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  test('returns 500 on OpenAI failure', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    const req = makeRequest({ numeroBeneficio: '3', nomeCliente: 'Eli' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });
});
