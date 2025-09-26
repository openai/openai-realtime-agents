# moved from backend/core/models/event.py to app_agents/core/models/event.py
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

EventType = Literal[
    "message",
    "handoff",
    "tool_call",
    "tool_result",
    "token",
    "final",
    "error",
]


class Event(BaseModel):
    session_id: str
    seq: int = Field(..., description="Monotonic session-scoped sequence number")
    type: EventType
    message_id: Optional[str] = Field(
        None,
        description="Client or server generated stable id for a logical message turn",
    )
    token_seq: Optional[int] = Field(
        None, description="Incrementing index for token events within a message"
    )
    role: Optional[str] = Field(None, description="user|assistant|system|tool")
    agent_id: Optional[str] = None
    text: Optional[str] = None
    final: Optional[bool] = None
    reason: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp_ms: int = Field(..., description="Server emission timestamp in ms")

    class Config:
        extra = "allow"
