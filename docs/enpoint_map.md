

# where SDK chat is handled (Agents SDK runtime)
File: router.py

Endpoint: POST /api/sdk/session/message

Function: sdk_session_message

Flow:
Validates input; checks idempotency via store.get_by_client_message_id.
Ensures a session (store.create_session if missing).
Appends a user event immediately (type="message", role="user").
Appends a turn_start log (type="log", text="turn_start").
Chooses execution path:
SDK path when flags allow: await sdk_manager.run_agent_turn(...)
Responses-only path (fallback mode) using agent_runner.run_single_turn(...) if SDK disabled.
Timeout guard (25s). On timeout or error: logs turn_timeout/turn_error; proceeds with empty assistant text.
Optional post-fallback to Responses if USE_OA_RESPONSES_MODEL is true and no text was returned; otherwise logs assistant_no_text for Raw Logs visibility.
Appends the assistant final message synchronously (type="message", role="assistant", final=True) so the FE can render immediately.
Saves idempotency: store.remember_client_message if client_message_id provided.
Appends turn_end log and returns payload including both the user and assistant events.

Related endpoints for SDK:

POST /api/sdk/session/create → sdk_session_create
Creates session in store and tries sdk_manager.create_agent_session with an 8s timeout. On timeout, returns a minimal payload and logs create_timeout.
GET /api/sdk/session/{id}/events → list_session_events
GET /api/sdk/session/usage → get_session_usage
GET /api/sdk/session/transcript → sdk_session_transcript (delegates to sdk_manager.get_session_transcript)
GET /api/sdk/session/{id}/stream (SSE; optional)
POST /api/sdk/session/audio (placeholder)

Helpers used:

sdk_manager.py → run_agent_turn
Wraps the Agents SDK call, normalizes assistant text and usage, respects feature flags (USE_AGENTS_SDK, USE_OA_RESPONSES_MODEL, USE_LITELLM), and resolves tools.
agent_runner.py → run_single_turn
Uses OpenAI Responses API; normalizes output_text and usage.

Event/usage infra:

event.py → Event model
memory_store.py → store
list_events(session_id, since_seq), add_usage(session_id, usage), remember/get_by_client_message_id for idempotency, next_seq, append_event.


# where LLM chat is handled (Responses-only runtime)
File: router.py

Endpoint: POST /api/llm/session/message

Function: llm_session_message

Flow:

Validates input; idempotency check via store.get_by_client_message_id.
Ensures session; appends a user event and a turn_start log.
Builds a minimal messages array: [system? , user].
Calls agent_runner.run_single_turn(model, messages, None) with a 20s timeout; on success, aggregates usage via store.add_usage; on timeout/error, logs turn_timeout/responses_error and continues with empty text.
Starts a background token stream simulation: _simulate_token_stream(session_id, agent_id="llm", message_id, final_text). This emits token events followed by a final assistant message event.
Saves an idempotency placeholder for the upcoming assistant message when client_message_id is present.
Appends turn_end log and returns a payload with final_output and the user event (the token and final assistant events arrive via polling/WS as they’re produced).

Related endpoints for LLM:

POST /api/llm/session/create → llm_session_create (store.create_session, returns session_id/model)
GET /api/llm/session/{id}/events → llm_list_session_events
GET /api/llm/session/usage → get_llm_session_usage
WebSocket /api/llm/session/ws → llm_session_ws (pushes new events; supports client “resume” with last seq)
GET /api/llm/session/{id}/stream (SSE; optional)

Helper:

_simulate_token_stream(...) in router.py emits token chunks and then a final assistant “message” event.