from __future__ import annotations

import asyncio
import json
import logging
import time
from uuid import uuid4

from fastapi import (APIRouter, HTTPException, Query, WebSocket,
                     WebSocketDisconnect)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .agent_runner import run_single_turn
from .core.models.event import Event
from .core.store.memory_store import store

router = APIRouter()
logger = logging.getLogger(__name__)


async def _simulate_token_stream(
    session_id: str,
    agent_id: str,
    message_id: str,
    final_text: str,
    delay_ms: int = 120,
    chunk_size: int = 18,
):
    try:
        text = final_text or ""
        token_idx = 0
        for i in range(0, len(text), chunk_size):
            part = text[i : i + chunk_size]
            token_idx += 1
            seqt = store.next_seq(session_id)
            store.append_event(
                session_id,
                Event(
                    session_id=session_id,
                    seq=seqt,
                    type="token",
                    role="assistant",
                    agent_id=agent_id,
                    text=part,
                    final=False,
                    message_id=message_id,
                    token_seq=token_idx,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
            await asyncio.sleep(max(0.01, delay_ms / 1000))
        seq = store.next_seq(session_id)
        store.append_event(
            session_id,
            Event(
                session_id=session_id,
                seq=seq,
                type="message",
                message_id=message_id,
                role="assistant",
                agent_id=agent_id,
                text=final_text or "",
                final=True,
                timestamp_ms=int(time.time() * 1000),
            ),
        )
    except Exception:
        pass


class LLMSessionCreateRequest(BaseModel):
    session_id: str | None = Field(
        None, description="Client-provided session id (optional)"
    )
    model: str | None = Field(None, description="Default model (optional)")


@router.post("/llm/session/create")
async def llm_session_create(req: LLMSessionCreateRequest):
    sid = req.session_id or str(uuid4())
    try:
        store.create_session(sid, active_agent_id="llm")
        return {"session_id": sid, "model": req.model or "gpt-4.1-mini"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"llm create failed: {e}")


class LLMSessionMessageRequest(BaseModel):
    session_id: str
    user_input: str
    client_message_id: str | None = Field(None, description="Idempotency key")
    model: str | None = Field(None, description="Model override")
    system: str | None = Field(None, description="System/instructions override")


@router.post("/llm/session/message")
async def llm_session_message(req: LLMSessionMessageRequest):
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="user_input cannot be empty")
    try:
        if req.client_message_id:
            prior = store.get_by_client_message_id(
                req.session_id, req.client_message_id
            )
            if prior:
                return {
                    "final_output": prior.text or "",
                    "events": [prior.model_dump()],
                    "usage": store.get_usage(req.session_id),
                }
        if not store.get_session(req.session_id):
            store.create_session(req.session_id, active_agent_id="llm")

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
                    agent_id="llm",
                    text="turn_start",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass

        async def _responses_call():
            messages = []
            if req.system:
                messages.append({"role": "system", "content": req.system})
            messages.append({"role": "user", "content": req.user_input})
            resp = await run_single_turn((req.model or "gpt-4.1-mini"), messages, None)
            text = (
                resp.get("output_text")
                or resp.get("final_output")
                or resp.get("content")
                or ""
            )
            usage = resp.get("usage")
            if usage:
                try:
                    totals = store.add_usage(req.session_id, usage)
                    usage = {**usage, "aggregated": totals}
                except Exception:
                    pass
            return text, usage

        try:
            final_text, usage = await asyncio.wait_for(_responses_call(), timeout=15.0)
        except asyncio.TimeoutError:
            final_text, usage = "", None
            try:
                seqt = store.next_seq(req.session_id)
                store.append_event(
                    req.session_id,
                    Event(
                        session_id=req.session_id,
                        seq=seqt,
                        type="log",
                        role="system",
                        agent_id="llm",
                        text="turn_timeout",
                        final=True,
                        timestamp_ms=int(time.time() * 1000),
                    ),
                )
            except Exception:
                pass
        except Exception as e:
            final_text, usage = "", None
            try:
                seqe = store.next_seq(req.session_id)
                store.append_event(
                    req.session_id,
                    Event(
                        session_id=req.session_id,
                        seq=seqe,
                        type="log",
                        role="system",
                        agent_id="llm",
                        text=f"responses_error: {e}",
                        final=True,
                        timestamp_ms=int(time.time() * 1000),
                    ),
                )
            except Exception:
                pass

        message_id = req.client_message_id or str(uuid4())
        asyncio.create_task(
            _simulate_token_stream(req.session_id, "llm", message_id, final_text or "")
        )

        if req.client_message_id and final_text is not None:
            try:
                seqph = store.next_seq(req.session_id)
                placeholder = Event(
                    session_id=req.session_id,
                    seq=seqph,
                    type="message",
                    message_id=message_id,
                    role="assistant",
                    agent_id="llm",
                    text="",
                    final=False,
                    timestamp_ms=int(time.time() * 1000),
                )
                store.remember_client_message(
                    req.session_id, req.client_message_id, placeholder
                )
            except Exception:
                pass
        try:
            seq1 = store.next_seq(req.session_id)
            store.append_event(
                req.session_id,
                Event(
                    session_id=req.session_id,
                    seq=seq1,
                    type="log",
                    role="system",
                    agent_id="llm",
                    text="turn_end",
                    final=True,
                    timestamp_ms=int(time.time() * 1000),
                ),
            )
        except Exception:
            pass
        return {
            "final_output": final_text or "",
            "usage": usage,
            "events": [user_event.model_dump()],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"llm message failed: {e}")


@router.get("/llm/session/{session_id}/events")
async def llm_list_session_events(session_id: str, since: int | None = Query(None)):
    try:
        events = store.list_events(session_id, since_seq=since)
        return [e.model_dump() for e in events]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"llm events retrieval failed: {e}")


@router.get("/llm/session/usage")
async def get_llm_session_usage(session_id: str = Query(...)):
    try:
        u = store.get_usage(session_id)
        return {
            "requests": u["requests"],
            "input_tokens": u["input_tokens"],
            "output_tokens": u["output_tokens"],
            "total_tokens": u["total_tokens"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"llm usage retrieval failed: {e}")


@router.websocket("/llm/session/ws")
async def llm_session_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    last_seq = 0
    try:
        resume_msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.2)
        try:
            data = json.loads(resume_msg)
            if isinstance(data, dict) and data.get("type") == "resume":
                last_seq = int(data.get("since") or 0)
        except Exception:
            pass
    except Exception:
        pass
    try:
        while True:
            evs = store.list_events(session_id, since_seq=last_seq)
            if evs:
                for ev in evs:
                    last_seq = max(last_seq, ev.seq)
                    await websocket.send_text(json.dumps(ev.model_dump()))
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.get("/llm/session/{session_id}/stream")
async def stream_llm_session_events(session_id: str, since: int | None = Query(None)):
    async def event_gen():
        last = since or 0
        try:
            while True:
                evs = store.list_events(session_id, since_seq=last)
                if evs:
                    for ev in evs:
                        last = max(last, ev.seq)
                        yield f"data: {json.dumps(ev.model_dump())}\n\n"
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_gen(), media_type="text/event-stream")
