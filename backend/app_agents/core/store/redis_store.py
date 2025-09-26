from __future__ import annotations

"""
Redis-backed SessionStore (placeholder).

Drop-in replacement for InMemorySessionStore. Implement using aioredis or redis-py.
Contract:
- Maintain per-session monotonic seq (use INCR key session:{id}:seq)
- Store events in a list or sorted set (e.g., ZADD with seq as score)
- Persist sessions as hashes (session:{id})
- Idempotency map per session (HSET session:{id}:idem {client_message_id} event_json)
"""

from typing import List, Optional

from ..models.event import Event
from ..models.session import Session
from .interface import SessionStore


class RedisSessionStore(SessionStore):
    def __init__(self, redis_client) -> None:
        self.r = redis_client

    def create_session(
        self, session_id: str, active_agent_id: str, scenario_id: Optional[str] = None
    ) -> Session:
        # TODO: implement HSET session metadata; return Session model
        raise NotImplementedError

    def get_session(self, session_id: str) -> Optional[Session]:
        # TODO: HGETALL session and parse
        raise NotImplementedError

    def set_active_agent(self, session_id: str, agent_id: str) -> None:
        # TODO: HSET active_agent_id
        raise NotImplementedError

    def next_seq(self, session_id: str) -> int:
        # TODO: INCR session:{id}:seq
        raise NotImplementedError

    def append_event(self, session_id: str, event: Event) -> Event:
        # TODO: ZADD session:{id}:events with score=seq, value=event.json()
        raise NotImplementedError

    def list_events(
        self,
        session_id: str,
        since_seq: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[Event]:
        # TODO: ZRANGEBYSCORE with (since_seq, +inf]
        raise NotImplementedError

    def get_by_client_message_id(
        self, session_id: str, client_message_id: str
    ) -> Optional[Event]:
        # TODO: HGET session:{id}:idem {client_message_id}
        raise NotImplementedError

    def remember_client_message(
        self, session_id: str, client_message_id: str, event: Event
    ) -> None:
        # TODO: HSET session:{id}:idem {client_message_id} event.json()
        raise NotImplementedError
