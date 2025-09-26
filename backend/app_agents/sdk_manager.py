from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from agents import Agent, Runner, SQLiteSession, function_tool

# In-memory map of active sessions to SQLiteSession objects (file-backed optional later)
_session_cache: Dict[str, SQLiteSession] = {}


# Simple tool example (will auto-convert to FunctionTool)
@function_tool
def echo(value: str) -> str:
    """Echo the provided value (demo tool)."""
    return value


def get_or_create_session(session_id: str) -> SQLiteSession:
    session = _session_cache.get(session_id)
    if not session:
        # In-memory; switch to file path: SQLiteSession(session_id, "conversations.db") for persistence
        session = SQLiteSession(session_id)
        _session_cache[session_id] = session
    return session


async def create_agent_session(
    session_id: str, name: str, instructions: str, model: str = "gpt-4.1-mini"
) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    agent = Agent(
        name=name,
        instructions=instructions,
        model=model,
        tools=[echo],
    )
    # Optionally run a priming turn (not required)
    return {"session_id": session_id, "agent_name": agent.name, "model": model}


async def run_agent_turn(
    session_id: str, user_input: str, agent_spec: Dict[str, Any]
) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    # Reconstruct lightweight agent each call (cheap); could cache if instructions stable
    agent = Agent(
        name=agent_spec.get("name", "Assistant"),
        instructions=agent_spec.get("instructions", "You are a helpful assistant."),
        model=agent_spec.get("model", "gpt-4.1-mini"),
        tools=[echo],
    )
    result = await Runner.run(agent, user_input, session=session)
    return {
        "final_output": result.final_output,
        "new_items_len": len(result.new_items),
        "tool_calls": [
            getattr(i, "tool_name", None)
            for i in result.new_items
            if hasattr(i, "tool_name")
        ],
    }


async def get_session_transcript(session_id: str) -> Dict[str, Any]:
    session = get_or_create_session(session_id)
    items = await session.get_items()
    return {"session_id": session_id, "items": items, "length": len(items)}
