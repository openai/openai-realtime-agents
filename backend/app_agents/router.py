from __future__ import annotations

import asyncio
import base64
import os
import time
from uuid import uuid4

import httpx
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from . import sdk_manager
from .agent_runner import AgentRunnerError, run_single_turn
from .core.models.event import Event
from .core.store.memory_store import store
from .registry import get_scenario, list_scenarios
from .schemas import (ContextSnapshot, ContextSnapshotRequest,
                      ModerationDecision, ModerationRequest,
                      OrchestrationDecision, OrchestrationRequest,
                      SessionInitPayload, ToolExecutionRequest,
                      ToolExecutionResult)
from .tools import execute_tool

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

router = APIRouter(prefix="/api")


class ScenarioListItem(BaseModel):
    id: str
    label: str
    description: str | None = None


@router.get("/scenarios", response_model=list[ScenarioListItem])
async def scenarios_endpoint():
    return [
        ScenarioListItem(id=s.id, label=s.label, description=s.description)
        for s in list_scenarios()
    ]


@router.get("/scenarios/{scenario_id}")
async def scenario_detail(scenario_id: str):
    sc = get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return sc.model_dump()


# ---- Tool Registry Endpoints (listing) ----
class ToolListItem(BaseModel):
    name: str
    description: str | None = None


@router.get("/tools/list", response_model=list[ToolListItem])
async def tools_list():
    from .tools import tool_registry

    items = []
    for k, v in tool_registry.items():
        desc = getattr(v, "__doc__", None)
        items.append(
            ToolListItem(
                name=k, description=(desc.strip() if isinstance(desc, str) else None)
            )
        )
    return items


class AgentToolsResponse(BaseModel):
    agent: str
    allowed_tools: list[str]


@router.get("/agents/{agent}/tools", response_model=AgentToolsResponse)
async def agent_tools(agent: str, scenario_id: str = Query("default")):
    sc = get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    ad = next(
        (a for a in sc.agents if a.name == agent or a.name.lower() == agent.lower()),
        None,
    )
    if not ad:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentToolsResponse(agent=ad.name, allowed_tools=list(ad.tools or []))


@router.get("/session2", response_model=SessionInitPayload)
async def get_session2(
    scenario_id: str = Query("default"),
    root_agent: str | None = None,
):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    sc = get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Fetch ephemeral key
    url = f"{OPENAI_BASE_URL}/realtime/sessions"
    payload = {"model": "gpt-4o-realtime-preview-2025-06-03"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10)) as client:
            res = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        res.raise_for_status()
        data = res.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Root agent selection
    root = root_agent or sc.default_root
    # Ensure root is first
    ordered = sorted(sc.agents, key=lambda a: 0 if a.name == root else 1)

    initial_agents = [
        {
            "name": a.name,
            "model": a.model,
            "instructions": a.instructions,
            **({"voice": a.voice} if a.voice else {}),
        }
        for a in ordered
    ]

    return SessionInitPayload(
        ephemeral_key=data["client_secret"]["value"],
        initial_agents=initial_agents,
        guardrails=[],
        scenario_id=sc.id,
        root_agent=root,
    )


# ---- Tool Execution Endpoint ----
@router.post("/tools/execute", response_model=ToolExecutionResult)
async def tool_execute(
    req: ToolExecutionRequest,
    scenario_id: str = Query("default"),
    session_id: str | None = Query(None),
):
    # Enforce per-agent allowlist if available in scenario registry
    try:
        if session_id:
            sess = store.get_session(session_id)
        else:
            sess = None
        sc = get_scenario(scenario_id)
        if sc and sess:
            # find active agent definition
            ad = next((a for a in sc.agents if a.name == sess.active_agent_id), None)
            if ad and ad.tools and req.tool not in ad.tools:
                return ToolExecutionResult(
                    tool=req.tool,
                    success=False,
                    error=f"Tool '{req.tool}' not allowed for agent '{ad.name}'",
                    output=None,
                    correlation_id=req.correlation_id,
                )
    except Exception:
        # Non-fatal: continue to attempt execution if guard lookup fails
        pass
    try:
        output = await execute_tool(req.tool, **req.args)
        return ToolExecutionResult(
            tool=req.tool,
            success=True,
            output=output,
            correlation_id=req.correlation_id,
        )
    except Exception as e:
        return ToolExecutionResult(
            tool=req.tool,
            success=False,
            error=str(e),
            output=None,
            correlation_id=req.correlation_id,
        )


# ---- Context Snapshot Endpoint ----
@router.post("/context/snapshot", response_model=ContextSnapshot)
async def context_snapshot(req: ContextSnapshotRequest):
    # Placeholder: In real impl, fetch from Supabase / other stores
    content_blocks = []
    if req.page:
        content_blocks.append(f"Page: {req.page}")
    if req.project_id:
        content_blocks.append(f"Project: {req.project_id}")
    if req.user_id:
        content_blocks.append(f"User: {req.user_id}")
    for k, v in req.extra.items():
        content_blocks.append(f"{k}: {v}")
    return ContextSnapshot(
        id=str(uuid4()),
        content_blocks=content_blocks,
        metadata={"size": len(content_blocks)},
    )


# ---- Moderation Endpoint ----
@router.post("/moderate", response_model=ModerationDecision)
async def moderate(req: ModerationRequest):
    # Minimal heuristic placeholder; replace with Responses API call
    lowered = req.text.lower()
    flagged = any(term in lowered for term in ["forbidden", "banned"])
    sanitized = req.text.replace("forbidden", "[redacted]") if flagged else req.text
    return ModerationDecision(
        allowed=not flagged,
        categories={"placeholder_flag": flagged},
        sanitized_text=sanitized if sanitized != req.text else None,
    )


# ---- Orchestration Endpoint ----
@router.post("/orchestrate", response_model=OrchestrationDecision)
async def orchestrate(req: OrchestrationRequest):
    sc = get_scenario(req.scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    # Simple rule: keep default root always in this placeholder
    chosen = sc.default_root
    decision = OrchestrationDecision(
        chosen_root=chosen,
        reason="placeholder_default",
        changed=False,
    )
    # If a session_id is provided, persist a no-op handoff (only if agent changes)
    if req.session_id:
        try:
            sess = store.get_session(req.session_id)
            if not sess:
                store.create_session(req.session_id, active_agent_id=chosen)
                sess = store.get_session(req.session_id)
            if sess and sess.active_agent_id != chosen:
                store.set_active_agent(req.session_id, chosen)
                seq = store.next_seq(req.session_id)
                ev = Event(
                    session_id=req.session_id,
                    seq=seq,
                    type="handoff",
                    role="system",
                    agent_id=chosen,
                    text=None,
                    reason=decision.reason,
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(req.session_id, ev)
        except Exception:
            # Non-fatal: orchestration decision still returned
            pass
    return decision


# ---- Server-side Agent Single Turn (Responses API) ----
class AgentRunRequest(BaseModel):
    model: str
    messages: list[dict]
    tools: list[dict] | None = None


@router.post("/agent/run")
async def agent_run(req: AgentRunRequest):
    try:
        resp = await run_single_turn(req.model, req.messages, req.tools)
        return resp
    except AgentRunnerError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ---- Agents SDK Session Endpoints ----
class SDKSessionCreateRequest(BaseModel):
    session_id: str | None = Field(
        None, description="Client provided session id (optional)"
    )
    agent_name: str = Field("assistant", description="Logical name for the agent")
    instructions: str = Field(
        ..., description="System / developer instructions for the agent"
    )
    model: str = Field("gpt-4.1-mini", description="Model to use for the agent")


@router.post("/sdk/session/create")
async def sdk_session_create(req: SDKSessionCreateRequest):
    sid = req.session_id or str(uuid4())
    # Ensure a store-level session exists (active agent is the provided agent_name)
    store.create_session(sid, active_agent_id=req.agent_name)
    payload = await sdk_manager.create_agent_session(
        session_id=sid,
        name=req.agent_name,
        instructions=req.instructions,
        model=req.model,
    )
    return payload


class SDKSessionDeleteRequest(BaseModel):
    session_id: str


@router.post("/sdk/session/delete")
async def sdk_session_delete(req: SDKSessionDeleteRequest):
    try:
        store.delete_session(req.session_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"delete failed: {e}")


class SDKSessionMessageRequest(BaseModel):
    session_id: str
    user_input: str
    agent: dict | None = Field(
        None, description="Optional override of agent spec: name, instructions, model"
    )
    client_message_id: str | None = Field(
        None, description="Client idempotency key for this user message"
    )


@router.post("/sdk/session/message")
async def sdk_session_message(req: SDKSessionMessageRequest):
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="user_input cannot be empty")
    agent_spec = req.agent or {}
    try:
        # Idempotency: if we have a recorded assistant event for this client_message_id, return it
        if req.client_message_id:
            prior = store.get_by_client_message_id(
                req.session_id, req.client_message_id
            )
            if prior:
                return {
                    "final_output": prior.text,
                    "new_items_len": 0,
                    "tool_calls": [],
                    "events": [prior.model_dump()],
                }
        # Ensure store session exists (fallback if client skipped create)
        if not store.get_session(req.session_id):
            store.create_session(
                req.session_id, active_agent_id=agent_spec.get("name", "assistant")
            )

        # Create user message event
        now_ms = int(time.time() * 1000)
        user_seq = store.next_seq(req.session_id)
        user_event = Event(
            session_id=req.session_id,
            seq=user_seq,
            type="message",
            message_id=req.client_message_id,
            role="user",
            agent_id=None,
            text=req.user_input,
            final=True,
            timestamp_ms=now_ms,
        )
        store.append_event(req.session_id, user_event)

        # Run assistant turn
        result = await sdk_manager.run_agent_turn(
            session_id=req.session_id,
            user_input=req.user_input,
            agent_spec=agent_spec,
        )
        # Simulate token streaming via background task; then emit final message
        message_id = req.client_message_id or str(uuid4())

        async def _emit_tokens(session_id: str, mid: str, text: str, agent_name: str):
            # naive chunking
            chunks = []
            if text:
                size = max(5, min(24, len(text) // 4 or 8))
                for i in range(0, len(text), size):
                    chunks.append(text[i : i + size])
            for i, ch in enumerate(chunks):
                await asyncio.sleep(0.12)
                seq = store.next_seq(session_id)
                tok = Event(
                    session_id=session_id,
                    seq=seq,
                    type="token",
                    message_id=mid,
                    token_seq=i,
                    role="assistant",
                    agent_id=agent_name,
                    text=ch,
                    final=False,
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(session_id, tok)
            # final assistant message
            seq = store.next_seq(session_id)
            asst_event = Event(
                session_id=session_id,
                seq=seq,
                type="message",
                message_id=mid,
                role="assistant",
                agent_id=agent_name,
                text=text,
                final=True,
                timestamp_ms=int(time.time() * 1000),
            )
            store.append_event(session_id, asst_event)
            if req.client_message_id:
                store.remember_client_message(
                    session_id, req.client_message_id, asst_event
                )

        asyncio.create_task(
            _emit_tokens(
                req.session_id,
                message_id,
                result.get("final_output") or "",
                agent_spec.get("name", "Assistant"),
            )
        )

        # Return original payload plus user event only; tokens/final will come via events polling
        return {**result, "events": [user_event.model_dump()]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"agent turn failed: {e}")


@router.get("/sdk/session/transcript")
async def sdk_session_transcript(session_id: str):
    try:
        return await sdk_manager.get_session_transcript(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"transcript retrieval failed: {e}")


# ---- Events Resume (M1 scaffold) ----
@router.get("/sdk/session/{session_id}/events")
async def list_session_events(session_id: str, since: int | None = Query(None)):
    try:
        events = store.list_events(session_id, since_seq=since)
        return [e.model_dump() for e in events]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"events retrieval failed: {e}")


# ---- Audio Ingestion (placeholder) ----
class AudioChunkRequest(BaseModel):
    session_id: str
    seq: int
    pcm16_base64: str = Field(
        ..., description="Little-endian 16-bit PCM mono @16k base64 encoded"
    )
    sample_rate: int = 16000
    frame_samples: int | None = None


@router.post("/sdk/session/audio")
async def sdk_session_audio(req: AudioChunkRequest):
    # Decode just to validate integrity; future: queue for ASR.
    try:
        raw = base64.b64decode(req.pcm16_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64")
    # Basic size sanity (must be even length for 16-bit samples)
    if len(raw) % 2 != 0:
        raise HTTPException(status_code=400, detail="PCM byte length not even")
    sample_count = len(raw) // 2
    info = {
        "accepted": True,
        "session_id": req.session_id,
        "seq": req.seq,
        "samples": sample_count,
        "sample_rate": req.sample_rate,
        "ts": time.time(),
    }
    # For now just echo metadata; could push to in-memory buffer keyed by session.
    return info
