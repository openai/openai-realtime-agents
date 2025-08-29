import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import crypto from 'crypto';

function parseStripeSignature(sigHeader: string | null) {
  if (!sigHeader) return null;
  const parts = sigHeader.split(',').map(p => p.split('='));
  const obj: Record<string, string> = {};
  for (const [k, v] of parts) { if (k && v) obj[k] = v; }
  if (!obj['t'] || !obj['v1']) return null;
  return { t: obj['t'], v1: obj['v1'] };
}

function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string): boolean {
  const sig = parseStripeSignature(sigHeader);
  if (!sig) return false;
  const payload = `${sig.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  // constant-time compare
  if (expected.length !== sig.v1.length) return false;
  let mismatch = 0; for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ sig.v1.charCodeAt(i);
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sigHeader = req.headers.get('stripe-signature');
  const raw = await req.text();

  if (secret) {
    const ok = verifyStripeSignature(raw, sigHeader, secret);
    if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid_payload' }, { status: 400 }); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string | undefined;
        const householdId = session.metadata?.householdId as string | undefined;
        if (customerId && householdId) {
          await supabase.from('households').update({ stripe_customer_id: customerId }).eq('id', householdId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer as string | undefined;
        const status = sub.status as string | undefined;
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const priceId = sub.items?.data?.[0]?.price?.id as string | undefined;
        let householdId: string | undefined = sub.metadata?.householdId;
        if (!householdId && customerId) {
          // Try to map back via stored customer id
          const { data: hh } = await supabase.from('households').select('id').eq('stripe_customer_id', customerId).maybeSingle();
          householdId = hh?.id;
        }
        if (householdId) {
          await supabase.from('households').update({
            subscription_status: status,
            current_period_end: currentPeriodEnd,
            plan: priceId,
            stripe_customer_id: customerId,
          }).eq('id', householdId);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // log and swallow; webhook should succeed to avoid retries storm if db transiently fails
    console.error('stripe_webhook_error', e);
  }

  return NextResponse.json({ received: true });
}

