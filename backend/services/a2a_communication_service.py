import httpx
import logging # Import logging
from typing import Dict, Optional
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse

logger = logging.getLogger(__name__) # Get a logger for this module

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
    }
}

class A2ACommunicationService:
    """
    Service responsible for facilitating communication between agents (A2A).
    """
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.agent_cards = MOCK_AGENT_CARDS
        logger.info("A2ACommunicationService initialized.", extra={"num_agent_cards": len(self.agent_cards)})

    def get_agent_details(self, agent_id: str) -> Optional[Dict]:
        """
        Retrieves the 'Agent Card' details for a given agent ID.
        """
        details = self.agent_cards.get(agent_id)
        if details:
            logger.debug(f"Agent details found for agent_id: {agent_id}", extra={"agent_id": agent_id, "details_found": True})
        else:
            logger.warning(f"Agent details not found for agent_id: {agent_id}", extra={"agent_id": agent_id, "details_found": False})
        return details

    async def send_task_to_agent(self, request: A2ATaskRequest) -> A2ATaskResponse:
        """
        Sends a task request to another agent and returns its response.
        """
        log_extras = {
            "request_id": request.request_id,
            "target_agent_id": request.target_agent_id,
            "task_name": request.task_name
        }
        logger.info(f"Attempting to send A2A task '{request.task_name}' to agent '{request.target_agent_id}'.", extra=log_extras)
        
        target_agent_details = self.get_agent_details(request.target_agent_id)

        if not target_agent_details:
            logger.error(f"A2A Error: Agent ID '{request.target_agent_id}' not found in known agent cards.", extra=log_extras)
            return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR",
                error_message=f"Target agent '{request.target_agent_id}' not found or not reachable."
            )

        target_endpoint_url = target_agent_details.get("endpoint_url")
        if not target_endpoint_url:
            logger.error(f"A2A Error: Endpoint URL not configured for agent ID '{request.target_agent_id}'.", extra=log_extras)
            return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR",
                error_message=f"Endpoint URL for target agent '{request.target_agent_id}' is not configured."
            )

        logger.debug(f"Sending A2A task to endpoint: {target_endpoint_url}", extra={**log_extras, "endpoint_url": target_endpoint_url})
        
        try:
            response = await self.http_client.post(target_endpoint_url, json=request.dict())
            response.raise_for_status() 
            
            response_data = response.json()
            a2a_response = A2ATaskResponse(**response_data)
            logger.info(f"A2A response received for task ID {request.request_id}: Status {a2a_response.status}", extra={**log_extras, "response_status": a2a_response.status})
            return a2a_response

        except httpx.HTTPStatusError as e:
            error_details = e.response.text
            try: 
                error_json = e.response.json()
                error_details = error_json.get("detail", error_details) if isinstance(error_json, dict) else error_details
            except Exception:
                pass 
            
            logger.error(f"A2A HTTPStatusError: Failed to send task to {request.target_agent_id}. Status: {e.response.status_code}.", 
                         extra={**log_extras, "status_code": e.response.status_code, "error_details": error_details}, exc_info=True)
            return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR_HTTP", 
                error_message=f"HTTP error {e.response.status_code} from target agent: {error_details}"
            )
        except httpx.RequestError as e: 
            logger.error(f"A2A RequestError: Failed to send task to {request.target_agent_id}. Error: {type(e).__name__}", 
                         extra={**log_extras, "error_type": type(e).__name__}, exc_info=True)
            return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR_NETWORK", 
                error_message=f"Network error while trying to reach agent '{request.target_agent_id}': {type(e).__name__}"
            )
        except Exception as e: 
            logger.error(f"A2A Exception: An unexpected error occurred. Error: {type(e).__name__}", 
                         extra={**log_extras, "error_type": type(e).__name__}, exc_info=True)
            return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR_UNEXPECTED",
                error_message=f"An unexpected error occurred during A2A communication: {str(e)}"
            )

    async def close_http_client(self):
        await self.http_client.aclose()
        logger.info("A2ACommunicationService HTTP client closed.")

a2a_communication_service = A2ACommunicationService()

if __name__ == '__main__':
    # This requires logging_config.setup_logging() to be called to see JSON logs.
    # For direct execution, you might add:
    # import sys
    # sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # Add backend to path
    # from logging_config import setup_logging
    # setup_logging()
    # import asyncio

    async def run_a2a_test():
        logger.info("--- Testing A2ACommunicationService ---")
        
        logger.info("\nTest 1: Send task to mock_translator_agent_001")
        translate_request = A2ATaskRequest(
            target_agent_id="mock_translator_agent_001",
            task_name="translate_to_spanish",
            inputs={"text_to_translate": "Hello, agent world!"}
        )
        translate_response = await a2a_communication_service.send_task_to_agent(translate_request)
        logger.info(f"Response from translator: {translate_response.json(indent=2) if translate_response else 'No response'}")
        if translate_response and translate_response.status == "SUCCESS":
            assert translate_response.outputs.get("translated_text") == "Hello, agent world! en Español"

        logger.info("\nTest 2: Send task to non_existent_agent")
        non_existent_request = A2ATaskRequest(
            target_agent_id="non_existent_agent_123",
            task_name="do_something",
            inputs={"data": "test"}
        )
        non_existent_response = await a2a_communication_service.send_task_to_agent(non_existent_request)
        logger.info(f"Response from non-existent agent: {non_existent_response.json(indent=2)}")
        assert non_existent_response.status == "ERROR"
        assert "not found" in non_existent_response.error_message
        
        logger.info("\nTest 4: Send task designed to cause an error on mock server (e.g. 'cause_error')")
        error_task_request = A2ATaskRequest(
            target_agent_id="mock_translator_agent_001", 
            task_name="cause_error_if_you_can",
            inputs={"detail": "Simulate processing failure."}
        )
        error_task_response = await a2a_communication_service.send_task_to_agent(error_task_request)
        logger.info(f"Response for error task: {error_task_response.json(indent=2) if error_task_response else 'No response'}")
        
        await a2a_communication_service.close_http_client()

    # print("NOTE: The __main__ block for A2ACommunicationService is commented out...")
    # To run: import asyncio; asyncio.run(run_a2a_test()) after setting up logging.
