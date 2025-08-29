Feedback pipeline
=================

Goal
- Capture early‑tester feedback (bugs/suggestions) in a structured way, store it centrally, and optionally notify the team in Slack. This becomes your backlog for prioritization.

Tables (Supabase)
- Create a `feedback` table (SQL):

  create table if not exists feedback (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    household_id text,
    name text,
    email text,
    category text,    -- bug | idea | ux | performance | other
    severity text,    -- low | med | high | critical
    message text,
    page_url text,
    user_agent text,
    status text default 'open',  -- open | triaged | in_progress | done
    priority text default 'p3',  -- p0 | p1 | p2 | p3
    extra jsonb default '{}'::jsonb
  );

  create index if not exists idx_feedback_created_at on feedback(created_at desc);

API
- POST /api/feedback/submit  (already implemented)
  - Body: { householdId?, name?, email?, category, severity, message, page_url? }
  - Writes to `feedback` and returns { ok, id }.
  - If SLACK_WEBHOOK_URL is set, posts a concise Slack message for triage.

Slack (optional)
- Create an Incoming Webhook and set env var: SLACK_WEBHOOK_URL.
- New items post with severity emoji and summary for team visibility.

Prioritization
- Use Supabase table as the source of truth; add columns/labels as needed.
- You can export as CSV for external tools (Linear/Jira/Notion) or build a simple admin list later.

