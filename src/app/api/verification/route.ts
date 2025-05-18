import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let imageData: string | null = null;

    if (contentType.includes("application/json")) {
      const { image } = await req.json();
      if (typeof image === "string") {
        imageData = image;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as Blob | null;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageData = `data:${file.type};base64,${buffer.toString("base64")}`;
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Compare esta imagem com a foto do documento em nosso cadastro e responda apenas 'SIM' ou 'NAO'.",
          },
          { type: "image_url", image_url: { url: imageData } },
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "";
    const verified = /^sim$/i.test(text);

    return NextResponse.json({ verified, text });
  } catch (error: any) {
    console.error("Error in /verification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
