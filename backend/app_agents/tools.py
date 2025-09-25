from __future__ import annotations
from typing import Any, Dict

# Placeholder tool registry. In future, implement real functions (DB lookups, etc.).

tool_registry: Dict[str, Any] = {}


def _echo_context(**kwargs):
    """Simple tool: returns the kwargs for debugging / grounding."""
    return {"echo": kwargs}


# Register initial tools
tool_registry["echo_context"] = _echo_context

async def execute_tool(name: str, **kwargs) -> Any:
    if name not in tool_registry:
        raise ValueError(f"Unknown tool: {name}")
    func = tool_registry[name]
    if callable(func):
        result = func(**kwargs)
        if hasattr(result, "__await__"):
            return await result  # async
        return result
    return func
