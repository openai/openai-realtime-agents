import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

import { ConsultaBeneficio } from "@/app/loanSimulator";

const openai = new OpenAI();
const cacheFile = path.join(process.cwd(), "data", "llm-benefit-cache.json");
let cache: Record<string, ConsultaBeneficio> | null = null;

async function loadCache() {
  if (cache) return;
  try {
    const data = await fs.readFile(cacheFile, "utf8");
    cache = JSON.parse(data);
  } catch {
    cache = {};
  }
}

async function saveCache() {
  if (!cache) return;
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
}

export async function POST(req: Request) {
  try {
    const { numeroBeneficio, nomeCliente } = await req.json();
    await loadCache();
    if (cache && cache[numeroBeneficio]) {
      return NextResponse.json(cache[numeroBeneficio]);
    }

    const system = {
      role: "system",
      content:
        "Você gera dados fictícios de crédito consignado em formato JSON. Responda APENAS com JSON compatível com a interface ConsultaBeneficio.",
    };
    const user = {
      role: "user",
      content: `Cliente: ${nomeCliente}. Benefício: ${numeroBeneficio}.`,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [system, user],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "{}";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonText = text.slice(start, end + 1);
    const result = JSON.parse(jsonText) as ConsultaBeneficio;

    if (cache) {
      cache[numeroBeneficio] = result;
      await saveCache();
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in /loan/consult:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
