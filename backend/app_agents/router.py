from __future__ import annotations
import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from .registry import list_scenarios, get_scenario
from .schemas import (
    SessionInitPayload,
    ToolExecutionRequest,
    ToolExecutionResult,
    ContextSnapshotRequest,
    ContextSnapshot,
    ModerationRequest,
    ModerationDecision,
    OrchestrationRequest,
    OrchestrationDecision,
)
from .tools import execute_tool
from uuid import uuid4
from .agent_runner import run_single_turn, AgentRunnerError
from . import sdk_manager
from pydantic import Field

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

router = APIRouter(prefix="/api")

class ScenarioListItem(BaseModel):
    id: str
    label: str
    description: str | None = None

@router.get("/scenarios", response_model=list[ScenarioListItem])
async def scenarios_endpoint():
    return [ScenarioListItem(id=s.id, label=s.label, description=s.description) for s in list_scenarios()]

@router.get("/scenarios/{scenario_id}")
async def scenario_detail(scenario_id: str):
    sc = get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return sc.model_dump()

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
async def tool_execute(req: ToolExecutionRequest):
    try:
        output = await execute_tool(req.tool, **req.args)
        return ToolExecutionResult(
            tool=req.tool, success=True, output=output, correlation_id=req.correlation_id
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
        id=str(uuid4()), content_blocks=content_blocks, metadata={"size": len(content_blocks)}
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
    return OrchestrationDecision(
        chosen_root=chosen,
        reason="placeholder_default",
        changed=False,
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
    session_id: str | None = Field(None, description="Client provided session id (optional)")
    agent_name: str = Field("assistant", description="Logical name for the agent")
    instructions: str = Field(..., description="System / developer instructions for the agent")
    model: str = Field("gpt-4.1-mini", description="Model to use for the agent")


@router.post("/sdk/session/create")
async def sdk_session_create(req: SDKSessionCreateRequest):
    sid = req.session_id or str(uuid4())
    payload = await sdk_manager.create_agent_session(
        session_id=sid,
        name=req.agent_name,
        instructions=req.instructions,
        model=req.model,
    )
    return payload


class SDKSessionMessageRequest(BaseModel):
    session_id: str
    user_input: str
    agent: dict | None = Field(None, description="Optional override of agent spec: name, instructions, model")


@router.post("/sdk/session/message")
async def sdk_session_message(req: SDKSessionMessageRequest):
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="user_input cannot be empty")
    agent_spec = req.agent or {}
    try:
        result = await sdk_manager.run_agent_turn(
            session_id=req.session_id,
            user_input=req.user_input,
            agent_spec=agent_spec,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"agent turn failed: {e}")


@router.get("/sdk/session/transcript")
async def sdk_session_transcript(session_id: str):
    try:
        return await sdk_manager.get_session_transcript(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"transcript retrieval failed: {e}")
