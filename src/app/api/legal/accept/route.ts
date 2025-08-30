import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const householdId: string | undefined = body?.householdId;
    const terms_version: string = (body?.terms_version || 'v1').toString();
    const privacy_version: string = (body?.privacy_version || 'v1').toString();
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Best-effort: update households table if columns exist. If not, ignore.
    try {
      await supabase
        .from('households')
        .update({
          terms_version,
          terms_accepted_at: new Date().toISOString(),
          privacy_version,
          privacy_accepted_at: new Date().toISOString(),
        } as any)
        .eq('id', householdId);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

