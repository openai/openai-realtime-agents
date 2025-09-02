why# Prosper App Testing Checklist

This checklist is designed for manual verification of core flows. Use a clean browser profile (or incognito) and run the app locally (`npm run dev`). Where relevant, verify on desktop and a mobile viewport.

Prereqs
- Node 18+, npm/pnpm
- Supabase env configured in `.env`
- App running at `http://localhost:3000`
- Optional: set `FREE_SNAPSHOT_LIMIT=3` in `.env` for free plan testing

Reset (optional)
- Clear localStorage keys: `pp_terms_v1_accepted`, `pp_uses_toast_shown`, `pp_household_id`

## A. Consent Gating
- [ ] On first load, a full-screen Terms & Privacy modal blocks chat connect
- [ ] “View Terms/Privacy” links open
- [ ] Clicking “I Agree” closes the modal; chat can now connect

## B. Intake & Compute (Chat)
- [ ] Provide location (e.g., Melbourne) and preferred currency (AUD)
- [ ] Provide MQS inputs: net OR gross income; essentials; housing (rent/mortgage/total); debt payments; emergency cash
- [ ] On first compute, agent asks 1–3 extra “Core-Plus” items; compute proceeds once provided or if you insist
- [ ] Snapshot is saved and dashboard updates

## C. Currency Normalization
- [ ] With Melbourne/Australia or explicit AUD, currency shows as AUD across Net Worth, KPI, details
- [ ] Persist on reload

## D. Dashboard – Net Worth
- [ ] Sparkline renders (if series exists)
- [ ] “Updated” timestamp uses short format and no hydration warnings
- [ ] Delta amount and % look correct when values change
- [ ] Assets vs liabilities stacked bar shows equity vs debt logically

## E. Level Card
- [ ] Shows `Level N — Label` with description
- [ ] Journey bar highlights current level and shows surrounding steps
- [ ] “Next level: Level N+1. …” is a single, plain sentence (no jargon)

## F. Progress Insights
- [ ] Statements reflect KPI changes (SR/EF/HR/DSR/DTI/INVNW/RRR)
- [ ] No jargon; priorities make sense

## G. Action Plan
- [ ] Items display with Why/How
- [ ] Mark Done updates the list and persists
- [ ] Dismiss hides item and persists
- [ ] “Ask what’s next” opens chat with a helpful prompt

## H. KPI Grid (Key metrics)
- [ ] Labels are plain language (no acronyms)
- [ ] Targets shown; urgency sort feels reasonable

## I. Review Data Editor
- [ ] Open via “Review data” and via Profile → Review data
- [ ] Dropdowns for non-numeric fields (employment/housing/boolean)
- [ ] Fixed-position `?` icon top-right; click opens popover; click outside closes
- [ ] Required fields show large red asterisk and a red “Required” chip when missing
- [ ] Edits persist and recalc KPIs/Level

## J. Header Chips
- [ ] On free plan with <=3 remaining: “Free uses left” chip visible
- [ ] When required inputs missing: “Missing items” chip visible
- [ ] Both chips can display simultaneously and wrap nicely on narrow widths

## K. Transcript Pane
- [ ] Latest messages visible; input field always visible
- [ ] Scroll area behaves (no overflow past viewport)
- [ ] Sticky compact header; copy/download buttons are removed

## L. Profile Menu
- [ ] Initials avatar (derived from name/email) visible
- [ ] Dropdown opens/closes on click/outside click
- [ ] Edit profile modal saves name/email and persists
- [ ] Review data link opens the data editor
- [ ] Manage plan (premium) / Upgrade (free) routes respond
- [ ] Copy household ID copies to clipboard

## M. Benchmarks (“People like you”)
- [ ] Headline “Top X% of peers (Country, home, income)” under Net Worth
- [ ] Details collapsed by default; expanded view shows mini-bars with p20/p50/p80 ticks and your marker
- [ ] Share: Web Share on mobile; copies link on desktop
- [ ] Shared link renders a branded OG/Twitter image preview

## N. APIs
- [ ] GET `/api/prosper/dashboard?householdId=…` returns latest snapshot, series, entitlements, usage, household
- [ ] POST `/api/prosper/update-input` with `{ householdId, key, value, kind }` saves snapshot and returns KPIs/Levels
- [ ] GET `/api/v1/benchmarks?...` returns `{ cohort, n, metrics, fallback: true, data_source: 'synthetic' }`
- [ ] GET `/share/benchmarks/opengraph-image?...` returns 1200×630 image
- [ ] GET `/share/benchmarks/twitter-image?...` returns 800×418 image

## O. Accessibility & Responsiveness
- [ ] Avatar/button ARIA labels exist; menu has `aria-haspopup`/`aria-expanded`
- [ ] Keyboard navigation works for menus and dialogs
- [ ] Layout is usable on iPhone, Pixel, iPad, and narrow desktop widths

## P. Regression Items
- [ ] No hydration console errors
- [ ] Two header chips can show together
- [ ] Transcript never overflows viewport
- [ ] Currency AUD respected when set
- [ ] Next level text is concise and plain
- [ ] Tooltips open on click and are consistent

---

Tips
- For repeatable data: use the seeding script in `scripts/seed-scenarios.mjs` (see that file header) to pre-fill several households.
- If in doubt, check the Network tab for the POST `/api/prosper/update-input` payloads and server responses.

