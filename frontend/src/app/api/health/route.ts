import { NextResponse } from "next/server";

export async function GET() {
  const status: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  return NextResponse.json(status);
}


