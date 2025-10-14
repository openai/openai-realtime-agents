# what we target next (in order of priority):

[ ] Assistant message rendering: tighten fallback paths and formatting 
[ ] Handoff/agent indicators: show when the orchestrator suggests a root change
[ ] Tool call visibility: clearer grouping, collapsible details 
[ ] Improve multi-agent orchestration based on official docs (https://openai.github.io/openai-agents-python/multi_agent/) => orchstration via LLM approach
[ ] Optimistic rendering of user messages
[ ] IMplement Context Management based on official documentation (https://openai.github.io/openai-agents-python/context/)
[ ] Implement basic Guardrails, making it reusable/extensable in future - based on official docs (https://openai.github.io/openai-agents-python/guardrails/)
[ ] Event stream UX: smoother auto-scroll, timestamps, compact system/tool events 
[ ] Transcript refresh: explicit sync button and smarter auto-refresh 
[ ] Retry/send state: disable send during in-flight, show retry on error

## Implementation Task Checklist: Assistant message rendering: tighten fallback paths and formatting

- no plan developed :(

## Implementation Task Checklist: Handoff/agent indicators

- [ ] Define UI goals: inline system message and header badge when orchestrator
      suggests a root change
- [ ] Extend ChatPanel props to accept `handoffEvents`
- [ ] Render a compact header badge showing the latest suggested target (e.g.,
      "Handoff: Sales")
- [ ] Append inline system messages in the chat body for each suggestion:
      `from → to — reason`
- [ ] Wire handoff events state from sdkTest to ChatPanel
- [ ] Optional: sort merge with chronological chat messages (by `at`) instead of
      append-only
- [ ] Optional: action buttons to apply handoff (switch agent) or dismiss
