# Migration Plan Checklist

Use this checklist to track incremental work toward adopting **@openai/agents-core**.  Each unchecked box is intended to be a small (~1 story-point) task that can be delivered and reviewed independently.

--------------------------------------------------------------------------------

## Phase 0 – Preparation

- [ ] Add `@openai/agents-core` to **tsconfig paths** so TypeScript resolves the vendored module.
- [ ] Create `src/agents-sdk/` folder and commit an empty `README.md` stub.
- [ ] PoC import: write a quick unit test that `import { Agent } from '@openai/agents-core'` succeeds.

## Phase 1 – Re-encode Agent definitions

### 1 A – Shared helpers
- [ ] Add `types.ts` in `src/agents-sdk/` that re-exports frequently used SDK types (`RealtimeAgent`, `tool`, etc.).
- [ ] Migrate `lookupOrders` tool to SDK `tool()` builder with mock implementation; add Jest test validating output.

### 1 B – SimpleExample scenario
- [ ] Convert `haikuWriter` → `RealtimeAgent` class.
- [ ] Convert `greeter` → `RealtimeAgent` with `handoffs=[haikuWriter]`.
- [ ] Register scenario export in new `agents-sdk/index.ts`.

### 1 C – Customer Service Retail scenario
- [ ] Convert `returns` agent, including all three function tools.
- [ ] Convert `sales` agent & its tools.
- [ ] Convert `authentication` agent and add handoffs to downstream agents.

### 1 D – Customer Service with Supervision
- [ ] Re-write supervisor & worker agents using SDK handoffs instead of custom recursive completions logic (spike if needed).

### 1 E – Remove now-unused code
- [ ] Delete `injectTransferTools.ts` and update imports.

## Phase 2 – Session orchestration layer

- [ ] Create `src/agents-sdk/realtimeClient.ts` wrapper exposing `connect/interrupt/sendText/pushToTalk`.
- [ ] Internally instantiate `RealtimeSession` with selected scenario’s first agent.
- [ ] Map session & transport events to existing React custom types (adapter layer).
- [ ] Replace usage of `createRealtimeConnection.ts` in `App.tsx` with new client wrapper.
- [ ] Remove old `createRealtimeConnection.ts`.

## Phase 3 – Guardrails

- [ ] Implement `GuardrailOutputZod` equivalent as `RealtimeOutputGuardrail`.
- [ ] Register guardrail when constructing `RealtimeSession`.
- [ ] Update transcript adapter to surface guardrail trips.

## Phase 4 – Logging & Context providers

- [ ] Switch `EventContext` data source to `RealtimeSession.history`.
- [ ] Ensure breadcrumb logic still functions with new event objects.

## Phase 5 – Clean-up & Documentation

- [ ] Remove `useHandleServerEvent.ts` and related manual plumbing.
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

## Phase 7 – Roll-out

- [ ] Add `?sdk=true` flag in routing & default disabled.
- [ ] Deploy preview build; gather telemetry for one week.
- [ ] Remove flag and delete legacy code paths.

--------------------------------------------------------------------------------

*Mark items complete as pull requests merge into `main`.*
