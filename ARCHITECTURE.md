# Project Architecture – OpenAI Realtime Agents Demo

This document gives an *engineering-level* overview of how the project is wired together.  It focuses on the
1. use of OpenAI APIs (Realtime & Chat Completions),
2. how the front-end establishes and maintains the realtime connection, and
3. how the repo models “agents” – prompt, tools and local tool logic.

> Directory layout shown below omits the auto-generated `.next`, `node_modules` and `vendor` trees.

```
src/
  app/
    api/                 ← API routes that proxy OpenAI HTTP calls
    agentConfigs/        ← Prompt / tool definitions for every “agent scenario”
    components/          ← React UI widgets
    contexts/            ← React Context for logs & transcript state
    hooks/               ← React hooks – incl. server-event handler
    lib/
      realtimeConnection.ts  ← All WebRTC / SDP logic
      callOai.ts             ← Helper that calls Chat Completions API
    App.tsx               ← Main client entry point
    layout.tsx / page.tsx ← Next.js plumbing
```

--------------------------------------------------------------------------------

## 1.  OpenAI API usage

### 1.1  Realtime API (Voice & Data channel)

The realtime part happens entirely in the browser:

1.  The client first asks its own backend for a **session token** (`client_secret`) via
    ```text
    GET /api/session            → POST https://api.openai.com/v1/realtime/sessions
    ```
    The server route signs the request using the regular `OPENAI_API_KEY` and hands the
    short-lived `client_secret` back to the browser.

2.  In `src/app/lib/realtimeConnection.ts` the browser:
    • creates an `RTCPeerConnection`  
    • attaches the user’s microphone track  
    • negotiates a `RTCDataChannel` named **`oai-events`** for JSON events  
    • chooses an audio codec based on the `?codec=opus|pcm...` URL parameter  
    • sends its SDP offer to
      ```text
      POST https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17
      Authorization: Bearer <client_secret>
      Content-Type: application/sdp
      ```
    • applies the SDP answer returned by the OpenAI endpoint.

   Once the remote description is set, the media stream carries **assistant TTS audio**
   back to the page, and the `oai-events` data channel can be used bi-directionally
   for structured events (`session.update`, `conversation.item.create`, etc.).

3.  All higher-level messaging is therefore pure JSON over that data channel.

### 1.2  Chat Completions API

HTTP calls to `chat.completions` are made from the backend **and** the browser but
*always* go via the same Next.js API proxy, `src/app/api/chat/completions/route.ts`.
The route is a straight pass-through to `openai.chat.completions.create()` and prevents
exposing an API key to the browser.

Current uses in the code base:

* `src/app/lib/callOai.ts` – lightweight *guard-rail* classifier that scores the
  assistant’s streaming output every ~5 words.
* `agentConfigs/customerServiceWithSupervision/supervisorAgent.ts` and
  `agentConfigs/customerServiceRetail/returns.ts` – supervisor / function-chaining
  examples that simulate calling tools by recursively hitting the completions API.

--------------------------------------------------------------------------------

## 2.  Front-end connection lifecycle *(App.tsx)*

`src/app/App.tsx` is the main **client component** (rendered with the Next.js `"use client"` directive):

1. **Scenario bootstrap**   
   – Reads `?agentConfig=<scenario>` from the URL.  A scenario is an array of
   `AgentConfig` objects (see next section) located in `src/app/agentConfigs/*`.  
   – If absent, falls back to the `simpleExample` scenario.

2. **Connection**   
   – State machine: `DISCONNECTED → CONNECTING → CONNECTED`  
   – `connectToRealtime()`
        • fetches the session token (`/api/session`)
        • calls `createRealtimeConnection()` to set up WebRTC
        • installs listeners on the data channel (`message`, `open`, `close`, `error`)

3. **Session initialisation**   
   When the WebRTC connection is live, `updateSession()` is sent via the data channel:

   ```json
   {
     "type": "session.update",
     "session": {
       "modalities": ["text", "audio"],
       "voice": "sage",
       "instructions": "…agent specific prompt…",
       "input_audio_transcription": {"model": "whisper-1"},
       "turn_detection": { … } | null,
       "tools": [ …JSON schema for each tool… ]
     }
   }
   ```

   The `instructions` and `tools` fields come directly from the selected agent (below).

4. **Runtime events**   
   `src/app/hooks/useHandleServerEvent.ts` receives server events, updates UI state
   (Transcript & Event logs) **and** reacts programmatically, e.g.:
   • streams assistant text deltas (`response.audio_transcript.delta`)  
   • executes local `toolLogic` when the model emits `function_call` output  
   • injects `function_call_output` back into the conversation and triggers a new
     `response.create`.

5. **Push-to-Talk vs. VAD**   
   The UI lets the user either (a) PTT and commit an `input_audio_buffer` or (b)
   rely on server-side VAD.  `turn_detection` parameters are chosen accordingly.

6. **Disconnect**   
   Cleans up the peer connection and resets state.

--------------------------------------------------------------------------------

## 3.  Agent modelling

```ts
interface AgentConfig {
  name: string;                     // unique key within a scenario
  publicDescription: string;        // shown to other agents via transfer tool
  instructions: string;             // full system prompt injected into session
  tools: Tool[];                    // JSON schema per OpenAI function-calling spec
  toolLogic?: Record<string, (args,…)=>any>; // optional local implementation
  downstreamAgents?: AgentConfig[]; // graph used by dynamic transfer tool
}
```

Key files:

* `src/app/agentConfigs/<scenario>/**.ts` – concrete agents (authentication,
  returns, sales, haikuWriter, …).
* `src/app/agentConfigs/utils.ts` – `injectTransferTools()` automatically appends a
  *transferAgents* function to an agent when it lists `downstreamAgents`.  The
  function’s `enum` is derived from the downstream agent names, which gives the
  model a controlled set of valid transfer targets.

### Tool execution flow

1. Model emits a `function_call` item in a `response.done` event.
2. `useHandleServerEvent` detects it and looks for a matching implementation in
   the current agent’s `toolLogic` map.
3. If found, the JS function runs locally and its return value is packaged into a
   `conversation.item.create` with `type:"function_call_output"` followed by a
   `response.create` (prompting the model to continue with the new information).
4. If *not* found, a generic stub `{result:true}` is returned so the dialogue keeps
   moving.

### Agent transfer

`transferAgents` is treated specially – the handler updates React state
`selectedAgentName`, swapping in the new agent’s `instructions`+`tools`, then
reports `{destination_agent, did_transfer}` back to the model.

--------------------------------------------------------------------------------

## 4.  Guard-rails (lightweight moderation)

`runGuardrailClassifier(message)` is called every ~5 new words of assistant output.
It uses the Completions API with a **Zod response_format** to get structured JSON:

```
{
  moderationRationale: string,
  moderationCategory: "OFFENSIVE" | "OFF_BRAND" | "VIOLENCE" | "NONE"
}
```

The result is attached to the relevant `TranscriptItem` so the UI can surface
potentially problematic content in real time.

--------------------------------------------------------------------------------

## 5.  High-level request/response timeline

```text
Browser                           Next.js API          OpenAI API
───────────────────────────────────────────────────────────────────────────────
page load
│
│  GET /api/session ───────────▶ │  POST /v1/realtime/sessions
│                                │  (Bearer: secret API key)
│  <-- client_secret value ──────┘
│
│  WebRTC offer + DataChannel
│  POST /v1/realtime?model=… (Bearer client_secret)
│  <-- SDP answer, WebRTC flows established
│
│  ──► JSON: session.update (instructions + tools)
│  ◄── JSON: session.created, …event stream…
│
│  (optionally) fetch('/api/chat/completions') ─────────────▶ openai chat…
│
└─ user disconnect ──► pc.close()
```

--------------------------------------------------------------------------------

## 6.  Extending the system

* Add a new scenario by dropping a folder under `src/app/agentConfigs/` that
  exports an array of `AgentConfig` objects and referencing it from
  `agentConfigs/index.ts`.
* Implement real tool back-ends by replacing / extending the `toolLogic` stubs
  (they can fetch data, call proprietary APIs, etc.).
* Tighten moderation by adjusting `runGuardrailClassifier` or switching to the
  official OpenAI Moderation endpoint once it supports real-time use.

--------------------------------------------------------------------------------

*Last updated: 2025-05-23*
