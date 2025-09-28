from __future__ import annotations

import asyncio
from typing import Any, Dict

from agents import Agent, ModelSettings, Runner, SQLiteSession, function_tool

try:
    # Built-in tools (may not all be available or desired)
    from agents import (CodeInterpreterTool, ComputerTool,  # type: ignore
                        FileSearchTool, HostedMCPTool, ImageGenerationTool,
                        LocalShellTool, WebSearchTool)
except Exception:  # pragma: no cover - optional
    FileSearchTool = WebSearchTool = ComputerTool = HostedMCPTool = LocalShellTool = ImageGenerationTool = CodeInterpreterTool = None  # type: ignore
try:
    # Optional model providers
    from agents.models.openai_responses import \
        OpenAIResponsesModel  # type: ignore
except Exception:  # pragma: no cover
    OpenAIResponsesModel = None  # type: ignore
try:
    from agents.extensions.litellm import LiteLLMModel  # type: ignore
except Exception:  # pragma: no cover
    LiteLLMModel = None  # type: ignore
import time

from .core.models.event import Event
from .core.store.memory_store import store
from .registry import get_scenario
from .tools import tool_registry

# In-memory map of active sessions to SQLiteSession objects (file-backed optional later)
_session_cache: Dict[str, SQLiteSession] = {}


def get_or_create_session(session_id: str) -> SQLiteSession:
    session = _session_cache.get(session_id)
    if not session:
        # In-memory; switch to file path: SQLiteSession(session_id, "conversations.db") for persistence
        session = SQLiteSession(session_id)
        _session_cache[session_id] = session
    return session


def _resolve_agent_tools(names: list[str]):
    tools = []
    # In-file simple boolean switches (safe defaults). Easier to port later.
    BUILTIN_TOOLS_ENABLED = {
        "FileSearchTool": False,
        "WebSearchTool": True,  # enabled as requested
        "ComputerTool": False,
        "HostedMCPTool": False,
        "LocalShellTool": False,  # keep off unless explicitly audited
        "ImageGenerationTool": False,
        "CodeInterpreterTool": False,
    }

    def add_builtin(name: str):
        # Support canonical names and friendly aliases
        key = name
        if name.lower() in {"file_search", "filesearchtool"}:
            key = "FileSearchTool"
        elif name.lower() in {"web_search", "websearchtool"}:
            key = "WebSearchTool"
        elif name.lower() in {"computer", "computertool"}:
            key = "ComputerTool"
        elif name.lower() in {"hosted_mcp", "hostedmcptool"}:
            key = "HostedMCPTool"
        elif name.lower() in {"local_shell", "localshelltool"}:
            key = "LocalShellTool"
        elif name.lower() in {"image_generation", "imagegenerationtool"}:
            key = "ImageGenerationTool"
        elif name.lower() in {"code_interpreter", "codeinterpretertool"}:
            key = "CodeInterpreterTool"
        if not BUILTIN_TOOLS_ENABLED.get(key, False):
            return None
        cls_map = {
            "FileSearchTool": FileSearchTool,
            "WebSearchTool": WebSearchTool,
            "ComputerTool": ComputerTool,
            "HostedMCPTool": HostedMCPTool,
            "LocalShellTool": LocalShellTool,
            "ImageGenerationTool": ImageGenerationTool,
            "CodeInterpreterTool": CodeInterpreterTool,
        }
        cls = cls_map.get(key)
        if cls is None:
            return None
        try:
            # Instantiate with defaults; TODO: wire provider/config as needed
            return cls()
        except Exception:
            return None

    # First: include built-in tools requested by name
    for n in names or []:
        b = add_builtin(n)
        if b is not None:
            tools.append(b)

    # Then: include custom registry functions
    for n in names or []:
        spec = tool_registry.get(n)
        if not spec:
            continue
        # Wrap callable into function_tool to expose schema to Agents SDK
        ft = function_tool(
            spec.func,
            name=spec.name,
            description=spec.description,
            parameters=spec.params_schema or None,
        )
        tools.append(ft)
    return tools


# Runtime-toggleable provider flags (reflected via router endpoints)
USE_LITELLM: bool = False
USE_OA_RESPONSES_MODEL: bool = True


def _build_model_provider(model_name: str):
    """Optionally wrap model with OpenAI Responses adapter or LiteLLM.

    Default is the raw model string.
    """
    if USE_LITELLM and LiteLLMModel is not None:
        try:
            return LiteLLMModel(model_name)
        except Exception:
            pass
    if USE_OA_RESPONSES_MODEL and OpenAIResponsesModel is not None:
        try:
            return OpenAIResponsesModel(model_name)
        except Exception:
            pass
    return model_name


def _extract_usage(result: Any) -> Dict[str, Any] | None:
    """Best-effort extraction of token usage from Agents SDK result."""
    # Common shapes to probe without strict coupling
    cand = getattr(result, "usage", None) or getattr(result, "meta", None)
    if not cand and hasattr(result, "response"):
        cand = getattr(result.response, "usage", None)
    if not cand:
        return None
    # Normalize to {input_tokens, output_tokens, total_tokens}
    in_tok = (
        getattr(cand, "input_tokens", None) or cand.get("input_tokens")
        if isinstance(cand, dict)
        else None
    )
    out_tok = (
        getattr(cand, "output_tokens", None) or cand.get("output_tokens")
        if isinstance(cand, dict)
        else None
    )
    total = (
        getattr(cand, "total_tokens", None) or cand.get("total_tokens")
        if isinstance(cand, dict)
        else None
    )
    if in_tok is None and out_tok is None and total is None:
        return None
    return {
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "total_tokens": (
            total if total is not None else ((in_tok or 0) + (out_tok or 0))
        ),
    }


async def create_agent_session(
    session_id: str,
    name: str,
    instructions: str,
    model: str = "gpt-4.1-mini",
    scenario_id: str | None = None,
    overlay: str | None = None,
) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    # Pull allowlist from scenario if provided
    tools = []
    if scenario_id:
        sc = get_scenario(scenario_id)
        if sc:
            ad = next((a for a in sc.agents if a.name == name), None)
            if ad:
                tools = _resolve_agent_tools(ad.tools)
    # Apply handoff prompt if extension available and agent participates in handoffs
    try:
        from agents.extensions.handoff_prompt import \
            prompt_with_handoff_instructions  # type: ignore

        sc = get_scenario(scenario_id) if scenario_id else None
        ad = None
        if sc:
            ad = next((a for a in sc.agents if a.name == name), None)
        instr = (
            prompt_with_handoff_instructions(instructions)
            if ad and ad.handoff_targets
            else instructions
        )
    except Exception:
        instr = instructions

    prov = _build_model_provider(model)
    ms = None
    try:
        # Enable usage for LiteLLM if used
        if prov.__class__.__name__ == "LitellmModel":  # type: ignore[attr-defined]
            ms = ModelSettings(include_usage=True)
    except Exception:
        pass
    # Only pass model_settings if present; Agents SDK raises TypeError on None
    if ms is not None:
        agent = Agent(
            name=name, instructions=instr, model=prov, tools=tools, model_settings=ms
        )
    else:
        agent = Agent(name=name, instructions=instr, model=prov, tools=tools)
    # Optionally run a priming turn (not required)
    return {
        "session_id": session_id,
        "agent_name": agent.name,
        "model": model,
        "tools": [t.name for t in tools],
        "overlay": overlay,
    }


async def run_agent_turn(
    session_id: str,
    user_input: str,
    agent_spec: Dict[str, Any],
    scenario_id: str | None = None,
) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    # Reconstruct lightweight agent each call (cheap); could cache if instructions stable
    name = agent_spec.get("name", "Assistant")
    tools = []
    if scenario_id:
        sc = get_scenario(scenario_id)
        if sc:
            ad = next((a for a in sc.agents if a.name == name), None)
            if ad:
                tools = _resolve_agent_tools(ad.tools)
    # Handoff instructions if applicable
    base_instr = agent_spec.get("instructions", "You are a helpful assistant.")
    try:
        from agents.extensions.handoff_prompt import \
            prompt_with_handoff_instructions  # type: ignore

        sc = get_scenario(scenario_id) if scenario_id else None
        ad = None
        if sc:
            ad = next((a for a in sc.agents if a.name == name), None)
        instr = (
            prompt_with_handoff_instructions(base_instr)
            if ad and ad.handoff_targets
            else base_instr
        )
    except Exception:
        instr = base_instr
    prov = _build_model_provider(agent_spec.get("model", "gpt-4.1-mini"))
    ms = None
    try:
        if prov.__class__.__name__ == "LitellmModel":  # type: ignore[attr-defined]
            ms = ModelSettings(include_usage=True)
    except Exception:
        pass
    if ms is not None:
        agent = Agent(
            name=name, instructions=instr, model=prov, tools=tools, model_settings=ms
        )
    else:
        agent = Agent(name=name, instructions=instr, model=prov, tools=tools)
    result = await Runner.run(agent, user_input, session=session)
    # Emit tool_call/tool_result events opportunistically
    try:
        for i in getattr(result, "new_items", []) or []:
            # Tool call
            tname = getattr(i, "tool_name", None) or getattr(i, "name", None)
            if tname:
                seq = store.next_seq(session_id)
                ev = Event(
                    session_id=session_id,
                    seq=seq,
                    type="tool_call",
                    role="tool",
                    agent_id=name,
                    text=None,
                    final=False,
                    data={
                        "tool": tname,
                        "args": getattr(i, "args", None)
                        or getattr(i, "tool_arguments", None),
                    },
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(session_id, ev)
            # Tool result (best-effort)
            tout = getattr(i, "tool_output", None) or getattr(i, "output", None)
            if tout is not None:
                seq = store.next_seq(session_id)
                evr = Event(
                    session_id=session_id,
                    seq=seq,
                    type="tool_result",
                    role="tool",
                    agent_id=name,
                    text=str(tout)[:4000],
                    final=True,
                    data={"tool": tname or getattr(i, "tool_name", None)},
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(session_id, evr)
    except Exception:
        pass
    # Extract token usage and accumulate per session
    usage = None
    try:
        # Agents SDK guidance: result.context_wrapper.usage
        ctx = getattr(result, "context_wrapper", None)
        if ctx is not None:
            u = getattr(ctx, "usage", None)
            if u is not None:
                # normalize
                usage = {
                    "requests": getattr(u, "requests", None),
                    "input_tokens": getattr(u, "input_tokens", None),
                    "output_tokens": getattr(u, "output_tokens", None),
                    "total_tokens": getattr(u, "total_tokens", None),
                }
        if not usage:
            usage = _extract_usage(result)
        if usage:
            totals = store.add_usage(session_id, usage)
            usage = {**usage, "aggregated": totals}
    except Exception:
        pass
    return {
        "final_output": result.final_output,
        "new_items_len": len(result.new_items),
        "tool_calls": [
            getattr(i, "tool_name", None)
            for i in result.new_items
            if hasattr(i, "tool_name")
        ],
        "used_tools": [t.name for t in tools],
        "usage": usage,
    }


async def run_supervisor_orchestrate(
    scenario_id: str,
    last_user_text: str,
    session_id: str | None = None,
) -> Dict[str, Any]:
    """Run a supervisor agent (if defined in scenario) that can call a `handoff` tool
    to select a target agent and provide a reason. Falls back to heuristic if missing.
    Returns { chosen_root, reason, changed } and persists handoff if session_id provided.
    """
    sc = get_scenario(scenario_id)
    if not sc:
        return {"chosen_root": None, "reason": "no_such_scenario", "changed": False}
    sup = next(
        (
            a
            for a in sc.agents
            if getattr(a, "role", "").lower() == "supervisor" or a.name == "supervisor"
        ),
        None,
    )
    if not sup:
        # Fallback heuristic
        text = (last_user_text or "").lower()

        def pick_agent() -> str:
            if any(
                k in text
                for k in ["buy", "price", "recommend", "product", "catalog", "purchase"]
            ):
                return (
                    "sales"
                    if any(a.name == "sales" for a in sc.agents)
                    else sc.default_root
                )
            if any(
                k in text
                for k in [
                    "error",
                    "issue",
                    "problem",
                    "troubleshoot",
                    "not working",
                    "help",
                ]
            ):
                return (
                    "support"
                    if any(a.name == "support" for a in sc.agents)
                    else sc.default_root
                )
            return sc.default_root

        chosen = pick_agent()
        changed = False
        reason = "heuristic_router"
        if session_id:
            try:
                sess = store.get_session(session_id)
                if not sess:
                    store.create_session(session_id, active_agent_id=chosen)
                    sess = store.get_session(session_id)
                if sess and sess.active_agent_id != chosen:
                    changed = True
                    store.set_active_agent(session_id, chosen)
                    seq = store.next_seq(session_id)
                    ev = Event(
                        session_id=session_id,
                        seq=seq,
                        type="handoff",
                        role="system",
                        agent_id=chosen,
                        text=None,
                        final=True,
                        reason=reason,
                        timestamp_ms=int(time.time() * 1000),
                    )
                    store.append_event(session_id, ev)
            except Exception:
                pass
        return {"chosen_root": chosen, "reason": reason, "changed": changed}

    # Build supervisor with a `handoff` function tool
    decision: Dict[str, Any] = {"target": sc.default_root, "reason": "no_call"}
    try:

        def handoff(target: str, reason: str | None = None):
            nonlocal decision
            valid = {a.name for a in sc.agents}
            if target not in valid:
                decision = {
                    "target": decision.get("target", sc.default_root),
                    "reason": f"invalid_target:{target}",
                }
            else:
                decision = {"target": target, "reason": reason or "supervisor_choice"}
            return {"ok": True, **decision}

        handoff_tool = function_tool(
            handoff,
            name="handoff",
            description="Select the best agent to handle the user.",
            parameters={
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Agent name to activate",
                    },
                    "reason": {"type": "string"},
                },
                "required": ["target"],
            },
        )

        # Apply model provider
        prov = _build_model_provider(sup.model)
        ms = None
        try:
            if prov.__class__.__name__ == "LitellmModel":  # type: ignore[attr-defined]
                ms = ModelSettings(include_usage=True)
        except Exception:
            pass

        instr = sup.instructions
        try:
            from agents.extensions.handoff_prompt import \
                prompt_with_handoff_instructions  # type: ignore

            instr = prompt_with_handoff_instructions(instr)
        except Exception:
            pass

        if ms is not None:
            supervisor = Agent(
                name=sup.name,
                instructions=instr,
                model=prov,
                tools=[handoff_tool],
                model_settings=ms,
            )
        else:
            supervisor = Agent(
                name=sup.name, instructions=instr, model=prov, tools=[handoff_tool]
            )
        session = get_or_create_session(session_id or f"sup-{sc.id}")
        try:
            await Runner.run(supervisor, last_user_text or "", session=session)
        except Exception:
            # Non-fatal: fall back to heuristic below
            pass
    except Exception:
        # Entire supervisor setup failed; fall back
        pass

    chosen = decision.get("target", sc.default_root)
    reason = decision.get("reason", "supervisor_default")
    changed = False
    if session_id:
        try:
            sess = store.get_session(session_id)
            if not sess:
                store.create_session(session_id, active_agent_id=chosen)
                sess = store.get_session(session_id)
            if sess and sess.active_agent_id != chosen:
                changed = True
                store.set_active_agent(session_id, chosen)
                seq = store.next_seq(session_id)
                ev = Event(
                    session_id=session_id,
                    seq=seq,
                    type="handoff",
                    role="system",
                    agent_id=chosen,
                    text=None,
                    final=True,
                    reason=reason,
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(session_id, ev)
        except Exception:
            pass
    return {"chosen_root": chosen, "reason": reason, "changed": changed}


async def get_session_transcript(session_id: str) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    items = await session.get_items()
    return {"session_id": session_id, "items": items, "length": len(items)}
