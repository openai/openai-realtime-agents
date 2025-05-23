# Migration Plan – Adopting `@openai/agents-core`

This plan has two sections:

1. High-level overview – what changes when we switch from the **hand-rolled agent layer** described in `ARCHITECTURE.md` to the new SDK that lives in `vendor/openai/agents-core`.
2. Detailed step-by-step execution checklist, including test criteria to confirm feature parity.

--------------------------------------------------------------------------------

## 1. Overview of the migration

Current implementation (summary):

* Agents are plain JSON (`AgentConfig`) with ad-hoc helper utilities (`injectTransferTools`, custom `toolLogic` map, custom guardrail function).
* Session and tool orchestration is implemented manually inside React hooks (`useHandleServerEvent`, `createRealtimeConnection`).
* Realtime voice is a tiny wrapper around WebRTC; the client must create `session.update`, handle `response.done`, send `response.create`, etc.

The **`@openai/agents-core` SDK** provides all of that as a cohesive, typed runtime:

* `Agent` / `RealtimeAgent` classes – instructions, tool definitions, guardrails and **handoffs** baked in.
* Built-in abstractions for tool execution (`FunctionTool`), stop conditions and approval flows.
* `RealtimeSession` – single entry point that sets up the WebRTC *or* WebSocket transport, pushes the correct session config, tracks history, invokes guardrails and handoffs automatically.
* Uniform guardrail framework (`RealtimeOutputGuardrail`) instead of the bespoke completions call.
* Strong typing (Zod / JSON-schema) for tool parameters and agent output.

Therefore the migration is mostly **moving logic out of React and into the SDK layer**, and replacing our raw event plumbing with SDK calls.

--------------------------------------------------------------------------------

## 2. Step-by-step implementation plan

### Phase 0 – Preparation

1. Add the package to `package.json` (already vendored; just ensure TypeScript picks it up).
2. Enable incremental adoption by introducing a new folder `src/agents-sdk/` where migrated agents and session wrapper will live.

### Phase 1 – Re-encoding Agent definitions

1. For every existing `AgentConfig` file:
   1. Create a sibling file that exports a `RealtimeAgent` instance.
   2. Convert `instructions` verbatim.
   3. Convert `tools`:
      * Replace raw JSON with the builder:  
        ```ts
        import { tool } from '@openai/agents-core/realtime';

        const lookupOrders = tool<{phoneNumber:string},{orders:Order[]}>(/* … */);
        ```
      * Move JS implementations into the `invoke` function of the tool.
   4. Convert `downstreamAgents` / `transferAgents` to **handoffs**:  
      ```ts
      authAgent.handoffs = [ returnsAgent ];
      ```
2. Remove `injectTransferTools` – not needed, SDK handoffs cover the use-case.

Acceptance test: a unit test constructs a `RunContext` and verifies that calling the tool `lookupOrders` returns the same mock data as before.

### Phase 2 – Session orchestration layer

1. Create a thin wrapper `src/agents-sdk/realtimeClient.ts` that:
   * Instantiates a `RealtimeSession` with the *initial* agent for the selected scenario.
   * Exposes imperative methods `connect()`, `sendUserText()`, `pushToTalkStart()`, `pushToTalkStop()`, `interrupt()`.
   * Mirrors events (`item_created`, `connection_change`, `output_audio_transcript_delta`, etc.) so existing React components can keep their state logic unchanged.
2. Replace the custom WebRTC code in `createRealtimeConnection.ts` **and** the logic in `App.tsx`/`useHandleServerEvent` with calls to this wrapper.
   * The existing event -> UI mapping can stay; only the transport & event source change.

Acceptance test: perform an end-to-end conversation in the browser and confirm:
* Connection transitions through **CONNECTING – CONNECTED**.
* Assistant responds with TTS audio.
* Transcript shows deltas and final message.

### Phase 3 – Guardrail replacement

1. Re-implement the existing word-count logic using `RealtimeOutputGuardrail`:
   * Define a Zod schema identical to `GuardrailOutputZod`.
   * Implement `invoke` to call the same internal `/api/chat/completions` endpoint.
2. Register the guardrail when constructing the `RealtimeSession`.

Verification: deliberately generate an OFFENSIVE output and ensure guardrail is triggered and UI breadcrumbs display rationale/category.

### Phase 4 – Event & Usage logging

1. Hook `RealtimeSession.history` for event logging instead of manual `logServerEvent`.
2. Map each `RealtimeItem` to the existing `EventContext` format so UI stays intact.

### Phase 5 – Clean-up & deprecation

1. Delete `src/app/lib/realtimeConnection.ts`, `useHandleServerEvent.ts` and `injectTransferTools.ts` once everything compiles.
2. Update documentation – replace `ARCHITECTURE.md` sections that mention manual plumbing with SDK usage notes.

### Phase 6 – Regression test matrix

| Feature | Test methodology |
|---------|------------------|
| Audio round-trip | Browser mic loopback – assistant must respond in <3s |
| Push-to-talk & VAD | Toggle setting and ensure correct server events (`input_audio_buffer.*`) |
| Tool execution | Trigger `lookupOrders` path; check JSON echo and assistant follow-up |
| Agent handoff | Ask to “transfer me to returns” and verify `handoff` occurs |
| Guardrails | Force violation and check UI shows category |
| Connection recovery | Manually drop network; app should reconnect or surface error |
| Logs / transcript | Ensure items, breadcrumbs, and deltas still render |

--------------------------------------------------------------------------------

## 3. Roll-out

1. Ship behind a query-param flag `?sdk=true` for one week.
2. Collect telemetry (error logs, latency) and compare to baseline.
3. Remove old code paths and flip to SDK by default.

--------------------------------------------------------------------------------

*Last updated: 2025-05-23*
