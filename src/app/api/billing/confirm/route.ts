import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";

function formEncode(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'session_id_required' }, { status: 400 });
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });

    // Retrieve Checkout Session
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const session = await res.json();
    if (!res.ok) return NextResponse.json({ error: 'stripe_error', detail: session }, { status: 500 });

    const customerId = session.customer as string | undefined;
    const subscriptionId = session.subscription as string | undefined;
    const householdId = session.metadata?.householdId as string | undefined;

    let status: string | undefined;
    let currentPeriodEnd: string | null = null;
    let planId: string | undefined;
    if (subscriptionId) {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
      const sub = await subRes.json();
      if (subRes.ok) {
        status = sub.status as string | undefined;
        currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        planId = sub.items?.data?.[0]?.price?.id as string | undefined;
      }
    }

    if (householdId) {
      await supabase
        .from('households')
        .update({
          stripe_customer_id: customerId,
          subscription_status: status || 'active',
          current_period_end: currentPeriodEnd,
          plan: planId,
        })
        .eq('id', householdId);
    }

    return NextResponse.json({ ok: true, householdId, customerId, status: status || 'active' });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

