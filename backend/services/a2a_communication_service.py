import httpx
import logging 
import asyncio # For asyncio.sleep in retry logic if not using tenacity's async features
from typing import Dict, Optional
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type, RetryError, before_sleep_log

logger = logging.getLogger(__name__) 

# --- Mock Agent Card Discovery ---
MOCK_AGENT_CARDS = {
    "mock_translator_agent_001": {
        "agent_id": "mock_translator_agent_001",
        "name": "Mock Spanish Translator Agent",
        "description": "Translates text to Spanish. Expects input: {'text_to_translate': 'some string'}",
        "endpoint_url": "http://localhost:8001/a2a/receive_task" 
    },
    "mock_summarizer_agent_002": {
        "agent_id": "mock_summarizer_agent_002",
        "name": "Mock Text Summarizer Agent",
        "description": "Summarizes provided text. Expects input: {'text_to_summarize': 'long text...'}",
        "endpoint_url": "http://localhost:8001/a2a/receive_task"
    },
    "mock_retry_agent_503": { # For testing retries on 503
        "agent_id": "mock_retry_agent_503",
        "name": "Mock Retry Agent 503",
        "description": "Simulates an agent that initially returns 503 errors.",
        "endpoint_url": "http://localhost:8001/a2a/receive_task_retry_503" # Needs mock server endpoint
    }
}

# Define which HTTP status codes should trigger a retry
RETRYABLE_STATUS_CODES = {502, 503, 504} # Common gateway/transient errors

def _is_retryable_exception(e: BaseException) -> bool:
    """Determines if an exception is retryable for A2A calls."""
    if isinstance(e, httpx.TimeoutException):
        logger.debug(f"Retryable A2A exception: TimeoutException ({e})")
        return True
    if isinstance(e, httpx.NetworkError): # Covers ConnectError, ReadTimeout etc.
        logger.debug(f"Retryable A2A exception: NetworkError ({e})")
        return True
    if isinstance(e, httpx.HTTPStatusError):
        is_retryable = e.response.status_code in RETRYABLE_STATUS_CODES
        logger.debug(f"A2A HTTPStatusError: Status {e.response.status_code}. Retryable: {is_retryable}.")
        return is_retryable
    return False

class A2ACommunicationService:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=10.0) # Default timeout for A2A calls
        HTTPXClientInstrumentor.instrument_client(self.http_client)
        self.agent_cards = MOCK_AGENT_CARDS
        logger.info("A2ACommunicationService initialized and HTTPXClientInstrumentor applied.", 
                    extra={"num_agent_cards": len(self.agent_cards)})

    def get_agent_details(self, agent_id: str) -> Optional[Dict]:
        details = self.agent_cards.get(agent_id)
        log_extras = {"agent_id": agent_id, "details_found": bool(details)}
        if details:
            logger.debug(f"Agent details found for agent_id: {agent_id}", extra=log_extras)
        else:
            logger.warning(f"Agent details not found for agent_id: {agent_id}", extra=log_extras)
        return details

    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_fixed(1), # Wait 1 second between retries
        retry=retry_if_exception(_is_retryable_exception), # Use custom predicate
        before_sleep=before_sleep_log(logger, logging.INFO) # Log before sleeping for retry
    )
    async def send_task_to_agent(self, request: A2ATaskRequest) -> A2ATaskResponse:
        log_extras = {
            "request_id": request.request_id, "target_agent_id": request.target_agent_id,
            "task_name": request.task_name
        }
        # Note: Tenacity's before_sleep_log will log the attempt number.
        # We can add more context if needed by accessing retry_state in a custom before_sleep.
        logger.info(f"Sending A2A task '{request.task_name}' to agent '{request.target_agent_id}'.", extra=log_extras)
        
        target_agent_details = self.get_agent_details(request.target_agent_id)
        if not target_agent_details:
            logger.error(f"Agent ID '{request.target_agent_id}' not found. Cannot send task.", extra=log_extras)
            # This is a configuration error, not a network error, so no retry needed here.
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_CONFIGURATION", error_message=f"Target agent '{request.target_agent_id}' not found.")

        target_endpoint_url = target_agent_details.get("endpoint_url")
        if not target_endpoint_url:
            logger.error(f"Endpoint URL not configured for agent ID '{request.target_agent_id}'.", extra=log_extras)
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_CONFIGURATION", error_message=f"Endpoint URL for '{request.target_agent_id}' not configured.")

        logger.debug(f"Posting A2A task to endpoint: {target_endpoint_url}", extra={**log_extras, "endpoint_url": target_endpoint_url})
        
        try:
            response = await self.http_client.post(target_endpoint_url, json=request.dict())
            
            # If the status code indicates a server-side issue that might be temporary,
            # raise an exception so tenacity can retry it.
            if response.status_code in RETRYABLE_STATUS_CODES:
                logger.warning(f"A2A call to {request.target_agent_id} returned retryable status: {response.status_code}. Content: {response.text[:200]}", 
                               extra={**log_extras, "status_code": response.status_code, "response_preview": response.text[:200]})
                response.raise_for_status() # This will raise HTTPStatusError, caught by tenacity if retryable
            
            # For other non-success codes that are not automatically retried by _is_retryable_exception
            # (e.g., 4xx client errors from the target agent), raise_for_status() will handle them.
            response.raise_for_status() 
            
            response_data = response.json()
            a2a_response = A2ATaskResponse(**response_data)
            logger.info(f"A2A response received for task ID {request.request_id}: Status {a2a_response.status}", extra={**log_extras, "response_status": a2a_response.status})
            return a2a_response

        except RetryError as e: # Specifically catch tenacity's RetryError
            logger.error(f"A2A task to '{request.target_agent_id}' failed after {e.attempt_number} attempts for request_id {request.request_id}.", extra=log_extras, exc_info=True)
            last_exception = e.last_attempt.exception
            error_msg_detail = f"Failed after {e.attempt_number} attempts. Last error: {type(last_exception).__name__}"
            status_code = "ERROR_MAX_RETRIES"
            if isinstance(last_exception, httpx.HTTPStatusError):
                error_msg_detail = f"Failed after {e.attempt_number} attempts. Last HTTP error {last_exception.response.status_code}: {last_exception.response.text[:200]}"
            elif isinstance(last_exception, httpx.RequestError):
                 error_msg_detail = f"Failed after {e.attempt_number} attempts. Last network/timeout error: {type(last_exception).__name__}"
            return A2ATaskResponse(request_id=request.request_id, status=status_code, error_message=error_msg_detail)
        
        # Catching specific httpx exceptions after RetryError, or if tenacity doesn't catch them first
        except httpx.HTTPStatusError as e: 
            logger.error(f"A2A HTTPStatusError (final attempt or non-retryable): {e.response.status_code} for {request.target_agent_id}.", extra={**log_extras, "status_code": e.response.status_code, "error_details": e.response.text[:200]}, exc_info=True)
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_HTTP", error_message=f"HTTP error {e.response.status_code}: {e.response.text[:200]}")
        except httpx.TimeoutException as e:
            logger.error(f"A2A TimeoutException (final attempt or non-retryable) for {request.target_agent_id}: {type(e).__name__}", extra={**log_extras, "error_type": type(e).__name__}, exc_info=True)
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_TIMEOUT", error_message=f"Timeout reaching agent '{request.target_agent_id}': {type(e).__name__}")
        except httpx.NetworkError as e:
            logger.error(f"A2A NetworkError (final attempt or non-retryable) for {request.target_agent_id}: {type(e).__name__}", extra={**log_extras, "error_type": type(e).__name__}, exc_info=True)
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_NETWORK", error_message=f"Network error reaching agent '{request.target_agent_id}': {type(e).__name__}")
        except Exception as e: 
            logger.error(f"A2A Exception (unexpected) for {request.target_agent_id}: {type(e).__name__}", extra={**log_extras, "error_type": type(e).__name__}, exc_info=True)
            return A2ATaskResponse(request_id=request.request_id, status="ERROR_UNEXPECTED", error_message=f"Unexpected error in A2A: {str(e)}")

    async def close_http_client(self):
        await self.http_client.aclose()
        logger.info("A2ACommunicationService HTTP client closed.")

a2a_communication_service = A2ACommunicationService()
```
