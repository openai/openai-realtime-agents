import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

function formEncode(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const householdId: string | undefined = body?.householdId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { data: hh, error } = await supabase
      .from('households')
      .select('stripe_customer_id')
      .eq('id', householdId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'household_query_failed' }, { status: 500 });
    if (!hh?.stripe_customer_id) return NextResponse.json({ error: 'no_stripe_customer' }, { status: 400 });

    const form = formEncode({ customer: hh.stripe_customer_id, return_url: appUrl });
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'stripe_error', detail: json }, { status: 500 });
    return NextResponse.json({ url: json.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

