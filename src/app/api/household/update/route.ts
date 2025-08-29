import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const householdId: string | undefined = body?.householdId;
    const email: string | undefined = body?.email;
    const full_name: string | undefined = body?.full_name;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Ensure row exists; upsert only provided fields to avoid clobbering
    const updates: any = { id: householdId };
    if (typeof email === 'string' && email.trim()) updates.email = email.trim();
    if (typeof full_name === 'string' && full_name.trim()) updates.full_name = full_name.trim();

    const { data, error } = await supabase
      .from('households')
      .upsert(updates, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    if (error) return NextResponse.json({ error: 'upsert_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

