Actions (MVP)
=============

Goal
- Let users mark recommendations as completed so they won’t be suggested again, and build a lightweight action log we can use for prioritization and insights.

Supabase Table
-- create table actions with a simple schema (SQL):

  create table if not exists actions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    household_id text not null,
    action_id text,
    title text,
    status text not null default 'done', -- done | dismissed
    notes text,
    completed_at timestamptz
  );

  create index if not exists idx_actions_household on actions(household_id, created_at desc);

API
- POST /api/actions/complete { householdId?, title, action_id?, notes? }
- GET /api/actions/list?householdId=...

UI
- Dashboard → Next Up: “Mark done” button persists completion and removes the item locally.
- Chat: If user says they completed an action, the agent calls completeAction({ title }) and then guides to the next step.

Notes
- Filtering: We filter by normalized title. When we add stable action IDs to recs, switch to id-based filtering.
- KPIs: Marking done doesn’t change KPIs; user still needs to update the underlying numbers for material changes.

