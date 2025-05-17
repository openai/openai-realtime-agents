// src/app/api/session/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Tentando obter sessão com a chave do ambiente");
    
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY não está configurada nas variáveis de ambiente!");
      return NextResponse.json(
        { error: "API key não configurada" },
        { status: 500 }
      );
    }
    
    // Simplificar o modelo para tentar o mais básico
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview", // Removida a versão específica com a data
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta da API da OpenAI:", response.status, errorText);
      return NextResponse.json(
        { error: `API OpenAI retornou ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log("Resposta da API:", JSON.stringify(data, null, 2));
    
    if (!data.client_secret?.value) {
      console.error("Resposta da API não contém client_secret.value:", data);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro detalhado em /session:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 }
    );
  }
}