# Agent Migration & Architecture Plan

## 1. Current State Summary

Frontend (Vite React) directly defines agent scenarios and connects to OpenAI
Realtime API using an ephemeral key from `/api/session`. Backend (FastAPI)
currently:

- Mints ephemeral realtime session keys (`/api/session`).
- Proxies `/api/responses` to OpenAI Responses API (used for moderation /
  guardrails).
- NEW: Provides foundational agent infrastructure under `backend/agents/` with
  schemas, minimal registry, and scenario endpoints (`/api/scenarios`,
  `/api/scenarios/{id}`, `/api/session2`).

Realtime media (audio) flows browser <-> OpenAI via WebRTC; backend is not in
the media path.

## 2. Target Architecture Goals

1. Server-owned agent & scenario definitions (no FE hard-coded config).
2. Dynamic root agent selection based on app/page/user context.
3. Extensible tool library (DB CRUD, context retrieval, draft generation)
   callable by agents.
4. Policy & orchestration layer enabling handoffs (supervisor, escalation,
   persona switches).
5. Unified guardrails and moderation service (central classification & filtering
   backend-side).
6. Production deployment on Fly.io supporting stateless horizontal scaling
   without SSE fragility.
7. Clean integration point for host app "Dock" chat component.

## 3. Key Components (Backend)

| Component                | Purpose                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `agents/schemas.py`      | Pydantic models for Agent, Scenario, Tool, SessionInit response. |
| `agents/registry.py`     | In-memory (later persisted) scenario & agent definitions.        |
| `agents/tools.py`        | Tool registry + execution dispatcher. Add business logic here.   |
| `agents/orchestrator.py` | Root agent selection + future handoff logic (intent scoring).    |
| `agents/router.py`       | API endpoints for scenarios + enhanced session bootstrap.        |

## 4. Proposed Data Flow (Session Bootstrap)

1. FE requests: `GET /api/scenarios` -> populates Scenario dropdown (or chooses
   automatically per page context).
2. FE requests: `GET /api/scenarios/{id}` to inspect available agents, default
   root.
3. FE calls: `GET /api/session2?scenario_id=retail&root_agent=supervisor`.
4. Backend:
   - Validates scenario & root.
   - Mints ephemeral OpenAI realtime session key.
   - Serializes `initial_agents` list (root first).
   - Returns `SessionInitPayload` (ephemeral key + agent definitions +
     guardrails metadata).
5. FE passes `initial_agents` + ephemeral key into Realtime SDK `connect`.
6. Realtime stream established; handoffs either occur via model instructions or
   later via explicit backend policy events.

## 5. Orchestration & Handoff Strategy

Phase 1 (Now): Static handoff via model instructions only (as today). Phase 2:
Backend intent classifier (Responses API) processes user turns (mirroring
transcript via optional POST). Orchestrator decides new root agent -> FE sends
`session.update` to reorder agents or simply tracks active agent context. Phase
3: Server-originated events over WebSocket (or server-sent polling) to FE to
instruct root switch automatically.

## 6. Tooling Model

- Register tool functions in `agents/tools.py` (e.g., `fetch_project_context`,
  `store_draft_content`).
- Expose tool metadata to FE (optional) or embed inside agent instructions.
- Execution patterns:
  1.  Synchronous Pre-Processing: Backend enriches context before Realtime
      connection (adds contextual paragraphs to root agent instructions).
  2.  Mid-Conversation Tool Calls: FE sends user message -> backend endpoint
      receives text -> executes tool -> returns structured summary -> FE injects
      via `conversation.item.create` before prompting a response.
  3.  Future Native Agent SDK (server) Loop: Use Responses/Agents API
      server-side to augment Realtime session out-of-band.

## 7. Guardrails Centralization

Current: Output guardrail (moderation) configured client-side. Future: Backend
route `/api/moderate` wraps Responses API classifier -> FE calls before dispatch
OR backend intercepts conversation stream (if using server-driven pathway).

## 8. WebRTC vs WebSocket on Fly.io

- WebRTC (current) is optimal for low-latency bi-directional audio; media flows
  P2P (or via OpenAI TURN) and scales horizontally because app servers are not
  terminating the RTP streams.
- WebSockets would be needed only if you proxy Realtime traffic or embed a
  custom transport (higher infra & bandwidth cost, adds scaling complexity).
- Recommendation: Retain WebRTC for audio path. Introduce a lightweight
  WebSocket (or SSE if single instance) only for backend-driven orchestration
  events (agent switch notifications, tool result streaming). On Fly.io with
  multiple instances: prefer WebSocket + a shared pub/sub (e.g., Fly Redis,
  NATS) for orchestration; avoid SSE reliance for stateful multi-instance
  routing.

## 9. Migration Phases (Detailed)

Phase A – Backend Foundations (DONE partial): Schemas, registry, session2
endpoint. Phase B – FE Consumption: Replace local agent config usage with
`/api/scenarios` + `/api/session2`. Phase C – Tool Layer: Implement core tools
(context fetch, draft persistence). Add execution endpoint `/api/tools/execute`.
Phase D – Intent & Handoff: Add `/api/orchestrate` that ingests last user +
agent messages; returns recommended root agent. FE applies via `session.update`.
Phase E – Moderation Consolidation: FE sends outbound user text to
`/api/moderate` before sending to Realtime. Phase F – Draft Upsert Integration:
Tool call returns structured draft objects; FE (or backend) persists to Supabase
via existing service client using agent-user credentials. Phase G –
Observability: Structured logs, correlation IDs, latency metrics. Phase H –
Persistence (optional): Move scenario registry to DB or config store.

## 10. Dock Integration Guidelines

- Encapsulate existing transcript + event contexts into a higher-order
  `RealtimeProvider`.
- Abstract connect flow into a `useRealtimeSessionManager(pageContext)` hook
  which:
  1.  Resolves scenario id + root via backend orchestration endpoint.
  2.  Opens session using returned payload.
  3.  Subscribes to orchestration push channel (future WebSocket).
- Provide `sendUserText`, `startPTT`, `stopPTT`, `interrupt`,
  `downloadRecording` to Dock UI.
- Logs pane becomes a tab; minimal CSS changes.

## 11. Supabase Context Injection

Prior to session creation:

1. FE posts page + user + project IDs to `/api/context/snapshot`.
2. Backend assembles structured context (selected records, ACL summary, recent
   drafts) and returns a context block.
3. This block is appended to root agent instructions or included in first
   simulated user message (e.g., “Context:\n<block>”).

## 12. Minimal Pydantic Additions (Future)

Add `ToolResult` model, `OrchestrationDecision` model, and `ModerationDecision`
model for typed endpoints.

## 13. Security Considerations

- Never expose full DB identifiers unless needed; map to internal references.
- Rate limit tool execution endpoints.
- Validate root agent choices against scenario registry.
- Sanitize user-provided context to strip PII where policy requires.

## 14. Rollout Strategy

1. Ship `/api/scenarios` + `/api/session2`; toggle FE via feature flag.
2. Backfill tools & orchestration behind disabled endpoints until stable.
3. Enable moderation endpoint; remove client-side guardrail creation.
4. Gradually deprecate legacy `/api/session` once FE switched.

## 15. Next Immediate Tasks

- Replace FE agent config usage with backend scenario fetch (Phase B).
- Implement basic context ingestion endpoint.
- Introduce a placeholder tool (e.g., `echo_context`).
- Add moderation endpoint scaffold.

## 16. Open Questions / Decisions Needed

- Which persistence layer (just environment config or DB) for scenarios
  long-term?
- Do we need per-project customized agent graphs (multi-tenant variance)?
- Preferred auth mechanism for tool execution endpoints (reuse existing Supabase
  session or internal service key)?

## 17. Summary

We now have a backend skeleton ready to absorb agents, scenarios, tools, and
orchestration. Next step: shift FE to consume `/api/scenarios` +
`/api/session2`, then iteratively layer tools, moderation, and root selection
logic while preserving current UX & audio performance via WebRTC.

## 18. Implemented Endpoints (Backend Skeleton)

| Method | Path                    | Purpose                                    |
| ------ | ----------------------- | ------------------------------------------ |
| GET    | `/api/health`           | Basic health check (existing)              |
| GET    | `/api/session`          | Original ephemeral key only                |
| POST   | `/api/responses`        | Proxy to OpenAI Responses API              |
| GET    | `/api/scenarios`        | List scenarios                             |
| GET    | `/api/scenarios/{id}`   | Scenario detail                            |
| GET    | `/api/session2`         | Enhanced session init (agents + key)       |
| POST   | `/api/tools/execute`    | Execute registered tool (placeholder)      |
| POST   | `/api/context/snapshot` | Return assembled page/project/user context |
| POST   | `/api/moderate`         | Placeholder moderation decision            |
| POST   | `/api/orchestrate`      | Placeholder orchestration (root selection) |
| POST   | `/api/agent/run`        | Server-side single-turn agent (Responses)  |

All new files kept under `backend/agents/` per your redistribution preference.

## 19. Server-side Agent Runner Strategy

`/api/agent/run` currently wraps a single-turn Responses API call (parallel tool
call flag on). This is an interim layer until native OpenAI Agent SDK server
integration is added. Migration path:

1. Maintain `agent_runner.py` abstraction so FE and orchestration code call a
   stable interface.
2. When Agent SDK is installed, implement a sessionful server agent (streaming +
   tool loop) behind the same endpoint or a new `/api/agent/session`.
3. Gradually shift complex tool orchestration out of FE by sending transcript
   deltas to backend which decides next tool vs model action.
4. Preserve response JSON shape (at least: id, output text segments, tool_call
   results) to minimize FE refactors.

Open Questions:

- Will multi-turn server memory live in Redis or DB? (Plan: ephemeral Redis
  keyed by session id.)
- Do we unify realtime and server agent transcripts or keep parallel logs?
  (Recommend tagging sources and merging for UI.)

## 20. Agents SDK Session Endpoints (New)

Implemented a thin wrapper over the OpenAI Agents Python SDK to enable stateful
multi-turn server conversations alongside the existing client Realtime flow.
Endpoints:

| Method | Path                          | Purpose                                                 |
| ------ | ----------------------------- | ------------------------------------------------------- |
| POST   | `/api/sdk/session/create`     | Create (or idempotently get) an agent session id + spec |
| POST   | `/api/sdk/session/message`    | Run a user turn through the server-side agent + tools   |
| GET    | `/api/sdk/session/transcript` | Retrieve accumulated session transcript items           |

Request / Response Sketches:

- Create:
  - Request:
    `{ session_id?: string, agent_name: string, instructions: string, model?: string }`
  - Response: `{ session_id, agent_name, model }`
- Message:
  - Request:
    `{ session_id, user_input, agent?: { name?, instructions?, model? } }`
  - Response:
    `{ final_output: string, new_items_len: number, tool_calls: string[] }`
- Transcript:
  - Response: `{ session_id, items: [...], length: number }`

Design Notes:

1. Stateless Web tier holds in-memory `SQLiteSession` objects (dictionary).
   Replace with file path or Redis-backed session store for multi-instance.
2. Each message call reconstructs a lightweight `Agent` object (cheap) enabling
   dynamic instruction overrides per turn.
3. Included demo `echo` tool via `@function_tool`; extend by registering
   additional tool functions and supplying them in agent construction.
4. Keeps Realtime path untouched; future hybrid: FE forwards finalized user text
   to both Realtime (for voice response) and server agent (for stateful
   reasoning + tool usage). Merge outputs in UI.
5. Error handling returns 400 on empty input; generic 500 on execution failures
   (improve with structured error codes later).

Next Steps (SDK Layer):

- Add streaming support (if SDK provides) returning incremental deltas.
- Persist session transcripts (SQLite file / Postgres) for analytics.
- Introduce tool authenticity + auth context (user id, project id) passed into
  tool functions.
- Add moderation hook pre-turn using existing `/api/moderate` once upgraded to
  real classifier.
