import asyncio
import uuid
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from starlette.responses import StreamingResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.models.ag_ui_messages import AGUIMessage
from backend.services.orchestration_service import orchestration_service, OrchestrationService
from backend.database import get_db
from backend.security import get_supabase_user, SupabaseUser
from backend.services.audit_logging_service import log_audit_event # Import audit logging utility

logger = logging.getLogger(__name__)
router = APIRouter()

async def event_stream_generator(
    request: Request, 
    db: Session, 
    orch_service: OrchestrationService, 
    user_message_param: str,
    session_id: str, 
    user_details: SupabaseUser 
):
    log_session_id = user_details.id 
    logger.info(f"Starting event stream for user_id: {log_session_id}", 
                extra={"user_id": log_session_id, "user_message": user_message_param})
    events_sent_count = 0
    try:
        events: List[AGUIMessage] = await orch_service.handle_user_message(db, user_message_param, session_id, user_details)
        for event_count, event in enumerate(events):
            events_sent_count = event_count + 1
            if await request.is_disconnected():
                logger.warning(f"Client disconnected during event stream for user_id: {log_session_id}. Sent {events_sent_count} events.", 
                               extra={"user_id": log_session_id, "events_sent": events_sent_count})
                # Audit log for client disconnect
                log_audit_event(
                    db=db, user=user_details, action="SSE_STREAM_DISCONNECTED", status="FAILURE",
                    resource_type="endpoint", resource_id=request.url.path,
                    details={"message": f"Client disconnected after {events_sent_count} events.", "user_message": user_message_param}
                )
                break
            yield f"data: {event.json()}\n\n"
            await asyncio.sleep(0.01)
        
        if not await request.is_disconnected():
            logger.info(f"Event stream completed for user_id: {log_session_id}. Sent {events_sent_count} events.", 
                        extra={"user_id": log_session_id, "events_sent": events_sent_count})
            # Audit log for successful stream completion
            log_audit_event(
                db=db, user=user_details, action="SSE_STREAM_COMPLETED", status="SUCCESS",
                resource_type="endpoint", resource_id=request.url.path,
                details={"events_sent": events_sent_count, "user_message": user_message_param}
            )

    except HTTPException as http_exc: # Catch FastAPI HTTPExceptions to log them before they are returned
        logger.error(f"HTTPException during event stream for user_id {log_session_id}: {http_exc.status_code} - {http_exc.detail}", 
                     exc_info=True, extra={"user_id": log_session_id, "status_code": http_exc.status_code})
        log_audit_event(
            db=db, user=user_details, action="SSE_STREAM_ERROR", status="FAILURE",
            resource_type="endpoint", resource_id=request.url.path,
            details={"error": f"HTTPException: {http_exc.status_code} - {http_exc.detail}", "user_message": user_message_param}
        )
        # Re-raise to let FastAPI handle the response
        raise
    except Exception as e:
        logger.error(f"Unexpected error during event stream generation for user_id {log_session_id}: {e}", 
                     exc_info=True, extra={"user_id": log_session_id})
        log_audit_event(
            db=db, user=user_details, action="SSE_STREAM_ERROR", status="FAILURE",
            resource_type="endpoint", resource_id=request.url.path,
            details={"error": f"Unexpected: {type(e).__name__} - {str(e)}", "user_message": user_message_param}
        )
        try:
            error_event = AGUIMessage(event_type="ERROR", message="An internal error occurred while streaming events. Please try again.")
            yield f"data: {error_event.json()}\n\n"
        except Exception as final_e:
            logger.critical(f"Failed to send error event to client for user_id {log_session_id}: {final_e}", 
                            exc_info=True, extra={"user_id": log_session_id})


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
