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
- [ ] UI badge for active root agent
- [ ] Display pending / performed handoff events
- [ ] Integrate orchestrator call (/api/orchestrate) after each turn
- [ ] Show handoff reason (structured metadata)

### 4. Agent Selection & Tool Scoping

- [ ] Per-agent tool registry endpoint / schema
- [ ] Limit tool invocation to allowed set for current root
- [ ] Visible tool list UI + last invocation status
- [ ] Guard unauthorized tool usage (frontend + backend)

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
- [ ] Incremental token rendering (typing indicator)
- [ ] Merge partials into final message entry
- [ ] Stream realtime partial transcriptions into chat (inline updating message)

### 9. Error & Retry Handling

- [ ] Distinguish user / tool / network errors in UI
- [ ] Retry button for failed tool calls
- [ ] Exponential backoff (transient 5xx)
- [ ] Central error boundary / toast notifications

### 10. Metrics & Diagnostics

- [ ] Capture per-turn latency (client timestamps)
- [ ] Display tool call count per turn
- [ ] Token usage (if API exposes) placeholder
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
