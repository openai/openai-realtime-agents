# Project workings (handover)

This document explains how the system works end‑to‑end (backend + frontend), how
agents and tools are configured, how orchestration and events function, and what
setup is required to enable built‑in tools from the OpenAI Agents SDK. Treat it
as a handover for new contributors.

## Architecture overview

- Event‑sourced chat: The backend produces ordered events (seq) for user
  messages, assistant tokens, final assistant messages, handoffs, and later tool
  call/result events.
- Session store: `InMemorySessionStore` implements the `SessionStore` interface
  (easy swap for Redis). It manages sessions, seq counters, events, active
  agent, and idempotency via `client_message_id`.
- Agents registry: `backend/app_agents/registry.py` defines scenario(s) with
  agents (name, role, model, instructions, voice, per‑agent tool allowlists,
  handoff targets).
- Tools registry: `backend/app_agents/tools.py` defines custom tools via
  `ToolSpec` (name, description, func, params_schema). Built‑in tools are
  enabled in code inside `sdk_manager.py`.
- Orchestration: `POST /api/orchestrate` uses a heuristic to route to
  Sales/Support/General based on the last user text; it updates the session’s
  active agent and emits a `handoff` event when a change happens. A manual
  switch endpoint is also provided.
- Frontend: Uses an adaptive events polling hook (`useEvents`) that pauses when
  hidden, stops after idle, and does a short fast‑poll burst post‑send for
  better streaming UX.

## Backend flow (message lifecycle)

1. Create a session — `POST /api/sdk/session/create`

- Input: `{ agent_name, instructions, model, scenario_id, overlay? }`.
- Store creates/updates the session with `active_agent_id` and `scenario_id`.
- `sdk_manager.create_agent_session` resolves the agent’s allowed tools
  (built‑ins + custom via registry) and returns
  `{ session_id, agent_name, model, tools, overlay }`.

2. Send a message — `POST /api/sdk/session/message`

- Router writes a user `message` Event with seq and idempotent
  `client_message_id`.
- `sdk_manager.run_agent_turn` constructs an Agent instance (Agents SDK) with
  the allowlisted tools and runs `Runner.run` with the SQLiteSession for
  transcript.
- The server simulates streaming by emitting `token` Events, then a final
  assistant `message` Event. The final message is stored against
  `client_message_id` for replays.

3. Orchestrate / handoff — `POST /api/orchestrate`

- Heuristic picks the best agent; if different from current, session’s active
  agent is updated and a `handoff` Event is added.
- Manual switch: `POST /api/sdk/session/set_active_agent` does the same with
  reason `manual_switch`.

4. Resume events — `GET /api/sdk/session/{id}/events?since=seq`

- Returns ordered events since the given seq for reliable resume.

5. Tool execution (direct) — `POST /api/tools/execute`

- Enforces current active agent’s allowlist and runs a custom registry function.
  Built‑in tools are bound through the Agents SDK at agent creation time, not
  via this endpoint.

## Agents and tools configuration

Agents are defined in `backend/app_agents/registry.py` under the `default`
scenario:

- `supervisor` (router), `general` (voice‑capable), `sales`, `support`.
- Each agent has a list of allowed tools, e.g., `general` includes
  `"WebSearchTool"` (Agents SDK built‑in) plus custom `echo_context` and
  `weather`.

Custom tools live in `backend/app_agents/tools.py`:

- `ToolSpec` includes `name`, `description`, `func`, `params_schema`
  (JSON‑schema‑like) and are exposed to the Agents SDK via `function_tool(...)`
  on demand.

## Built‑in tools (Agents SDK)

Supported list (per official docs):

- FunctionTool (used for custom functions via `function_tool`)
- FileSearchTool
- WebSearchTool (enabled by default here)
- ComputerTool
- HostedMCPTool
- LocalShellTool (disabled by default; high risk)
- ImageGenerationTool
- CodeInterpreterTool

Enablement lives in code for portability:

- Edit `BUILTIN_TOOLS_ENABLED` in `_resolve_agent_tools` within
  `backend/app_agents/sdk_manager.py`.
- Add a tool’s name to an agent’s `tools` allowlist in `registry.py` to expose
  it to that agent.

### Setup requirements by tool

- FileSearchTool
  - Requires a backing file indexing/storage provider and credentials.
    Instantiate with provider/config.
  - Secure data access; audit logs.
- WebSearchTool
  - May require provider/API credentials depending on SDK version; pass config
    on construction.
  - Rate‑limit usage; sanitize results.
- ComputerTool
  - Requires OS automation permissions; not recommended without sandboxing.
  - Avoid enabling in shared/prod environments.
- HostedMCPTool
  - Needs URL(s) and credentials for an MCP server. Configure TLS and auth.
- LocalShellTool
  - Executes local commands. Keep disabled unless in a locked‑down, offline
    sandbox with strict policy.
- ImageGenerationTool
  - Configure model/provider permissions and quotas.
  - Validate and store outputs appropriately.
- CodeInterpreterTool
  - Needs an isolated runtime (or managed one). Configure resource limits and
    storage locations.

> Tip: If a tool needs configuration, replace default constructors with explicit
> provider configs in `_resolve_agent_tools`.

### Inspecting tool configuration

- GET `/api/tools/list` — Lists custom and built‑in tools (schemas for custom).
- GET `/api/tools/config/status` — Shows which built‑ins appear
  enabled/available under the current code settings.

## Frontend integration

- Events polling via `useEvents` uses backoff, pauses when hidden, and stops
  after idle; short fast‑poll after send shows token streaming quickly.
- Chat merges token events into final messages by `message_id`; shows Streaming
  badge.
- ToolsPanel lists allowed tools (per active agent), executes custom tools, and
  shows last status.
- Handoff chips are displayed from `handoff` events.

## Production checklist

- Replace memory store with Redis (keys are documented in the store interface);
  keep event resume and idempotency semantics.
- Add authentication and rate limiting; restrict sensitive endpoints.
- Add tracing/metrics for turns and tools; persist session transcripts.
- Replace heuristic routing with a Supervisor Agent using function‑calling.

## Quick API index

- GET /api/agents — list agents and allowlists
- GET /api/tools/list — tool schemas
- GET /api/tools/config/status — built‑ins status
- POST /api/sdk/session/create — create agent session
- POST /api/sdk/session/message — send message
- GET /api/sdk/session/{id}/events?since=seq — resume events
- POST /api/orchestrate — route + persist handoff
- POST /api/sdk/session/set_active_agent — manual switch
