# Migration Plan Checklist

Use this checklist to track incremental work toward adopting **@openai/agents-core**.  Each unchecked box is intended to be a small (~1 story-point) task that can be delivered and reviewed independently.

--------------------------------------------------------------------------------

## Phase 0 – Preparation

- [x] Add `@openai/agents-core` to **tsconfig paths** so TypeScript resolves the vendored module. *(no change needed; vendored module resolves successfully)*
- [x] Create `src/agents-sdk/` folder and commit an empty `README.md` stub.
- [x] PoC import: compile succeeds with `import { Agent }` from the SDK.

## Phase 1 – Re-encode Agent definitions

### 1 A – Shared helpers
- [x] Add `types.ts` in `src/agents-sdk/` that re-exports frequently used SDK types (`RealtimeAgent`, `tool`, etc.).
- [x] Migrate `lookupOrders` tool to SDK `tool()` builder with mock implementation (unit test pending).

# (Phase 1 continued)

### 1 B – SimpleExample scenario
- [x] Convert `haikuWriter` → `RealtimeAgent` class.
- [x] Convert `greeter` → `RealtimeAgent` with `handoffs=[haikuWriter]`.
- [x] Register scenario export in new `agents-sdk/index.ts`.

### 1 C – Customer Service Retail scenario
- [x] Convert `returns` agent, including all three function tools.
- [x] Convert `sales` agent & its tools.
- [x] Convert `authentication` agent and add handoffs to downstream agents.

### 1 D – Customer Service with Supervision
- [x] Re-write supervisor & worker agents using SDK handoffs instead of custom recursive completions logic.

### 1 E – Remove now-unused code
- [x] Delete `injectTransferTools.ts` and update imports.

## Phase 2 – Session orchestration layer

- [x] Create `src/agents-sdk/realtimeClient.ts` wrapper exposing `connect/interrupt/sendText/pushToTalk`.
- [x] Internally instantiate `RealtimeSession` with selected scenario’s first agent.
- [x] Map session & transport events to existing React custom types (adapter layer).
- [x] Replace usage of `createRealtimeConnection.ts` in `App.tsx` with new client wrapper for all scenarios.
- [x] Remove old `createRealtimeConnection.ts`.

## Phase 3 – Guardrails

- [x] Implement `GuardrailOutputZod` equivalent as `RealtimeOutputGuardrail`.
- [x] Register guardrail when constructing `RealtimeSession` (done in RealtimeClient).
- [x] Update transcript adapter to surface guardrail trips.
- [x] Switch guardrail execution to OpenAI Moderations endpoint via SDK guardrail (no more `/api/chat/completions`).

## Phase 4 – Logging & Context providers

- [x] Switch `EventContext` data source to `RealtimeSession.history`.
- [x] Ensure breadcrumb logic still functions with new event objects.

## Phase 5 – Clean-up & Documentation

- [x] Remove `useHandleServerEvent.ts` and related manual plumbing.
- [ ] Update `ARCHITECTURE.md` references to use SDK terminology.
- [ ] Run `pre-commit run --all-files` and ensure lint/build pass.

## Phase 6 – Regression & Verification

- [ ] Manual smoke test in browser (connect, speak, receive audio).
- [ ] Verify push-to-talk flow sends correct events.
- [ ] Trigger each function tool and confirm outputs.
- [ ] Trigger agent handoff via conversation and confirm new agent takes over.
- [ ] Cause guardrail violation and confirm tripwire UI.
- [ ] Unplug network to test graceful disconnect & reconnect.
- [ ] QA transcript & event panes for completeness / no console errors.

--------------------------------------------------------------------------------

*Mark items complete as pull requests merge into `main`.*
