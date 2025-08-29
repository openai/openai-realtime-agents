import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const dev = process.env.NEXT_PUBLIC_DEV_ROUTES === '1';
  const token = req.headers.get('x-admin-token');
  const envToken = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!dev && (!envToken || token !== envToken)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const patch: any = {};
    if (body?.status) patch.status = String(body.status);
    if (body?.priority) patch.priority = String(body.priority);
    const { error } = await supabase.from('feedback').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

