from __future__ import annotations

from typing import Dict, List

from .schemas import AgentDefinition, ScenarioDefinition

# Minimal starter scenarios mirroring current FE placeholders.

_default_agents: List[AgentDefinition] = [
    AgentDefinition(
        name="general",
        model="gpt-4o-realtime-preview-2025-06-03",
        instructions="General purpose assistant.",
        voice="alloy",
        tools=["echo_context"],
        handoff_targets=[],
    )
]

scenarios: Dict[str, ScenarioDefinition] = {
    "default": ScenarioDefinition(
        id="default",
        label="Default",
        default_root="general",
        agents=_default_agents,
        description="Single general agent",
    )
}


def list_scenarios():
    return [s for s in scenarios.values()]


def get_scenario(sid: str) -> ScenarioDefinition | None:
    return scenarios.get(sid)
