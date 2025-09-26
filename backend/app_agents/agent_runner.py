from __future__ import annotations

import os
from typing import Any, Dict, List

import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")


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
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "parallel_tool_calls": True,
    }
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

    return res.json()
