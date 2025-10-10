# TODO: prune / remove as no longer using the separate Responses API
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
logger = logging.getLogger(__name__)


class AgentRunnerError(Exception):
    pass


async def run_single_turn(
    model: str,
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """Placeholder server-side 'agent run' using Responses API.

    Args:
        model: OpenAI model id
        messages: chat style messages [{role, content}]
        tools: optional tool descriptors (not yet executed automatically here)
    Returns response JSON from /responses.
    """
    if not OPENAI_API_KEY:
        raise AgentRunnerError("Missing OPENAI_API_KEY")

    url = f"{OPENAI_BASE_URL}/responses"
    # Prefer simple `input` for plain text turns to maximize consistent text returns.
    simple_text = None
    if (
        isinstance(messages, list)
        and len(messages) == 1
        and isinstance(messages[0], dict)
        and messages[0].get("role") == "user"
        and isinstance(messages[0].get("content"), str)
    ):
        simple_text = messages[0]["content"]
    payload: Dict[str, Any] = {
        "model": model,
        "parallel_tool_calls": True,
    }
    if simple_text is not None:
        payload["input"] = simple_text
    else:
        payload["messages"] = messages
    if tools:
        payload["tools"] = tools

    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise AgentRunnerError(
            f"HTTP {e.response.status_code}: {e.response.text}"
        ) from e
    data = res.json()

    # Normalize to include a flat output_text for downstream code
    text = None
    try:
        # Preferred if SDK already provided
        text = data.get("output_text")
        if not text:
            out = data.get("output") or []
            # output is a list of items; messages carry content[] with output_text/text
            parts: List[str] = []
            for item in out if isinstance(out, list) else []:
                content = item.get("content") if isinstance(item, dict) else None
                if isinstance(content, list):
                    for c in content:
                        if not isinstance(c, dict):
                            continue
                        if c.get("type") in (
                            "output_text",
                            "text",
                            "input_text",
                        ) and c.get("text"):
                            parts.append(str(c.get("text")))
            if parts:
                text = "\n".join(parts).strip()
        if not text and isinstance(data, dict):
            # Last-resort common fields
            for k in ("final_output", "content", "message", "text"):
                v = data.get(k)
                if isinstance(v, str) and v.strip():
                    text = v.strip()
                    break
    except Exception:  # keep robust
        text = None

    if text:
        data["output_text"] = text
    # Best-effort pass-through usage
    if "usage" not in data and isinstance(data, dict):
        u = None
        if isinstance(data.get("response"), dict):
            u = data["response"].get("usage")
        if u is not None:
            data["usage"] = u
    logger.debug("/responses normalized text_len=%s", len(text) if text else 0)
    return data
