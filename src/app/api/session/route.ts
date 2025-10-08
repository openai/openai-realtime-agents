import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const data = await openai.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: "gpt-realtime",
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            voice: "marin",
          },
        },
      },
    });

    return NextResponse.json({
      client_secret: {
        value: data.value,
        expires_at: data.expires_at,
      },
      session: data.session,
    });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
