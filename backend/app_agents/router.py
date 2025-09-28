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
    params: dict | None = None


@router.get("/tools/list", response_model=list[ToolListItem])
async def tools_list():
    from .tools import tool_registry

    items = []
    for k, spec in tool_registry.items():
        desc = spec.description or None
        items.append(
            ToolListItem(name=k, description=desc, params=(spec.params_schema or None))
        )
    return items


# Built-in tools config/status (for docs/debug)
class ToolConfigStatus(BaseModel):
    name: str
    enabled: bool
    available: bool


@router.get("/tools/config/status", response_model=list[ToolConfigStatus])
async def tools_config_status():
    from .sdk_manager import \
        _resolve_agent_tools  # reuse resolution map indirectly

    # Reflect configured built-in availability by attempting to resolve them
    # without adding custom registry tools.
    names = [
        "FileSearchTool",
        "WebSearchTool",
        "ComputerTool",
        "HostedMCPTool",
        "LocalShellTool",
        "ImageGenerationTool",
        "CodeInterpreterTool",
    ]
    status: list[ToolConfigStatus] = []
    # Peek into the configuration used by _resolve_agent_tools by calling it with each name
    for n in names:
        tools = _resolve_agent_tools([n])
        status.append(
            ToolConfigStatus(
                name=n,
                enabled=bool(tools and tools[0].__class__.__name__ == n),
                available=bool(tools),
            )
        )
    return status


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


# Agents listing for FE
class AgentListItem(BaseModel):
    name: str
    role: str
    model: str
    tools: list[str]
    handoff_targets: list[str]


@router.get("/agents", response_model=list[AgentListItem])
async def agents_list(scenario_id: str = Query("default")):
    sc = get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return [
        AgentListItem(
            name=a.name,
            role=a.role,
            model=a.model,
            tools=a.tools or [],
            handoff_targets=a.handoff_targets or [],
        )
        for a in sc.agents
    ]


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
    try:
        # Prefer supervisor orchestration when available
        from . import sdk_manager as sm

        text = (
            getattr(req, "last_user_text", None)
            or getattr(req, "last_user_input", None)
            or ""
        )
        res = await sm.run_supervisor_orchestrate(
            scenario_id=req.scenario_id,
            last_user_text=text,
            session_id=req.session_id,
        )
        return OrchestrationDecision(
            chosen_root=res.get("chosen_root"),
            reason=res.get("reason", "unknown"),
            changed=bool(res.get("changed")),
        )
    except Exception as e:
        # Non-fatal fallback to avoid breaking FE flows; return unchanged decision
        return OrchestrationDecision(
            chosen_root=None, reason=f"error:{e}", changed=False
        )


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
    scenario_id: str | None = Field(None, description="Scenario to bind to")
    overlay: str | None = Field(None, description="Optional overlay/instructions tag")


@router.post("/sdk/session/create")
async def sdk_session_create(req: SDKSessionCreateRequest):
    sid = req.session_id or str(uuid4())
    # Ensure a store-level session exists (active agent is the provided agent_name)
    store.create_session(
        sid, active_agent_id=req.agent_name, scenario_id=req.scenario_id
    )
    payload = await sdk_manager.create_agent_session(
        session_id=sid,
        name=req.agent_name,
        instructions=req.instructions,
        model=req.model,
        scenario_id=req.scenario_id,
        overlay=req.overlay,
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
    scenario_id: str | None = Field(
        None, description="Scenario binding for tools allowlist"
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
            scenario_id=req.scenario_id,
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


# Allow FE to switch active agent explicitly (bonus)
class SetActiveAgentRequest(BaseModel):
    session_id: str
    agent_name: str


@router.post("/sdk/session/set_active_agent")
async def set_active_agent(req: SetActiveAgentRequest):
    try:
        store.set_active_agent(req.session_id, req.agent_name)
        seq = store.next_seq(req.session_id)
        ev = Event(
            session_id=req.session_id,
            seq=seq,
            type="handoff",
            role="system",
            agent_id=req.agent_name,
            text=None,
            final=True,
            reason="manual_switch",
            timestamp_ms=int(time.time() * 1000),
        )
        store.append_event(req.session_id, ev)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"set_active_agent failed: {e}")


@router.get("/sdk/session/transcript")
async def sdk_session_transcript(session_id: str):
    try:
        return await sdk_manager.get_session_transcript(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"transcript retrieval failed: {e}")


# ---- Usage Endpoints ----
class UsageResponse(BaseModel):
    requests: int
    input_tokens: int
    output_tokens: int
    total_tokens: int


@router.get("/sdk/session/usage", response_model=UsageResponse)
async def get_session_usage(session_id: str = Query(...)):
    try:
        u = store.get_usage(session_id)
        return UsageResponse(**u)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"usage retrieval failed: {e}")


# Providers status (OpenAIResponses, LiteLLM)
class ProvidersStatus(BaseModel):
    openai_responses: bool
    litellm: bool


@router.get("/models/providers/status", response_model=ProvidersStatus)
async def providers_status():
    try:
        from .sdk_manager import (LiteLLMModel,  # type: ignore
                                  OpenAIResponsesModel)

        return ProvidersStatus(
            openai_responses=OpenAIResponsesModel is not None,
            litellm=LiteLLMModel is not None,
        )
    except Exception:
        return ProvidersStatus(openai_responses=False, litellm=False)


class ProviderFlags(BaseModel):
    use_openai_responses: bool
    use_litellm: bool


@router.get("/models/providers/flags", response_model=ProviderFlags)
async def get_provider_flags():
    try:
        from . import sdk_manager as sm

        return ProviderFlags(
            use_openai_responses=bool(getattr(sm, "USE_OA_RESPONSES_MODEL", False)),
            use_litellm=bool(getattr(sm, "USE_LITELLM", False)),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"flags retrieval failed: {e}")


@router.post("/models/providers/flags", response_model=ProviderFlags)
async def set_provider_flags(flags: ProviderFlags):
    try:
        from . import sdk_manager as sm

        setattr(sm, "USE_OA_RESPONSES_MODEL", bool(flags.use_openai_responses))
        setattr(sm, "USE_LITELLM", bool(flags.use_litellm))
        return await get_provider_flags()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"flags update failed: {e}")


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
