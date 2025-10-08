from __future__ import annotations

import asyncio
from typing import Any, Dict
import os
import logging

def _env_truthy(name: str, default: str = "0") -> bool:
    v = os.getenv(name)
    if v is None:
        v = default
    return str(v).lower() in ("1", "true", "yes", "on")

# Allow both spellings; default is NOT disabled (so SDK is allowed by default)
DISABLE_AGENTS_SDK = _env_truthy("DISABLE_AGENTS_SDK") or _env_truthy("DISABLE_AGENT_SDK")
AGENTS_SDK_AVAILABLE = False
Agent = ModelSettings = Runner = SQLiteSession = function_tool = None  # type: ignore

logger = logging.getLogger(__name__)

def _ensure_agents_sdk_loaded():
    global Agent, ModelSettings, Runner, SQLiteSession, function_tool, AGENTS_SDK_AVAILABLE
    if AGENTS_SDK_AVAILABLE or DISABLE_AGENTS_SDK:
        return
    try:  # defer import to avoid pulling in heavy deps unless explicitly enabled
        from agents import Agent as _A, ModelSettings as _MS, Runner as _R, SQLiteSession as _SS, function_tool as _FT  # type: ignore
        Agent, ModelSettings, Runner, SQLiteSession, function_tool = _A, _MS, _R, _SS, _FT
        AGENTS_SDK_AVAILABLE = True
    except Exception:
        Agent = ModelSettings = Runner = SQLiteSession = function_tool = None  # type: ignore
        AGENTS_SDK_AVAILABLE = False

# Built-in tools (only if Agents SDK is enabled)
FileSearchTool = WebSearchTool = ComputerTool = HostedMCPTool = LocalShellTool = ImageGenerationTool = CodeInterpreterTool = None  # type: ignore
def _ensure_builtin_tools_loaded():
    global FileSearchTool, WebSearchTool, ComputerTool, HostedMCPTool, LocalShellTool, ImageGenerationTool, CodeInterpreterTool
    if DISABLE_AGENTS_SDK:
        return
    if FileSearchTool is not None:
        return
    try:
        from agents import (  # type: ignore
            CodeInterpreterTool as _CIT,
            ComputerTool as _CT,
            FileSearchTool as _FST,
            HostedMCPTool as _HMT,
            ImageGenerationTool as _IGT,
            LocalShellTool as _LST,
            WebSearchTool as _WST,
        )
        FileSearchTool, WebSearchTool, ComputerTool, HostedMCPTool, LocalShellTool, ImageGenerationTool, CodeInterpreterTool = (
            _FST, _WST, _CT, _HMT, _LST, _IGT, _CIT
        )
    except Exception:
        FileSearchTool = WebSearchTool = ComputerTool = HostedMCPTool = LocalShellTool = ImageGenerationTool = CodeInterpreterTool = None  # type: ignore
# Lazy provider wrappers to prevent heavy imports unless explicitly used
_OpenAIResponsesModel_cls = None
_LiteLLMModel_cls = None

def _get_OpenAIResponsesModel():
    global _OpenAIResponsesModel_cls
    if DISABLE_AGENTS_SDK:
        return None
    if _OpenAIResponsesModel_cls is not None:
        return _OpenAIResponsesModel_cls
    try:  # type: ignore
        from agents.models.openai_responses import OpenAIResponsesModel as _C
        _OpenAIResponsesModel_cls = _C
        return _C
    except Exception:
        _OpenAIResponsesModel_cls = None
        return None

def _get_LiteLLMModel():
    global _LiteLLMModel_cls
    if DISABLE_AGENTS_SDK:
        return None
    if _LiteLLMModel_cls is not None:
        return _LiteLLMModel_cls
    try:  # type: ignore
        from agents.extensions.litellm import LiteLLMModel as _C  # type: ignore
        _LiteLLMModel_cls = _C
        return _C
    except Exception:
        _LiteLLMModel_cls = None
        return None
import time

from .core.models.event import Event
from .core.store.memory_store import store
from .registry import get_scenario
from .tools import tool_registry

# In-memory map of active sessions to SQLiteSession objects (file-backed optional later)
# SQLiteSession may be unavailable; store as generic values
_session_cache: Dict[str, Any] = {}


def get_or_create_session(session_id: str):
    if not AGENTS_SDK_AVAILABLE or SQLiteSession is None:
        # Fallback: return a simple sentinel object (not used by fallback path)
        return {"id": session_id}
    session = _session_cache.get(session_id)
    if not session:
        # In-memory; switch to file path: SQLiteSession(session_id, "conversations.db") for persistence
        session = SQLiteSession(session_id)
        _session_cache[session_id] = session
    return session


def _resolve_agent_tools(names: list[str]):
    tools = []
    _ensure_agents_sdk_loaded()
    _ensure_builtin_tools_loaded()
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

    # Then: include custom registry functions (only if Agents SDK is available)
    for n in names or []:
        if not AGENTS_SDK_AVAILABLE or function_tool is None:
            # Cannot wrap without Agents SDK
            break
        spec = tool_registry.get(n)
        if not spec:
            continue
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
# For SDK-first restore, default to Responses wrapper off and Agents SDK on.
USE_OA_RESPONSES_MODEL: bool = False
# Expose an Agents SDK toggle separate from DISABLE_AGENTS_SDK env. If this is True
# and DISABLE_AGENTS_SDK is False, we will attempt to use the SDK path; otherwise
# we will use the direct Responses fallback.
USE_AGENTS_SDK: bool = True


def _build_model_provider(model_name: str):
    """Optionally wrap model with OpenAI Responses adapter or LiteLLM.

    Default is the raw model string.
    """
    LLM = _get_LiteLLMModel()
    if USE_LITELLM and LLM is not None:
        try:
            return LLM(model_name)
        except Exception:
            pass
    OARM = _get_OpenAIResponsesModel()
    if USE_OA_RESPONSES_MODEL and OARM is not None:
        try:
            return OARM(model_name)
        except Exception:
            pass
    return model_name

def _extract_responses_text(resp: Dict[str, Any]) -> str:
    """Best-effort text extraction for OpenAI Responses API payloads.

    Handles several return shapes across versions.
    """
    if not isinstance(resp, dict):
        return ""
    # Common helpers
    def _collect_from_content(content: Any) -> list[str]:
        out: list[str] = []
        if isinstance(content, str):
            out.append(content)
        elif isinstance(content, list):
            for c in content:
                if not isinstance(c, dict):
                    continue
                if c.get("type") in {"text", "input_text", "output_text"} and isinstance(c.get("text"), str):
                    out.append(c["text"].strip())
        return out

    # 1) Top-level
    if isinstance(resp.get("output_text"), str):
        return resp["output_text"]
    if isinstance(resp.get("content"), str):
        return resp["content"]
    # 2) Nested response object
    r2 = resp.get("response")
    if isinstance(r2, dict):
        if isinstance(r2.get("output_text"), str):
            return r2["output_text"]
        if isinstance(r2.get("content"), str):
            return r2["content"]
        # Or response.output list
        if isinstance(r2.get("output"), list):
            texts: list[str] = []
            for item in r2["output"]:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "message":
                    texts += _collect_from_content(item.get("content"))
                elif isinstance(item.get("text"), str):
                    texts.append(item["text"])
            if texts:
                return "\n".join([t for t in texts if t])
    # 3) Top-level output array
    if isinstance(resp.get("output"), list):
        texts: list[str] = []
        for item in resp["output"]:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "message":
                texts += _collect_from_content(item.get("content"))
            elif isinstance(item.get("text"), str):
                texts.append(item["text"])
        if texts:
            return "\n".join([t for t in texts if t])
    # 4) Legacy chat-completions shape, just in case
    if isinstance(resp.get("choices"), list) and resp["choices"]:
        try:
            msg = resp["choices"][0]["message"]["content"]
            if isinstance(msg, str):
                return msg
        except Exception:
            pass
    return ""


def providers_probe() -> Dict[str, bool]:
    """Report availability of optional providers without forcing heavy imports when disabled."""
    # If disabled, report false for SDK-related wrappers
    agents_sdk_available = False
    if not DISABLE_AGENTS_SDK:
        try:
            _ensure_agents_sdk_loaded()
            agents_sdk_available = bool(AGENTS_SDK_AVAILABLE)
        except Exception:
            agents_sdk_available = False
    return {
        "openai_responses": _get_OpenAIResponsesModel() is not None,
        "litellm": _get_LiteLLMModel() is not None,
        "agents_sdk": agents_sdk_available,
    }


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
    # Ensure SDK is loaded before session creation so we don't return a sentinel
    _ensure_agents_sdk_loaded()
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
    _ensure_agents_sdk_loaded()
    if USE_AGENTS_SDK and AGENTS_SDK_AVAILABLE and Agent is not None:
        ms = None
        try:
            # Enable usage for LiteLLM if used
            if prov.__class__.__name__ == "LitellmModel":  # type: ignore[attr-defined]
                ms = ModelSettings(include_usage=True)
        except Exception:
            pass
        # Only pass model_settings if present; Agents SDK raises TypeError on None
        if ms is not None:
            Agent(name=name, instructions=instr, model=prov, tools=tools, model_settings=ms)
        else:
            Agent(name=name, instructions=instr, model=prov, tools=tools)
    # Optionally run a priming turn (not required)
    return {
        "session_id": session_id,
        "agent_name": name,
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
    # Ensure SDK is loaded before session creation so the session is a real SQLiteSession
    _ensure_agents_sdk_loaded()
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
    # Fallback if Agents SDK not available: use single-turn helper
    prov = _build_model_provider(agent_spec.get("model", "gpt-4.1-mini"))
    _ensure_agents_sdk_loaded()
    if not (USE_AGENTS_SDK and AGENTS_SDK_AVAILABLE and Agent is not None and Runner is not None):
        # Minimal call using existing helper and synthesize a result-like dict
        try:
            # Respect FE flags: if Responses wrapper is disabled entirely, don't call it
            if not USE_OA_RESPONSES_MODEL:
                raise RuntimeError("responses_disabled_by_flag")
            from .agent_runner import run_single_turn
            messages = [{"role": "user", "content": user_input}]
            resp = await run_single_turn(
                agent_spec.get("model", "gpt-4.1-mini"), messages, None
            )
            final_output = (
                resp.get("output_text")
                or resp.get("final_output")
                or resp.get("content")
                or ""
            )
            return {
                "final_output": final_output,
                "new_items_len": 0,
                "tool_calls": [],
                "used_tools": [],
                "usage": resp.get("usage"),
            }
        except Exception as e:
            # Surface the failure as a log event in the session store
            try:
                seq = store.next_seq(session_id)
                ev = Event(
                    session_id=session_id,
                    seq=seq,
                    type="log",
                    role="system",
                    agent_id=name,
                    text=f"fallback_responses_error: {e}",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                )
                store.append_event(session_id, ev)
            except Exception:
                pass
            return {
                "final_output": "",
                "new_items_len": 0,
                "tool_calls": [],
                "used_tools": [],
                "usage": None,
            }
    # Agents SDK path
    ms = None
    try:
        if getattr(prov, "__class__", type("_", (), {})).__name__.lower() == "litellmmodel":  # type: ignore[attr-defined]
            ms = ModelSettings(include_usage=True)
    except Exception:
        pass
    if ms is not None:
        agent = Agent(
            name=name, instructions=instr, model=prov, tools=tools, model_settings=ms
        )
    else:
        agent = Agent(name=name, instructions=instr, model=prov, tools=tools)
    try:
        result = await Runner.run(agent, user_input, session=session)
    except Exception as e:
        # Emit a log event and continue to fallback
        try:
            seq = store.next_seq(session_id)
            store.append_event(
                session_id,
                Event(
                    session_id=session_id,
                    seq=seq,
                    type="log",
                    role="system",
                    agent_id=name,
                    text=f"agents_sdk_error: {e}",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        # Synthesize minimal result shape to drive fallback
        class _Empty:
            final_output = ""
            new_items: list[Any] = []
        result = _Empty()
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
    # Try to extract assistant text from the Agents SDK result
    def _extract_text_from_result(res: Any) -> str | None:
        try:
            for attr in ("final_output", "output_text", "text", "message"):
                v = getattr(res, attr, None)
                if isinstance(v, str) and v.strip():
                    return v.strip()
            r = getattr(res, "response", None)
            # dict-like response object support
            if isinstance(r, dict):
                # direct output_text/content on response
                for k in ("output_text", "content", "message", "text"):
                    if isinstance(r.get(k), str) and r.get(k).strip():
                        return r.get(k).strip()
                out = r.get("output")
                if isinstance(out, list):
                    parts: list[str] = []
                    for item in out:
                        if not isinstance(item, dict):
                            continue
                        content = item.get("content")
                        if isinstance(content, list):
                            for c in content:
                                if (
                                    isinstance(c, dict)
                                    and c.get("type") in ("output_text", "text", "input_text")
                                    and c.get("text")
                                ):
                                    parts.append(str(c.get("text")))
                        elif isinstance(item.get("text"), str):
                            parts.append(item.get("text"))
                    if parts:
                        return "\n".join(parts).strip()
        except Exception:
            return None
        return None

    # If Agents SDK produced no assistant text, fall back to single-turn Responses API
    final_text = _extract_text_from_result(result)
    used_fallback = False
    if not final_text:
        try:
            if not USE_OA_RESPONSES_MODEL:
                raise RuntimeError("responses_disabled_by_flag")
            from .agent_runner import run_single_turn

            messages = [{"role": "user", "content": user_input}]
            resp = await run_single_turn(
                agent_spec.get("model", "gpt-4.1-mini"), messages, None
            )
            final_text = (
                resp.get("output_text")
                or resp.get("final_output")
                or resp.get("content")
                or ""
            )
            used_fallback = True
            # If usage wasn't available from SDK, use the Responses usage
            if not usage and resp.get("usage"):
                try:
                    totals = store.add_usage(session_id, resp["usage"])  # type: ignore[index]
                    usage = {**resp["usage"], "aggregated": totals}  # type: ignore[index]
                except Exception:
                    pass
        except Exception as e:
            # Log the fallback failure so it surfaces in Raw Logs
            try:
                seq = store.next_seq(session_id)
                store.append_event(
                    session_id,
                    Event(
                        session_id=session_id,
                        seq=seq,
                        type="log",
                        role="system",
                        agent_id=name,
                        text=f"fallback_responses_error: {e}",
                        final=True,
                        timestamp_ms=int(time.time() * 1000),
                    ),
                )
            except Exception:
                pass
            # keep as empty string to avoid crashing the turn
            final_text = final_text or ""
    return {
        "final_output": final_text or getattr(result, "final_output", None) or "",
        "new_items_len": len(getattr(result, "new_items", []) or []),
        "tool_calls": [
            getattr(i, "tool_name", None)
            for i in (getattr(result, "new_items", []) or [])
            if hasattr(i, "tool_name")
        ],
        "used_tools": [t.name for t in tools],
        "usage": usage,
        "used_fallback": used_fallback,
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
    # If Agents SDK isn't available, skip supervisor and use heuristic
    if not AGENTS_SDK_AVAILABLE:
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
        reason = "heuristic_router"
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
            if getattr(prov, "__class__", type("_", (), {})).__name__.lower() == "litellmmodel":  # type: ignore[attr-defined]
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
    # If Agents SDK session not available, synthesize transcript from event store
    if not AGENTS_SDK_AVAILABLE or not hasattr(session, "get_items"):
        events = store.list_events(session_id)
        items = [e.model_dump() for e in events]
        return {"session_id": session_id, "items": items, "length": len(items)}
    items = await session.get_items()
    return {"session_id": session_id, "items": items, "length": len(items)}
