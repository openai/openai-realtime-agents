import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      ...body,
      stream: false,
    } as any);

    return NextResponse.json(completion);
  } catch (err: any) {
    console.error('chat completions proxy error', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
