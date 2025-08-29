import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

function formEncode(obj: Record<string, any>, prefix = ""): string {
  const pairs: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}[${key}]` : key;
    if (val == null) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      pairs.push(formEncode(val, k));
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => {
        if (typeof v === 'object') pairs.push(formEncode(v, `${k}[${i}]`));
        else pairs.push(`${encodeURIComponent(`${k}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else {
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(val))}`);
    }
  }
  return pairs.join("&");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const householdId: string | undefined = body?.householdId;
    const interval: 'monthly'|'annual' | undefined = body?.interval;
    const priceIdFromBody: string | undefined = body?.priceId;
    const priceMonthly = process.env.STRIPE_PRICE_ID_MONTHLY;
    const priceAnnual = process.env.STRIPE_PRICE_ID_ANNUAL;
    const priceId: string | undefined = priceIdFromBody || (interval === 'annual' ? (priceAnnual || priceMonthly) : priceMonthly);
    const email: string | undefined = body?.email;
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });
    if (!priceId) return NextResponse.json({ error: 'price_id_required' }, { status: 400 });

    // Read existing household for customer mapping
    let stripeCustomerId: string | undefined;
    if (householdId) {
      try {
        const { data: hh } = await supabase.from('households').select('stripe_customer_id').eq('id', householdId).maybeSingle();
        stripeCustomerId = hh?.stripe_customer_id || undefined;
      } catch {}
    }

    const form = formEncode({
      mode: 'subscription',
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      'metadata[householdId]': householdId,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      ...(!stripeCustomerId && email ? { customer_email: email } : {}),
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
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
