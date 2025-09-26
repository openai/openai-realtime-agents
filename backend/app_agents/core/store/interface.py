from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel

from ..models.event import Event
from ..models.session import Session


class SessionStore:
    """Abstract session store interface.

    Implementations must ensure per-session monotonic seq assignment
    and provide idempotency tracking for client_message_id.

    The store interface is the contract. To switch to Redis in the main project,
    instantiate RedisSessionStore(redis_client) and replace the import of store with
    that instance (one line). All routes (seq, events, idempotency, handoff updates)
    call the interface only, so no other code changes are needed.
    Key schema and ops are already documented in redis_store.py TODOs:
        session:{id} (hash): active_agent_id, scenario_id, created_ms, updated_ms
        session:{id}:seq (int via INCR)
        session:{id}:events (ZSET score=seq value=event JSON)
        session:{id}:idem (HASH client_message_id -> assistant event JSON)
    """

    def create_session(
        self, session_id: str, active_agent_id: str, scenario_id: Optional[str] = None
    ) -> Session:
        raise NotImplementedError

    def get_session(self, session_id: str) -> Optional[Session]:
        raise NotImplementedError

    def set_active_agent(self, session_id: str, agent_id: str) -> None:
        raise NotImplementedError

    def next_seq(self, session_id: str) -> int:
        raise NotImplementedError

    def append_event(self, session_id: str, event: Event) -> Event:
        raise NotImplementedError

    def list_events(
        self,
        session_id: str,
        since_seq: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[Event]:
        raise NotImplementedError

    def get_by_client_message_id(
        self, session_id: str, client_message_id: str
    ) -> Optional[Event]:
        raise NotImplementedError

    def remember_client_message(
        self, session_id: str, client_message_id: str, event: Event
    ) -> None:
        raise NotImplementedError

    def delete_session(self, session_id: str) -> None:
        raise NotImplementedError
