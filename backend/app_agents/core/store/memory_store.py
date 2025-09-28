from __future__ import annotations

import time
from threading import Lock
from typing import Dict, List, Optional

from ..models.event import Event
from ..models.session import Session
from .interface import SessionStore


class InMemorySessionStore(SessionStore):
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._events: Dict[str, List[Event]] = {}
        self._seq: Dict[str, int] = {}
        self._idempotency: Dict[str, Dict[str, Event]] = {}
        self._lock = Lock()
        # Aggregated usage per session
        self._usage = {}

    def create_session(
        self, session_id: str, active_agent_id: str, scenario_id: Optional[str] = None
    ) -> Session:
        now = int(time.time() * 1000)
        with self._lock:
            sess = self._sessions.get(session_id)
            if not sess:
                sess = Session(
                    session_id=session_id,
                    active_agent_id=active_agent_id,
                    scenario_id=scenario_id,
                    created_ms=now,
                    updated_ms=now,
                )
                self._sessions[session_id] = sess
                self._events[session_id] = []
                self._seq[session_id] = 0
                self._idempotency[session_id] = {}
                self._usage[session_id] = {
                    "requests": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                }
            return sess

    def get_session(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    def set_active_agent(self, session_id: str, agent_id: str) -> None:
        with self._lock:
            sess = self._sessions.get(session_id)
            if not sess:
                raise KeyError("session not found")
            sess.active_agent_id = agent_id
            sess.updated_ms = int(time.time() * 1000)

    def next_seq(self, session_id: str) -> int:
        with self._lock:
            cur = self._seq.get(session_id, 0) + 1
            self._seq[session_id] = cur
            return cur

    def append_event(self, session_id: str, event: Event) -> Event:
        with self._lock:
            if session_id not in self._events:
                self._events[session_id] = []
            self._events[session_id].append(event)
            # keep updated timestamp
            if session_id in self._sessions:
                self._sessions[session_id].updated_ms = int(time.time() * 1000)
            return event

    def list_events(
        self,
        session_id: str,
        since_seq: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[Event]:
        items = self._events.get(session_id, [])
        if since_seq is not None:
            items = [e for e in items if e.seq > since_seq]
        if limit is not None:
            items = items[:limit]
        return items

    def get_by_client_message_id(
        self, session_id: str, client_message_id: str
    ) -> Optional[Event]:
        return self._idempotency.get(session_id, {}).get(client_message_id)

    def remember_client_message(
        self, session_id: str, client_message_id: str, event: Event
    ) -> None:
        if session_id not in self._idempotency:
            self._idempotency[session_id] = {}
        self._idempotency[session_id][client_message_id] = event

    def delete_session(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)
            self._events.pop(session_id, None)
            self._seq.pop(session_id, None)
            self._idempotency.pop(session_id, None)
            self._usage.pop(session_id, None)

    # ---- Usage aggregation helpers ----
    def add_usage(
        self, session_id: str, usage: Dict[str, int | None]
    ) -> Dict[str, int]:
        """Accumulate usage counters for a session and return the new totals."""
        with self._lock:
            if session_id not in self._usage:
                self._usage[session_id] = {
                    "requests": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                }
            u = self._usage[session_id]
            # Defensive conversions and defaults
            req = int(usage.get("requests") or 1)
            in_tok = int(usage.get("input_tokens") or 0)
            out_tok = int(usage.get("output_tokens") or 0)
            total = int(usage.get("total_tokens") or (in_tok + out_tok))
            u["requests"] += req
            u["input_tokens"] += in_tok
            u["output_tokens"] += out_tok
            u["total_tokens"] += total
            return dict(u)

    def get_usage(self, session_id: str) -> Dict[str, int]:
        with self._lock:
            return dict(
                self._usage.get(
                    session_id,
                    {
                        "requests": 0,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "total_tokens": 0,
                    },
                )
            )

    def reset_usage(self, session_id: str) -> None:
        with self._lock:
            self._usage[session_id] = {
                "requests": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }


# singleton for app use
store = InMemorySessionStore()
