import pytest
import httpx
from unittest.mock import AsyncMock, patch
from backend.services.a2a_communication_service import A2ACommunicationService, MOCK_AGENT_CARDS
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse

@pytest.fixture
def a2a_service():
    """Provides an instance of A2ACommunicationService with a fresh HTTP client mock for each test if needed."""
    # For unit tests, we often want to mock the external HTTP calls.
    # The service initializes its own client, so we might patch it globally or per method call.
    # For this fixture, we'll return a fresh service instance. Tests can then patch httpx.AsyncClient.
    return A2ACommunicationService()

@pytest.mark.asyncio
async def test_get_agent_details_found(a2a_service: A2ACommunicationService):
    agent_id = "mock_translator_agent_001"
    details = a2a_service.get_agent_details(agent_id)
    assert details is not None
    assert details["agent_id"] == agent_id
    assert details == MOCK_AGENT_CARDS[agent_id]

@pytest.mark.asyncio
async def test_get_agent_details_not_found(a2a_service: A2ACommunicationService):
    details = a2a_service.get_agent_details("non_existent_agent")
    assert details is None

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_send_task_to_agent_success(mock_post: AsyncMock, a2a_service: A2ACommunicationService):
    target_agent_id = "mock_translator_agent_001"
    task_name = "translate_text"
    inputs = {"text": "hello"}
    request_id = "test-req-123"
    
    task_request = A2ATaskRequest(
        request_id=request_id,
        target_agent_id=target_agent_id,
        task_name=task_name,
        inputs=inputs
    )
    
    # Mock the response from the target agent's server
    mock_api_response_data = {
        "request_id": request_id,
        "status": "SUCCESS",
        "outputs": {"translated_text": "hola"}
    }
    # The mock_post should return an object that behaves like httpx.Response
    mock_post.return_value = httpx.Response(200, json=mock_api_response_data)
    
    response = await a2a_service.send_task_to_agent(task_request)
    
    # Assert that httpx.AsyncClient.post was called correctly
    expected_endpoint = MOCK_AGENT_CARDS[target_agent_id]["endpoint_url"]
    mock_post.assert_called_once_with(expected_endpoint, json=task_request.dict())
    
    # Assert the response from send_task_to_agent
    assert isinstance(response, A2ATaskResponse)
    assert response.request_id == request_id
    assert response.status == "SUCCESS"
    assert response.outputs == {"translated_text": "hola"}
    assert response.error_message is None

@pytest.mark.asyncio
async def test_send_task_to_agent_target_not_found(a2a_service: A2ACommunicationService):
    task_request = A2ATaskRequest(target_agent_id="unknown_agent", task_name="do_stuff", inputs={})
    response = await a2a_service.send_task_to_agent(task_request)
    
    assert response.status == "ERROR"
    assert "Target agent 'unknown_agent' not found" in response.error_message

@pytest.mark.asyncio
async def test_send_task_to_agent_no_endpoint_url(a2a_service: A2ACommunicationService):
    # Temporarily modify MOCK_AGENT_CARDS for this test or add a new card
    original_card = MOCK_AGENT_CARDS.get("mock_summarizer_agent_002")
    try:
        MOCK_AGENT_CARDS["agent_no_endpoint"] = {
            "agent_id": "agent_no_endpoint", "name": "No Endpoint Agent" 
            # Missing "endpoint_url"
        }
        a2a_service.agent_cards = MOCK_AGENT_CARDS # Ensure service uses the modified cards
        
        task_request = A2ATaskRequest(target_agent_id="agent_no_endpoint", task_name="summarize", inputs={})
        response = await a2a_service.send_task_to_agent(task_request)
        
        assert response.status == "ERROR"
        assert "Endpoint URL for target agent 'agent_no_endpoint' is not configured" in response.error_message
    finally:
        # Clean up: remove the temporary agent card and restore original if it existed
        if "agent_no_endpoint" in MOCK_AGENT_CARDS:
            del MOCK_AGENT_CARDS["agent_no_endpoint"]
        if original_card: # Restore if it was there
             MOCK_AGENT_CARDS["mock_summarizer_agent_002"] = original_card
        a2a_service.agent_cards = MOCK_AGENT_CARDS # Reset to original state


@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_send_task_to_agent_http_status_error(mock_post: AsyncMock, a2a_service: A2ACommunicationService):
    target_agent_id = "mock_translator_agent_001"
    task_request = A2ATaskRequest(target_agent_id=target_agent_id, task_name="translate", inputs={"text": "test"})
    
    # Simulate an HTTPStatusError from the client.post call
    mock_post.side_effect = httpx.HTTPStatusError(
        message="Simulated HTTP 500 error", 
        request=httpx.Request("POST", MOCK_AGENT_CARDS[target_agent_id]["endpoint_url"]),
        response=httpx.Response(500, text="Internal Server Error on Target Agent")
    )
    
    response = await a2a_service.send_task_to_agent(task_request)
    
    assert response.status == "ERROR_HTTP"
    assert "HTTP error 500 from target agent" in response.error_message
    assert "Internal Server Error on Target Agent" in response.error_message

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_send_task_to_agent_request_error(mock_post: AsyncMock, a2a_service: A2ACommunicationService):
    target_agent_id = "mock_translator_agent_001"
    task_request = A2ATaskRequest(target_agent_id=target_agent_id, task_name="translate", inputs={"text": "test"})

    # Simulate a generic RequestError (e.g., network issue)
    mock_post.side_effect = httpx.RequestError(
        message="Simulated network error",
        request=httpx.Request("POST", MOCK_AGENT_CARDS[target_agent_id]["endpoint_url"])
    )
    
    response = await a2a_service.send_task_to_agent(task_request)
    
    assert response.status == "ERROR_NETWORK"
    assert "Network error while trying to reach agent" in response.error_message
    assert "Simulated network error" in response.error_message # From the original exception

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_send_task_to_agent_unexpected_error(mock_post: AsyncMock, a2a_service: A2ACommunicationService):
    target_agent_id = "mock_translator_agent_001"
    task_request = A2ATaskRequest(target_agent_id=target_agent_id, task_name="translate", inputs={"text": "test"})

    # Simulate an unexpected error during response processing (e.g., non-JSON response from target)
    mock_post.return_value = httpx.Response(200, text="This is not JSON") # Target returns non-JSON
    
    response = await a2a_service.send_task_to_agent(task_request)
    
    assert response.status == "ERROR_UNEXPECTED"
    assert "An unexpected error occurred during A2A communication" in response.error_message
    # The specific error message might include details about JSON decoding failure

# Fixture to close the service's HTTP client after all tests in this module if it were shared.
# Since each test using a2a_service gets a new instance, this is more for the global instance.
@pytest.fixture(scope="module", autouse=True)
async def close_global_a2a_http_client():
    yield
    from backend.services.a2a_communication_service import a2a_communication_service as global_a2a_service
    await global_a2a_service.close_http_client()

```
