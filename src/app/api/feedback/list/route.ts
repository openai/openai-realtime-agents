import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const dev = process.env.NEXT_PUBLIC_DEV_ROUTES === '1';
  const token = req.headers.get('x-admin-token');
  const envToken = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!dev && (!envToken || token !== envToken)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('id, created_at, household_id, name, email, category, severity, message, page_url, status, priority')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

