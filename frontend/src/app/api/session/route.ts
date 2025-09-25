import { NextResponse } from 'next/server';

// Ensure Node.js runtime locally and on hosts that support it
export const runtime = 'nodejs';

const OPENAI_SESSIONS_URL =
  'https://api.openai.com/v1/realtime/sessions' as const;
const MODEL = 'gpt-4o-realtime-preview-2025-06-03' as const;

function isTransientNetworkError(err: any) {
  const msg = String(err?.message || err);
  return (
    msg.includes('EAI_AGAIN') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('socket hang up')
  );
}

async function postWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 3,
  baseDelayMs = 500
) {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        // Try to surface API error details
        let errBody: any = undefined;
        try {
          errBody = await res.json();
        } catch {}
        const err = new Error(
          `OpenAI sessions error ${res.status}: ${res.statusText} ${
            errBody ? JSON.stringify(errBody) : ''
          }`.trim()
        );
        // Non-transient HTTP errors: don't retry on 4xx
        if (res.status >= 400 && res.status < 500) throw err;
        lastErr = err;
      } else {
        return res;
      }
    } catch (err: any) {
      lastErr = err;
      if (i < attempts - 1 && isTransientNetworkError(err)) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing OPENAI_API_KEY server env' },
      { status: 500 }
    );
  }

  try {
    const response = await postWithRetry(
      OPENAI_SESSIONS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL }),
      },
      3,
      600
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in /api/session:', error);
    const msg = String(error?.message || error);
    // Surface DNS/connection issues clearly to help local debugging
    const hint = isTransientNetworkError(error)
      ? 'Network/DNS error reaching api.openai.com. Check internet, DNS, VPN/firewall, or try again.'
      : undefined;
    return NextResponse.json(
      { error: 'Failed to create ephemeral session', detail: msg, hint },
      { status: 502 }
    );
  }
}
