from __future__ import annotations

from typing import Optional

from .schemas import AgentDefinition, ScenarioDefinition


class Orchestrator:
    """Simple placeholder orchestrator – later add intent classification, scoring, etc."""

    def select_root(
        self, scenario: ScenarioDefinition, context: dict
    ) -> AgentDefinition:
        # For now return scenario.default_root
        for a in scenario.agents:
            if a.name == scenario.default_root:
                return a
        return scenario.agents[0]


orchestrator = Orchestrator()
