from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
from uuid import uuid4

import httpx
from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import sdk_manager
## Removed Responses single-turn path; focusing on Agents SDK endpoints only.
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

router = APIRouter()
logger = logging.getLogger(__name__)


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


# ---- Providers status (SDK-only) ----
class ProvidersStatus(BaseModel):
    openai_responses: bool
    litellm: bool
    agents_sdk: bool
    default_responses: bool = False


@router.get("/models/providers/status", response_model=ProvidersStatus)
async def providers_status():
    # SDK-only: report only Agents SDK availability; others false
    try:
        return ProvidersStatus(
            openai_responses=False,
            litellm=False,
            agents_sdk=True,
            default_responses=False,
        )
    except Exception:
        return ProvidersStatus(
            openai_responses=False,
            litellm=False,
            agents_sdk=False,
            default_responses=False,
        )


# Flags API (compat): static SDK-only values; POST is a no-op
class ProviderFlags(BaseModel):
    use_openai_responses: bool
    use_litellm: bool
    use_agents_sdk: bool


@router.get("/models/providers/flags", response_model=ProviderFlags)
async def get_provider_flags():
    try:
        return ProviderFlags(
            use_openai_responses=False, use_litellm=False, use_agents_sdk=True
        )
    except Exception:
        return ProviderFlags(
            use_openai_responses=False, use_litellm=False, use_agents_sdk=False
        )


@router.post("/models/providers/flags", response_model=ProviderFlags)
async def set_provider_flags(flags: ProviderFlags):
    # Ignore inputs; keep SDK-only
    return await get_provider_flags()


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


# Removed Responses single-turn endpoint; LLM routes removed; SDK endpoints remain.
