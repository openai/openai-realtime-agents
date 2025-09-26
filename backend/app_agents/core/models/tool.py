# moved from backend/core/models/tool.py to app_agents/core/models/tool.py
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ToolSpec(BaseModel):
    id: str
    name: str
    description: str
    input_schema: dict = Field(default_factory=dict)


class ToolCall(BaseModel):
    tool_id: str
    args: dict = Field(default_factory=dict)
    correlation_id: str


class ToolResultModel(BaseModel):
    tool_id: str
    correlation_id: str
    success: bool
    output: Any | None = None
    error: str | None = None
