import asyncio
import uuid
import logging # Import logging
from fastapi import APIRouter, Depends, Request
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.models.ag_ui_messages import AGUIMessage
from backend.services.orchestration_service import orchestration_service, OrchestrationService
from backend.database import get_db
from backend.security import verify_forwarded_auth_status

logger = logging.getLogger(__name__) # Get a logger for this module
router = APIRouter()

async def event_stream_generator(
    request: Request, 
    db: Session, 
    orch_service: OrchestrationService, 
    user_message_param: str,
    session_id: str
):
    logger.info(f"Starting event stream for session_id: {session_id}", extra={"session_id": session_id, "user_message": user_message_param})
    try:
        events: List[AGUIMessage] = await orch_service.handle_user_message(db, user_message_param, session_id)
        for event_count, event in enumerate(events):
            if await request.is_disconnected():
                logger.warning(f"Client disconnected during event stream for session_id: {session_id}. Sent {event_count} events.", 
                               extra={"session_id": session_id, "events_sent": event_count, "user_message": user_message_param})
                break
            yield f"data: {event.json()}\n\n"
            await asyncio.sleep(0.01) # Minimal sleep to allow message to be sent, can be adjusted
        logger.info(f"Event stream completed for session_id: {session_id}. Sent {len(events)} events.", 
                    extra={"session_id": session_id, "events_sent": len(events), "user_message": user_message_param})
    except Exception as e:
        logger.error(f"Error during event stream generation for session_id {session_id}: {e}", 
                     exc_info=True, extra={"session_id": session_id, "user_message": user_message_param})
        # Yield an error message to the client if possible, though the stream might be broken
        try:
            error_event = AGUIMessage(event_type="ERROR", message="An internal error occurred while streaming events.")
            yield f"data: {error_event.json()}\n\n"
        except Exception as final_e: # Catch error during error message sending
            logger.critical(f"Failed to send error event to client for session_id {session_id}: {final_e}", 
                            exc_info=True, extra={"session_id": session_id})


@router.get("/ag-ui/events")
async def sse_endpoint(
    request: Request,
    user_message: Optional[str] = None, 
    db: Session = Depends(get_db),
    orch_service: OrchestrationService = Depends(lambda: orchestration_service),
    # Updated security dependency:
    auth_status: str = Depends(get_forwarded_auth_status) 
):
    effective_user_message = user_message if user_message is not None else "What is the weather like in London?"
    
    session_id_header = request.headers.get("X-Session-ID")
    if session_id_header:
        session_id = session_id_header
    else:
        session_id = str(uuid.uuid4())

    # The `auth_status` variable now holds "success" if authentication passed.
    # You can use it here if needed, though its main purpose is to protect the route.
    # For example: print(f"Auth status: {auth_status}")

    return StreamingResponse(
        event_stream_generator(request, db, orch_service, effective_user_message, session_id), 
        media_type="text/event-stream",
        headers={"X-Session-ID": session_id} 
    )
