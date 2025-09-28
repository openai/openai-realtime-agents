## Parity Roadmap Checklist

Track remaining work to replicate / enhance original realtime multi‑agent
experience.

### 1. Audio Capture & User Transcription

- [x] Enable Microphone button (permission request + start/stop flow)
- [x] Push-to-talk refinement (basic PTT button & state)
- [x] Capture audio frames (PCM pipeline w/ downsampling & batching)
- [x] Client → Realtime send path (direct append of PCM16 frames)
- [x] Visual VAD indicator (active / silent) – naive RMS threshold
- [ ] Noise suppression + echo cancellation constraints toggle (advanced UI
      controls)
- [x] Suppress unintended auto mic capture from realtime transport (manual
      gating only)

Progress notes: Mic hook now emits 16 kHz Float32 frames via ScriptProcessor,
batched every 500ms, converted to PCM16 and base64 (currently just logged).
Backend placeholder endpoint `/api/sdk/session/audio` accepts base64 PCM and
returns metadata. Next: choose transport (direct WebRTC/Realtime vs REST stream)
and wire transcript/ASR integration.

Realtime progress: Added WebRTC realtime panel (connect/disconnect, logs, remote
audio element) and integrated mic frame forwarding when connected. Auto WebRTC
mic capture is now suppressed (manual PTT only). User + assistant realtime
messages merged into chat with source badges. Pending: multi-agent expansion &
streaming partial transcription display.

### 2. Assistant Audio Playback

- [x] Stream remote audio element wiring (SDK test page parity)
- [x] Mute / unmute control (track enable/disable button / switch)
- [x] Optional waveform / activity bar component (basic RMS bar)

### 3. Multi-Agent Setup & Handoffs

- [x] Represent multiple agents (initialAgents array + root tracking)
- [x] UI badge for active root agent
- [x] Display performed handoff events (placeholder, FE timeline)
- [x] Integrate orchestrator call (/api/orchestrate) after each turn (stub
      logic)
- [x] Show handoff reason (structured metadata) – persisted handoff events
- [x] Supervisor-driven orchestration via function-calling; heuristic used as
      fallback when supervisor is unavailable
- [x] Orchestrate persists handoff events and updates active session agent
- [x] Manual active-agent switch endpoint: POST
      /api/sdk/session/set_active_agent

### 4. Agent Selection & Tool Scoping

- [x] Per-agent tool registry endpoint / schema - GET /api/tools/list (with
      params schema) - GET /api/agents (list agents + their allowlists) - GET
      /api/agents/{agent}/tools (agent allowlist)
- [x] Limit tool invocation to allowed set for current root (backend guard)
- [x] Visible tool list UI + last invocation status (ToolsPanel)
- [x] Guard unauthorized tool usage (frontend + backend)

### 5. Guardrails / Moderation

- [ ] Pre-send moderation request (/api/moderate)
- [ ] Apply sanitized text when returned
- [ ] UI badge (Flagged / Clean)

### 6. Context Snapshot Injection

- [ ] Button: Attach Context (calls /api/context/snapshot)
- [ ] Insert snapshot as system/context message for next turn
- [ ] Visual chip listing attached context blocks

### 7. Session Persistence

- [ ] Switch SQLiteSession to file or Redis persistence
- [ ] Store session metadata list for discovery
- [ ] “Restore Prior Session” dropdown (localStorage + server list)

### 8. Streaming Responses & Transcriptions

- [ ] Explore Agents SDK streaming API / events
- [x] Incremental token rendering (typing indicator via token events)
- [x] Merge partials into final message entry (FE merge by message_id)
- [ ] Stream realtime partial transcriptions into chat (inline updating message)

### 9. Error & Retry Handling

- [ ] Distinguish user / tool / network errors in UI
- [ ] Retry button for failed tool calls
- [x] Exponential backoff (transient 5xx) for events polling + idle-stop
- [ ] Central error boundary / toast notifications

### 10. Metrics & Diagnostics

- [ ] Capture per-turn latency (client timestamps)
- [ ] Display tool call count per turn
- [x] Token usage (per-session aggregate via API + FE UsagePanel)
- [ ] Timeline / waterfall visualization

### 11. Audio Configuration Panel

- [ ] Codec selector (opus vs narrowband) in SDK page
- [ ] Auto vs manual VAD toggle
- [ ] Gain / noise suppression / echo cancel toggles

### 12. Accessibility & UX Polish

- [ ] Keyboard shortcuts help modal
- [ ] Focus management after send (return focus to input)
- [ ] Dark / light theme toggle
- [ ] High contrast mode support

### 13. Security & Rate Limiting

- [ ] Basic session auth token middleware
- [ ] Rate limit /api/responses & tool endpoints
- [ ] Audit logging for moderation denials

### 14. Deployment Hardening

- [ ] Env var validation on startup with clear error
- [ ] Readiness probe (model key + minimal test)
- [ ] Structured logging (JSON option)
- [ ] Production logging filters (PII scrubbing placeholder)

### 15. Documentation & Developer Experience

- [ ] Update migration docs with new audio + streaming architecture
- [ ] README quickstart for SDK test page
- [ ] Troubleshooting section (auth, audio, tools)

### 16. Nice-to-Have Enhancements

- [ ] Session diff view (compare two transcripts)
- [ ] Export transcript (JSON / Markdown)
- [ ] Tool latency histogram mini chart

### 17. Advanced Moderation (Deferred)

Robust moderation architecture to implement after parity (not yet started):

- [ ] Category taxonomy (toxicity, PII, self-harm, harassment) with per-action
      policy (allow / warn / block / redact)
- [ ] Streaming moderation of partial transcripts (audio & text) for early
      interception
- [ ] Redaction layer (emails, phone numbers, IDs) with token replacement and
      audit log
- [ ] Server-side enforcement / double-check (no trust in FE-only decisions)
- [ ] External model / API scoring integration with threshold mapping
- [ ] User-facing override flow (edit blocked text + resubmit)
- [ ] Telemetry of category counts (without storing raw disallowed content)
- [ ] Config delivery endpoint: dynamic JSON policy pushed to clients

### 18. Refactor & Decomposition (Tech Debt)

- [ ] Break `sdkTest.tsx` into smaller components (Panels: SessionConfig,
      RealtimePanel, ChatPanel, OutputPanel)
- [ ] Extract hooks (useAgentSelection, useAudioPTT, useTranscriptMerge)
- [ ] Move inline types to dedicated `types.ts`
- [ ] Remove remaining hardcoded agent list (load from backend schema)
- [ ] Introduce feature flags config object

---

Progress: Mark items [x] as implemented; keep ordering flexible for parallel
work.

## M1 vs. M2 - Execution Plan

### Phase wrap guidance (when to pause this sandbox and merge) and how to avoid rework

#### M1 – Stable Core (merge readiness)

Foundational capabilities to complete in sandbox before integrating into main
project (items are not removed; they are completed [x] or deferred):

- [x] Stable session core - [x] Session create/delete - [x] Message send
      (user/assistant) with `client_message_id` + server `seq` - [x] Persisted
      `activeAgentId`
- [x] Orchestrator persistence - [x] Orchestrate endpoint reads/writes session
      state (agent, reason) - [x] Handoff event model defined (with `seq`)
- [x] Tool registry skeleton - [x] Registry interface (list, get, execute) - [x]
      Sample + demo tools (`echo_context`, `weather`, `product_search`) - [x]
      Per‑agent `allowed_tools` enforced server-side
- [x] Event contract finalized - [x] Unified Event shape (`message`, `handoff`,
      `tool_call`, `tool_result`, `token`, `final`) - [x] Resume endpoint
      `/api/sdk/session/{id}/events?since=seq` (memory-backed OK)
- [x] Frontend merge logic updated - [x] Uses `seq` ordering - [x] Idempotent
      via `client_message_id` - [x] Shows handoff transitions using events list
- [x] Storage abstraction - [x] `InMemoryStore` implementing interface - [x]
      Placeholder `RedisStore` file with TODO stubs
- [x] Minimal streaming placeholder aligned with contract - [x] Simulated token
      events + progressive render
- [ ] Error & reconnect strategy - [ ] FE keeps `lastAppliedSeq` - [ ] On
      mount/resume: calls `/events?since`
- [ ] Clear module boundaries in code - [ ] Orchestrator service (pure
      functions) - [ ] Tool registry module (interface-based) - [x] Session
      store interface - [ ] HTTP layer thin (adapters only)

#### M2 – Post-merge Enhancements (in main project)

- [ ] Real Redis integration
- [ ] Real token streaming (WebRTC data channel / websocket)
- [ ] Metrics / tracing
- [ ] Moderation enrichment
- [ ] Advanced tool execution (sandbox, concurrency control)
- [ ] Caching / vector retrieval
- [ ] Production auth & rate limiting
- [ ] Supervisor agent orchestration via tool/function-calling
- [ ] Built-in Agents SDK tools wired (FileSearch, WebSearch, Computer, MCP,
      LocalShell, ImageGeneration, CodeInterpreter) with secured config flags

#### Why stop at M1

- Cross-cutting contracts (events, seq, ids, registry) are locked → minimal
  refactor later.
- Heavy lift (Redis, streaming infra) done once in real deployment context.
- Avoids divergence between sandbox and main repo architecture decisions.

#### High-level sequencing (now to M1)

1. [x] Define shared models (TypeScript & Python) for events, session, tool spec
2. [x] Add `seq` + `client_message_id` plumbing (server assigns seq; FE merges)
3. [x] Introduce session store interface; refactor current in-memory logic
4. [x] Add orchestrator persistence (read/write through store)
5. [x] Implement tool registry interface; keep sample tool + allowlist
6. [x] Add events list + resume endpoint
7. [x] FE: refactor transcript builder to consume events pipeline
8. [x] Add simulated token events generator (timer based)
9. [ ] Tighten error/reconnect path
10. [ ] Freeze contracts; tag release; integrate into main project

#### Module boundary blueprint (reference)

Backend:

```
core/
      models/ (event.py, session.py, tool.py)
      store/ (interface.py, memory_store.py, redis_store.py)
      orchestrator/ (logic.py)
      tools/ (registry.py, builtins/*.py)
      events/ (publisher.py, resume.py)
api/
      routes/ (session.py, orchestrate.py, tools.py, events.py)
streaming/ (defer real implementation)
```

Frontend:

```
lib/agents/
      apiClient.ts
      eventStream.ts (abstract source)
      store.ts (seq-ordered FE state)
      toolTypes.ts
      orchestratorTypes.ts
components/agents/
      ChatView.tsx
      HandoffBadge.tsx
      ToolResult.tsx
```
