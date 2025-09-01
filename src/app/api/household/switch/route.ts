import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabase from '@/app/lib/supabaseServer';

const COOKIE = 'pp_household_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('householdId') || url.searchParams.get('id') || '').trim();
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: 'invalid_household_id' }, { status: 400 });
  }

  // Ensure household row exists
  const { data: hh, error: hhErr } = await supabase.from('households').select('id').eq('id', id).maybeSingle();
  if (hhErr) return NextResponse.json({ error: 'household_check_failed', detail: hhErr.message }, { status: 500 });
  if (!hh) {
    const { error: insErr } = await supabase.from('households').insert({ id });
    if (insErr) return NextResponse.json({ error: 'household_insert_failed', detail: insErr.message }, { status: 500 });
  }

  const res = NextResponse.json({ id });
  const cookieStore = await cookies();
  cookieStore.set({ name: COOKIE, value: id, httpOnly: true, sameSite: 'lax', maxAge: ONE_YEAR, path: '/' });
  return res;
}

