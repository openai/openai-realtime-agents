# Chat routing consolidation plan

This plan restores a reliable chat experience with two mutually exclusive modes
and full observability, matching the original event-sourced design.

## Goals

- Default chat uses Agents SDK (OA Agents) and returns assistant content on the
  first turn.
- Optional Responses-only mode (user enables it in UI) — multi-turn, bypasses
  SDK.
- Full Raw Logs (log, message, token, tool events) and usage aggregation.
- Tools panel shows per-agent allowlist.
- LiteLLM stays supported in code but UI toggle is inactive for now.

## NEW APPROACH (must drive actual implementation)

Two dedicated runtimes — no in-session toggle.

### Runtime A: Agents (SDK)

- Endpoints: `/api/sdk/session/...` (existing; retained).
- Session store: `sdk_session_id`; event-sourced (message/log/tool/token).
- Tools: allowlist from scenario; executed natively via Agents SDK.
- Defaults: SDK ON; Responses wrapper OFF; built-ins OFF unless explicitly
  enabled.

### Runtime B: LLM (Responses / LiteLLM)

- Endpoints: `/api/llm/session/...` (parallel, simple).
- Session store: `llm_session_id`; same event schema for parity.
- Tools: server-side execution via `POST /api/tools/execute` (optional future
  tool-calling for Responses).
- Defaults: Responses path only (LiteLLM optional; not wired yet).

### Frontend separation

- Two tabs/panels: “Agents” and “LLM” — each owns its session id and UI state.
- Providers panel is per-tab:
  - SDK tab: SDK toggles only (default ON; Responses OFF).
  - LLM tab: Responses/LiteLLM toggles (no SDK controls).
- No cross-toggle within the same session.

### Sessions & Observability

- Create lazily on first message; reuse id per tab.
- Shared Raw Logs viewer can switch by session id; Usage panel shows per-session
  totals.

### Extensibility

- Add LiteLLM only in LLM tab/path; SDK tab remains unaffected.
- Tool registry is shared; SDK wraps tools natively; LLM path calls server tools
  explicitly.

## Modes

- sdk (default):
  - Lazy-load Agents SDK; build Agent with allowlisted tools; run Runner.run.
  - If SDK fails or returns no text, fall back to Responses within the same
    request; record `used_fallback: true` and log events.
- responses:
  - Bypass Agents SDK; call server Responses proxy; create user+assistant events
    synchronously.

## Providers flags API

- GET /api/models/providers/status → { openai_responses: true, litellm: true,
  agents_sdk: !DISABLE, default_responses: true }
- GET /api/models/providers/flags → { use_openai_responses: boolean,
  use_litellm: boolean, use_agents_sdk: boolean }
- POST /api/models/providers/flags (mutual exclusivity):
  - If `use_openai_responses=true`, force `use_agents_sdk=false`.
  - If `use_agents_sdk=true`, allow Responses wrappers but route via SDK.

## Message lifecycle

1. Router appends user `message` event and a `turn_start` log.
2. Calls `sdk_manager.run_agent_turn(...)`.
3. Appends assistant final `message` with text (always present in success path):
   - SDK path: use result.final_output or Responses fallback when empty.
   - Responses path: use proxy output.
4. Appends `turn_end` log. Returns
   `{ events: [user, assistant], final_output, used_fallback? }`.

## Usage aggregation

- SDK path: extract from `context_wrapper.usage` or `result.usage`.
- Responses path: extract from proxy response `usage`.
- Accumulate via `store.add_usage(session_id, usage)`.
- GET /api/sdk/session/usage returns totals.

## Tools visibility

- GET /api/agents/{agent}/tools → allowlist from registry (built-ins + custom).
- FE Tools panel displays allowlist; custom tools executed via POST
  /api/tools/execute.

## Logging

- Router: log start/result to terminal; emit `turn_start` / `turn_end` events.
- SDK manager: log `agents_sdk_error`, `fallback_responses_error`, and (trimmed)
  `responses_raw_preview`.
- Raw Logs shows log + message + tool events.

## Task checklist (live)

Legend: [ ] pending · [x] done · [~] in progress

1. Backend — Routing modes and flags

- [x] Define a single chat_mode switch: `sdk` (default) | `responses`.
- [~] Providers flags API returns/accepts the mode:
  - [x] GET /api/models/providers/flags → returns mutually exclusive flags;
        default SDK ON (use_agents_sdk=true), Responses OFF.
  - [x] POST /api/models/providers/flags enforces mutual exclusivity: enabling
        Responses sets SDK off.
- [~] Providers status endpoint shows ready/unavailable without forcing heavy
  imports.

2. Backend — Router lifecycles and observability

- [x] `/sdk/session/message` flow:
  - [x] Append user message event and `turn_start` log.
  - [x] Call `sdk_manager.run_agent_turn` with scenario + agent spec.
  - [x] Post-fallback to Responses only when Responses flag is enabled.
  - [x] Log `assistant_no_text` when SDK path returns empty and fallback
        disabled.
  - [x] Append assistant final message and `turn_end` log; return
        `{ events: [user, assistant], final_output, used_fallback? }`.
- [x] `/sdk/session/{id}/events` returns ordered events with `since`.
- [x] Error handling: always emit readable log events on failures.

3. Backend — SDK manager: SDK-first with reliable fallback

- [x] Lazy-load Agents SDK; resolve built-in and custom tools.
- [~] SDK run path emits tool_call/tool_result events (best-effort).
- [x] If SDK errors or produces no text, fall back to Responses immediately
      within the same turn.
- [x] Only bypass fallback when mode=responses (handled in router) or explicitly
      disabled by FE.
- [~] Extract usage from SDK (`context_wrapper.usage` or compatible shapes) and
  aggregate.

4. Backend — LLM (Responses-only) runtime

- [x] Bypass SDK entirely; call server Responses proxy.
- [x] Extract robust text from varying Responses payloads.
- [x] Aggregate usage from Responses payloads.

5. Backend — Tools visibility

- [~] GET `/api/agents/{agent}/tools` returns allowlist from registry.
- [ ] FE Tools panel uses this list; custom tool execute works via
      `/api/tools/execute`.

6. Backend — Usage aggregation

- [~] Store accumulates `{requests,input_tokens,output_tokens,total_tokens}` per
  session.
- [~] GET `/api/sdk/session/usage` returns totals; FE panel displays live
  values.
- [x] Added parallel `/api/llm/session/usage` for LLM runtime.

7. Backend — Logging (terminal + Raw Logs)

- [~] Router logs start/result summary to terminal.
- [x] Emit Raw Log events: `turn_start`, `turn_end`, `agents_sdk_error`,
      `fallback_responses_error`, and a truncated `responses_raw_preview` when
      useful.

8. Frontend — UI wiring (two-tab split)

- [ ] Add two tabs: Agents (SDK) and LLM (Responses). Each owns its own session
      id and endpoints.
- [ ] Providers panel becomes per-tab; SDK tab defaults to SDK ON, Responses
      OFF; LLM tab controls Responses/LiteLLM.
- [x] Raw Logs button shows events count; panel prioritizes events over
      transcript.
- [ ] Events polling remains adaptive; bursts after send for visibility.

9. Validation matrix

- [ ] SDK mode: assistant replies with text; Raw Logs show start→end; usage
      increments.
- [ ] LLM mode: assistant replies with text; usage increments; no SDK/tool
      events.
- [ ] Switching FE tabs isolates sessions and avoids cross-mode toggles.
- [ ] Tools allowlist endpoint responds and FE shows it.

10. Docs

- [x] Create this plan with a comprehensive checklist.
- [ ] Update `docs/workings.md` to reflect modes, flags, fallback, and the
      two-tab FE split.

11. Backlog (not started)

- [ ] LiteLLM support in LLM runtime (provider/model selection + usage
      aggregation).
- [ ] FE Tools for LLM (optional) — minimal tool-calling or server-side tool
      execution wiring.
- [ ] Smoke tests: small scripts to send a message to both runtimes and assert
      non-empty assistant text and usage increments.

## Notes

- OA docs: https://openai.github.io/openai-agents-python/models/
- LiteLLM: https://openai.github.io/openai-agents-python/models/litellm/
- Existing FE uses: `/api/sdk/session/create`, `/api/sdk/session/message`,
  `/api/sdk/session/{id}/events`, `/api/models/providers/status`,
  `/api/models/providers/flags`, `/api/agents/{agent}/tools`,
  `/api/sdk/session/usage`, `/api/orchestrate`, `/api/session`.
