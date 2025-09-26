# moved from backend/core/models/session.py to app_agents/core/models/session.py
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Session(BaseModel):
    session_id: str
    active_agent_id: str
    scenario_id: Optional[str] = None
    created_ms: int
    updated_ms: int


class HandoffState(BaseModel):
    previous_agent_id: str
    new_agent_id: str
    reason: str
    seq: int
