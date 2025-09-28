from __future__ import annotations

from typing import Dict, List

from .schemas import AgentDefinition, ScenarioDefinition

# Minimal starter scenarios mirroring current FE placeholders.

_default_agents: List[AgentDefinition] = [
    AgentDefinition(
        name="supervisor",
        role="supervisor",
        model="gpt-4.1-mini",
        instructions=(
            "You are a routing supervisor. Read the user's last message and choose the best specialist."
            " Prefer Sales for product discovery and recommendations; Support for troubleshooting; General otherwise."
        ),
        voice=None,
        tools=[],
        handoff_targets=["general", "sales", "support"],
    ),
    AgentDefinition(
        name="general",
        model="gpt-4o-realtime-preview-2025-06-03",
        instructions="General purpose assistant.",
        voice="alloy",
        tools=["echo_context", "weather", "WebSearchTool"],
        handoff_targets=["sales", "support"],
    ),
    AgentDefinition(
        name="sales",
        model="gpt-4.1-mini",
        instructions=(
            "You are a sales assistant. Ask concise clarifying questions; recommend items from the catalog using product_search."
        ),
        voice=None,
        tools=["product_search"],
        handoff_targets=["support", "general"],
    ),
    AgentDefinition(
        name="support",
        model="gpt-4.1-mini",
        instructions=(
            "You are a support assistant. Diagnose issues methodically; request minimal repro info; keep steps numbered."
        ),
        voice=None,
        tools=["echo_context"],
        handoff_targets=["sales", "general"],
    ),
]

scenarios: Dict[str, ScenarioDefinition] = {
    "default": ScenarioDefinition(
        id="default",
        label="Default",
        default_root="general",
        agents=_default_agents,
        description="Supervisor + General/Sales/Support agents",
    )
}


def list_scenarios():
    return [s for s in scenarios.values()]


def get_scenario(sid: str) -> ScenarioDefinition | None:
    return scenarios.get(sid)
