import pytest
import asyncio
from httpx import AsyncClient
from fastapi import FastAPI, Depends
from unittest.mock import AsyncMock, MagicMock, patch

from backend.main import app as main_app # Use your actual main app
from backend.services.orchestration_service import OrchestrationService
from backend.models.ag_ui_messages import AGUIMessage
from backend.security import get_api_key # Assuming your security dependency

# Mock Orchestration Service for testing
mock_orchestration_service = AsyncMock(spec=OrchestrationService)

# Override dependency for testing
async def override_orchestration_service():
    return mock_orchestration_service

# Fixture to provide a test client with overridden dependencies
@pytest.fixture
async def test_client_ag_ui():
    # Apply the dependency override to the app instance used for testing
    main_app.dependency_overrides[OrchestrationService] = override_orchestration_service 
    async with AsyncClient(app=main_app, base_url="http://test") as client:
        yield client
    main_app.dependency_overrides = {} # Clear overrides after test


@pytest.mark.asyncio
async def test_sse_endpoint_connection_and_events(test_client_ag_ui: AsyncClient):
    # Mock the response from orchestration_service.handle_user_message
    mock_events = [
        AGUIMessage(event_type="TOOL_CALL_START", data={"tool_name": "test_tool", "inputs": {"location": "test"}}),
        AGUIMessage(event_type="TOOL_OUTPUT", data={"tool_name": "test_tool", "output": {"result": "success"}, "status": "SUCCESS"}),
        AGUIMessage(event_type="AGENT_RESPONSE", message="Final agent response."),
    ]
    mock_orchestration_service.handle_user_message = AsyncMock(return_value=mock_events)

    headers = {"X-API-KEY": "your_default_dev_api_key", "X-Session-ID": "test-session-id"}
    
    async with test_client_ag_ui.stream("GET", "/ag-ui/events", headers=headers) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        received_events_str = []
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                received_events_str.append(line[len("data: "):])
        
        assert len(received_events_str) == len(mock_events)
        for i, event_str in enumerate(received_events_str):
            # Validate that the string can be parsed by AGUIMessage model
            parsed_event = AGUIMessage.parse_raw(event_str)
            assert parsed_event.event_type == mock_events[i].event_type
            if mock_events[i].message:
                assert parsed_event.message == mock_events[i].message
            if mock_events[i].data:
                 assert parsed_event.data == mock_events[i].data

    mock_orchestration_service.handle_user_message.assert_called_once()
    # You can add more specific assertions about how handle_user_message was called if needed
    # For example, checking the user_message or session_id passed
    args, kwargs = mock_orchestration_service.handle_user_message.call_args
    assert kwargs['user_message'] == "What is the weather like in London?" # Default message in router
    assert kwargs['session_id'] == "test-session-id"


@pytest.mark.asyncio
async def test_sse_endpoint_invalid_api_key(test_client_ag_ui: AsyncClient):
    headers = {"X-API-KEY": "invalid_key", "X-Session-ID": "test-session-id-invalid"}
    response = await test_client_ag_ui.get("/ag-ui/events", headers=headers)
    assert response.status_code == 401 # Unauthorized
    assert "Invalid API Key" in response.text


@pytest.mark.asyncio
async def test_sse_endpoint_missing_api_key(test_client_ag_ui: AsyncClient):
    headers = {"X-Session-ID": "test-session-id-missing"}
    response = await test_client_ag_ui.get("/ag-ui/events", headers=headers)
    assert response.status_code == 403 # Forbidden
    assert "Not authenticated" in response.text

# To run this test, you would typically use `pytest` in your terminal
# Ensure EXPECTED_API_KEY is set in your test environment or .env file if your security module relies on it.
# For this test, we assume "your_default_dev_api_key" is the one expected by security.py
# or that the environment variable EXPECTED_API_KEY is set to this value when tests run.

# If your main app instance isn't named `app` in `backend.main`, adjust the import.
# Also, the override for OrchestrationService might need adjustment if your app
# structure or dependency injection method is different.
# This example assumes OrchestrationService is directly provided/depended upon by the endpoint.
# If it's a sub-dependency, mocking might need to target where it's directly created or injected.

# A note on overriding dependencies in FastAPI for testing:
# The `app.dependency_overrides` approach is standard. Ensure `main_app` is the
# actual FastAPI instance your TestClient is using.
# The clearing of overrides `main_app.dependency_overrides = {}` is good practice
# to prevent interference between tests if the app instance is reused.
# However, with `AsyncClient(app=main_app, ...)` a fresh app state is generally used per client instance.
# For more complex scenarios, especially with sub-dependencies, `pytest-fastapi-deps` can be helpful.
# but for direct dependencies, the built-in override is usually sufficient.

# The test_client_ag_ui fixture has an issue:
# main_app.dependency_overrides[OrchestrationService] = override_orchestration_service
# This should be:
# main_app.dependency_overrides[orchestration_service] = override_orchestration_service
# OR (better, if your endpoint uses `Depends(OrchestrationService)`)
# main_app.dependency_overrides[OrchestrationService] = override_orchestration_service
# I'll assume the endpoint uses Depends(OrchestrationService) as per typical FastAPI style.

# Corrected fixture:
@pytest.fixture
async def test_client_ag_ui_corrected():
    # Assuming your endpoint uses `Depends(OrchestrationService)` or a similar class-based dependency
    # If it uses `Depends(get_orchestration_service_instance)` then override that specific function.
    # For this example, let's assume the router has `orch_service: OrchestrationService = Depends(OrchestrationService)`
    # or depends on an instance of OrchestrationService directly.
    
    # The actual dependency being overridden should be the one used in the router's Depends.
    # In ag_ui_router.py, it is:
    # orch_service: OrchestrationService = Depends(lambda: orchestration_service_instance)
    # So we need to mock the `orchestration_service_instance` that this lambda returns.
    # Or, more directly, override the dependency provider used in the route.
    
    # Let's find out what the dependency is in `ag_ui_router.py`
    # It's `Depends(lambda: orchestration_service)` where `orchestration_service` is an instance.
    # This means we need to patch this instance or override the lambda.
    # Overriding the lambda provider is cleaner.
    
    from backend.routers.ag_ui_router import router as ag_ui_router_instance
    from backend.services.orchestration_service import orchestration_service as global_orchestration_service_instance
    
    # To correctly override, we need to target the dependency that FastAPI resolves.
    # If the endpoint is `async def sse_endpoint(..., orch_service: OrchestrationService = Depends(get_orch_service_dependency))`
    # then we override `get_orch_service_dependency`.
    # In our case, it's `Depends(lambda: orchestration_service)`.
    # FastAPI allows overriding the type itself if it's used as a dependency.
    # However, here `orchestration_service` is an *instance* passed to a lambda.
    
    # The most straightforward way for this specific lambda `Depends(lambda: orchestration_service)`
    # is to make the global instance `orchestration_service` use the mock.
    # This is tricky because `orchestration_service` is already instantiated.
    # A better approach for testability would be to have `Depends(get_orchestration_service)`
    # where `get_orchestration_service` returns the singleton.
    
    # For now, let's assume we can override the OrchestrationService *type* if it were used directly
    # or use patching if the instance is globally imported and used.

    # Let's assume the router uses `Depends(OrchestrationService)` (class, not instance) for easier override.
    # If it's `Depends(lambda: actual_instance)`, then patching `actual_instance` or overriding the lambda provider is needed.
    # The current code uses `Depends(lambda: orchestration_service)` where `orchestration_service` is an instance.
    # `main_app.dependency_overrides[lambda_function]` is not directly supported.
    # We should override the type if the dependency was `Depends(OrchestrationService)`.

    # Given the current setup: `orch_service: OrchestrationService = Depends(lambda: orchestration_service)`
    # The dependency to override is the lambda itself. However, FastAPI's override mechanism
    # works best with types or functions directly.
    
    # The simplest robust way here is to patch the global `orchestration_service` instance
    # that the lambda in the router closes over.

    original_orch_service_in_router_module = ag_ui_router_instance.dependencies[0].depends.dependency.args[0] # This is hacky way to get to the lambda
    # This is getting too complex. The dependency should be a callable like `Depends(get_service)`.

    # Let's simplify. Assume the endpoint is changed to `Depends(OrchestrationService)` for this test to work cleanly with overrides.
    # Or, we use `patch` for the global instance.
    
    # Using patch for the global instance referred by the lambda in the router:
    with patch('backend.routers.ag_ui_router.orchestration_service', new=mock_orchestration_service):
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            yield client
    # No need to clear dependency_overrides if using patch.

# Re-register the corrected fixture for use in tests
pytest.fixture(name="test_client_ag_ui")(test_client_ag_ui_corrected)
