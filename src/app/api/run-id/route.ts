import { NextResponse } from "next/server";

export const RUN_ID = Date.now().toString();

export async function GET() {
  return NextResponse.json({ runId: RUN_ID });
}
