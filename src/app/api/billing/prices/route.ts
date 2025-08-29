import { NextResponse } from "next/server";

export async function GET() {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
    const idM = process.env.STRIPE_PRICE_ID_MONTHLY || '';
    const idA = process.env.STRIPE_PRICE_ID_ANNUAL || '';
    async function fetchPrice(id: string) {
      if (!id) return null;
      const r = await fetch(`https://api.stripe.com/v1/prices/${id}?expand[]=product`, { headers: { Authorization: `Bearer ${stripeKey}` }, cache: 'no-store' as any });
      const j = await r.json();
      if (!r.ok) return null;
      return {
        id: j.id,
        currency: j.currency,
        unit_amount: j.unit_amount,
        interval: j.recurring?.interval,
        nickname: j.nickname,
        product: { id: j.product?.id, name: j.product?.name },
      };
    }
    const [monthly, annual] = await Promise.all([fetchPrice(idM), fetchPrice(idA)]);
    return NextResponse.json({ monthly, annual });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

