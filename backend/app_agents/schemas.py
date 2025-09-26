from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

AgentRole = Literal["assistant", "supervisor", "specialist", "simulated_human"]


class ToolParam(BaseModel):
    name: str
    type: str = "string"
    description: Optional[str] = None
    required: bool = False


class ToolDefinition(BaseModel):
    name: str
    description: str
    params: List[ToolParam] = Field(default_factory=list)


class AgentDefinition(BaseModel):
    name: str
    model: str
    role: AgentRole = "assistant"
    instructions: str
    voice: Optional[str] = None
    temperature: Optional[float] = 0.8
    tools: List[str] = Field(default_factory=list)  # references ToolDefinition names
    handoff_targets: List[str] = Field(
        default_factory=list
    )  # other agent names it can handoff to
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ScenarioDefinition(BaseModel):
    id: str
    label: str
    default_root: str
    agents: List[AgentDefinition]
    description: Optional[str] = None


class SessionInitPayload(BaseModel):
    ephemeral_key: str
    initial_agents: List[Dict[str, Any]]  # serialized for Realtime SDK consumption
    guardrails: List[Dict[str, Any]] = Field(default_factory=list)
    scenario_id: str
    root_agent: str


# ---- Extensions for future phases ----
class ToolExecutionRequest(BaseModel):
    tool: str
    args: Dict[str, Any] = Field(default_factory=dict)
    correlation_id: Optional[str] = None


class ToolExecutionResult(BaseModel):
    tool: str
    success: bool
    output: Any = None
    error: Optional[str] = None
    correlation_id: Optional[str] = None


class ContextSnapshotRequest(BaseModel):
    page: Optional[str] = None
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class ContextSnapshot(BaseModel):
    id: str
    content_blocks: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ModerationRequest(BaseModel):
    text: str
    user_id: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)


class ModerationDecision(BaseModel):
    allowed: bool
    categories: Dict[str, Any] = Field(default_factory=dict)
    sanitized_text: Optional[str] = None


class OrchestrationRequest(BaseModel):
    scenario_id: str
    last_user_text: Optional[str] = None
    transcript_tail: List[Dict[str, Any]] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None


class OrchestrationDecision(BaseModel):
    chosen_root: str
    reason: str
    changed: bool
