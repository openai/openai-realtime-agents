from __future__ import annotations

import asyncio
import base64
import logging
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import sdk_manager
## Removed Responses fallback; SDK-only execution path.
from .core.models.event import Event
from .core.store.memory_store import store

router = APIRouter()
logger = logging.getLogger(__name__)


# ---- SDK: Session Create/Delete/Message ----
class SDKSessionCreateRequest(BaseModel):
    session_id: str | None = Field(
        None, description="Client provided session id (optional)"
    )
    agent_name: str = Field("assistant", description="Logical name for the agent")
    instructions: str = Field(
        ..., description="System / developer instructions for the agent"
    )
    model: str = Field("gpt-4.1-mini", description="Model to use for the agent")
    scenario_id: str | None = Field(None, description="Scenario to bind to")
    overlay: str | None = Field(None, description="Optional overlay/instructions tag")


@router.post("/sdk/session/create")
async def sdk_session_create(req: SDKSessionCreateRequest):
    sid = req.session_id or str(uuid4())
    store.create_session(
        sid, active_agent_id=req.agent_name, scenario_id=req.scenario_id
    )
    try:
        payload = await asyncio.wait_for(
            sdk_manager.create_agent_session(
                session_id=sid,
                name=req.agent_name,
                instructions=req.instructions,
                model=req.model,
                scenario_id=req.scenario_id,
                overlay=req.overlay,
            ),
            timeout=6.0,
        )
        return payload
    except asyncio.TimeoutError:
        try:
            seq = store.next_seq(sid)
            store.append_event(
                sid,
                Event(
                    session_id=sid,
                    seq=seq,
                    type="log",
                    role="system",
                    agent_id=req.agent_name,
                    text="create_timeout",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        return {
            "session_id": sid,
            "agent_name": req.agent_name,
            "model": req.model,
            "tools": [],
            "overlay": req.overlay,
        }
    except Exception as e:
        try:
            seq = store.next_seq(sid)
            store.append_event(
                sid,
                Event(
                    session_id=sid,
                    seq=seq,
                    type="log",
                    role="system",
                    agent_id=req.agent_name,
                    text=f"create_error: {e}",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        return {
            "session_id": sid,
            "agent_name": req.agent_name,
            "model": req.model,
            "tools": [],
            "overlay": req.overlay,
        }


class SDKSessionDeleteRequest(BaseModel):
    session_id: str


@router.post("/sdk/session/delete")
async def sdk_session_delete(req: SDKSessionDeleteRequest):
    try:
        store.delete_session(req.session_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"delete failed: {e}")


class SDKSessionMessageRequest(BaseModel):
    session_id: str
    user_input: str
    agent: dict | None = Field(
        None, description="Optional override of agent spec: name, instructions, model"
    )
    client_message_id: str | None = Field(
        None, description="Client idempotency key for this user message"
    )
    scenario_id: str | None = Field(
        None, description="Scenario binding for tools allowlist"
    )


@router.post("/sdk/session/message")
async def sdk_session_message(req: SDKSessionMessageRequest):
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="user_input cannot be empty")
    agent_spec = req.agent or {}
    try:
        logger.info(
            "/sdk/session/message start sid=%s len=%s",
            req.session_id,
            len(req.user_input),
        )
        if req.client_message_id:
            prior = store.get_by_client_message_id(
                req.session_id, req.client_message_id
            )
            if prior:
                return {
                    "final_output": prior.text,
                    "new_items_len": 0,
                    "tool_calls": [],
                    "events": [prior.model_dump()],
                }
        if not store.get_session(req.session_id):
            store.create_session(
                req.session_id, active_agent_id=agent_spec.get("name", "assistant")
            )

        now_ms = int(time.time() * 1000)
        user_seq = store.next_seq(req.session_id)
        user_event = Event(
            session_id=req.session_id,
            seq=user_seq,
            type="message",
            message_id=req.client_message_id,
            role="user",
            agent_id=None,
            text=req.user_input,
            final=True,
            timestamp_ms=now_ms,
        )
        store.append_event(req.session_id, user_event)

        try:
            seq0 = store.next_seq(req.session_id)
            store.append_event(
                req.session_id,
                Event(
                    session_id=req.session_id,
                    seq=seq0,
                    type="log",
                    role="system",
                    agent_id=agent_spec.get("name", "Assistant"),
                    text="turn_start",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass

        async def _sdk_path():
            return await sdk_manager.run_agent_turn(
                session_id=req.session_id,
                user_input=req.user_input,
                agent_spec=agent_spec,
                scenario_id=req.scenario_id,
            )

        try:
            result = await asyncio.wait_for(_sdk_path(), timeout=15.0)
        except asyncio.TimeoutError:
            try:
                seqt = store.next_seq(req.session_id)
                store.append_event(
                    req.session_id,
                    Event(
                        session_id=req.session_id,
                        seq=seqt,
                        type="log",
                        role="system",
                        agent_id=agent_spec.get("name", "Assistant"),
                        text="turn_timeout",
                        final=True,
                        timestamp_ms=int(time.time() * 1000),
                    ),
                )
            except Exception:
                pass
            result = {
                "final_output": "",
                "new_items_len": 0,
                "tool_calls": [],
                "used_tools": [],
                "usage": None,
                "used_fallback": False,
            }

        # No Responses fallback; if empty, we still append assistant event for visibility.

        if not (result.get("final_output") or "").strip():
            try:
                seqnt = store.next_seq(req.session_id)
                store.append_event(
                    req.session_id,
                    Event(
                        session_id=req.session_id,
                        seq=seqnt,
                        type="log",
                        role="system",
                        agent_id=agent_spec.get("name", "Assistant"),
                        text="assistant_no_text",
                        final=True,
                        timestamp_ms=int(time.time() * 1000),
                    ),
                )
            except Exception:
                pass

        message_id = req.client_message_id or str(uuid4())
        seq = store.next_seq(req.session_id)
        asst_event = Event(
            session_id=req.session_id,
            seq=seq,
            type="message",
            message_id=message_id,
            role="assistant",
            agent_id=agent_spec.get("name", "Assistant"),
            text=result.get("final_output") or "",
            final=True,
            timestamp_ms=int(time.time() * 1000),
        )
        store.append_event(req.session_id, asst_event)
        if req.client_message_id:
            store.remember_client_message(
                req.session_id, req.client_message_id, asst_event
            )

        try:
            seq1 = store.next_seq(req.session_id)
            store.append_event(
                req.session_id,
                Event(
                    session_id=req.session_id,
                    seq=seq1,
                    type="log",
                    role="system",
                    agent_id=agent_spec.get("name", "Assistant"),
                    text="turn_end",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        return {**result, "events": [user_event.model_dump(), asst_event.model_dump()]}
    except Exception as e:
        logger.exception("/sdk/session/message error: %s", e)
        try:
            seqe = store.next_seq(req.session_id)
            store.append_event(
                req.session_id,
                Event(
                    session_id=req.session_id,
                    seq=seqe,
                    type="log",
                    role="system",
                    agent_id=agent_spec.get("name", "Assistant"),
                    text=f"turn_error: {e}",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
            seq2 = store.next_seq(req.session_id)
            store.append_event(
                req.session_id,
                Event(
                    session_id=req.session_id,
                    seq=seq2,
                    type="message",
                    role="assistant",
                    agent_id=agent_spec.get("name", "Assistant"),
                    text="",
                    final=True,
                    message_id=req.client_message_id or str(uuid4()),
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        return {
            "final_output": "",
            "new_items_len": 0,
            "tool_calls": [],
            "used_tools": [],
            "usage": None,
            "used_fallback": False,
            "events": [],
        }


# ---- SDK: Set Active Agent ----
class SetActiveAgentRequest(BaseModel):
    session_id: str
    agent_name: str


@router.post("/sdk/session/set_active_agent")
async def set_active_agent(req: SetActiveAgentRequest):
    try:
        store.set_active_agent(req.session_id, req.agent_name)
        seq = store.next_seq(req.session_id)
        ev = Event(
            session_id=req.session_id,
            seq=seq,
            type="handoff",
            role="system",
            agent_id=req.agent_name,
            text=None,
            final=True,
            reason="manual_switch",
            timestamp_ms=int(time.time() * 1000),
        )
        store.append_event(req.session_id, ev)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"set_active_agent failed: {e}")


# ---- SDK: Transcript ----
@router.get("/sdk/session/transcript")
async def sdk_session_transcript(session_id: str):
    try:
        return await sdk_manager.get_session_transcript(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"transcript retrieval failed: {e}")


# ---- SDK: Usage ----
class UsageResponse(BaseModel):
    requests: int
    input_tokens: int
    output_tokens: int
    total_tokens: int


@router.get("/sdk/session/usage", response_model=UsageResponse)
async def get_session_usage(session_id: str = Query(...)):
    try:
        u = store.get_usage(session_id)
        return UsageResponse(**u)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"usage retrieval failed: {e}")


# ---- SDK: Events + SSE ----
@router.get("/sdk/session/{session_id}/events")
async def list_session_events(session_id: str, since: int | None = Query(None)):
    try:
        events = store.list_events(session_id, since_seq=since)
        return [e.model_dump() for e in events]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"events retrieval failed: {e}")


@router.get("/sdk/session/{session_id}/stream")
async def stream_sdk_session_events(session_id: str, since: int | None = Query(None)):
    async def event_gen():
        last = since or 0
        try:
            while True:
                evs = store.list_events(session_id, since_seq=last)
                if evs:
                    for ev in evs:
                        last = max(last, ev.seq)
                        yield f"data: {ev.model_dump()}\n\n"
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_gen(), media_type="text/event-stream")


# ---- SDK: Audio ingestion (placeholder) ----
class AudioChunkRequest(BaseModel):
    session_id: str
    seq: int
    pcm16_base64: str = Field(
        ..., description="Little-endian 16-bit PCM mono @16k base64 encoded"
    )
    sample_rate: int = 16000
    frame_samples: int | None = None


@router.post("/sdk/session/audio")
async def sdk_session_audio(req: AudioChunkRequest):
    try:
        raw = base64.b64decode(req.pcm16_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64")
    if len(raw) % 2 != 0:
        raise HTTPException(status_code=400, detail="PCM byte length not even")
    sample_count = len(raw) // 2
    return {
        "accepted": True,
        "session_id": req.session_id,
        "seq": req.seq,
        "samples": sample_count,
        "sample_rate": req.sample_rate,
        "ts": time.time(),
    }
