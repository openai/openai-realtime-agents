import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    // Retrieve the entire JSON object from the request.
    const body = await req.json();

    // Spread the entire body into the API call.
    const completion = await openai.chat.completions.create({
      ...body,
    });

    return NextResponse.json(completion);
  } catch (error: any) {
    console.error("Error in /chat/completions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
