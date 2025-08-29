Prosper Billing (Stripe) – Setup Guide
=====================================

Overview
- Freemium + Premium (subscription via Stripe Checkout)
- Server‑side entitlements returned by `/api/prosper/dashboard` and used for UI gating.

Environment Variables
- STRIPE_SECRET_KEY=sk_live_...
- STRIPE_PRICE_ID_MONTHLY=price_...
- STRIPE_PRICE_ID_ANNUAL=price_... (optional)
- STRIPE_WEBHOOK_SECRET=whsec_...
- APP_URL=https://yourapp.com

Supabase Schema (households table)
Add nullable columns to `households`:

  alter table households add column if not exists stripe_customer_id text;
  alter table households add column if not exists subscription_status text;
  alter table households add column if not exists current_period_end timestamp with time zone;
  alter table households add column if not exists plan text;

Endpoints
- POST /api/billing/create-checkout-session
  - Body: { householdId, email?, priceId? }
  - Returns: { url }
  - Uses Stripe REST API (no SDK dependency) to create a subscription Checkout Session.

- POST /api/billing/create-portal-session
  - Body: { householdId }
  - Returns: { url }
  - Creates a Stripe Billing Portal session for the mapped customer.

- POST /api/stripe/webhook
  - Configures a webhook endpoint in Stripe Dashboard pointing to this URL.
  - Verifies `Stripe-Signature` using HMAC SHA‑256.
  - Handles events:
    - checkout.session.completed → stores `stripe_customer_id` on households.
    - customer.subscription.created/updated/deleted → updates `subscription_status`, `current_period_end`, `plan`.

Entitlements
- `/api/prosper/dashboard` now returns:
  { entitlements: { plan: 'free'|'premium', subscription_status?, current_period_end? } }
- Premium if status in [active, trialing, past_due] and (no period end or in future).
- Server caps Net Worth series for free to ~90 days; UI also gates 1y/all toggles.

Paywall Modes
- Feature gating (default): leave `NEXT_PUBLIC_METERED_PAYWALL=0`; only selected features (e.g., long net worth range) are gated.
- Metered (usage-required): set `NEXT_PUBLIC_METERED_PAYWALL=1` and `FREE_SNAPSHOT_LIMIT` (default 3). After the free snapshot limit is reached, the supervisor blocks further tool processing and returns an Upgrade prompt (with a direct Checkout link when possible).

Webhooks
- In Stripe Dashboard → Developers → Webhooks → Add endpoint → URL: `APP_URL/api/stripe/webhook`.
- Select events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
- Copy the Signing secret to STRIPE_WEBHOOK_SECRET.

Testing
- Use Stripe test keys, create test price(s).
- Call POST /api/billing/create-checkout-session with a dev householdId; complete checkout with `4242` card.
- Ensure `/api/prosper/dashboard` shows `entitlements.plan='premium'` after webhook event.
