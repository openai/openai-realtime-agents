import pytest
import time # For mocking time.perf_counter if needed, though TestClient handles latency.
from httpx import AsyncClient
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseCallNext
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

from backend.middleware import BasicMetricsMiddleware, metrics_store, get_metric_key
from backend.main import app as main_fastapi_app # Import the main app to test middleware with it

# A minimal FastAPI app for testing the middleware in isolation if needed,
# but using the main app is often better to ensure it works with full configuration.
# For this test, we'll use the main_fastapi_app.

@pytest.fixture(autouse=True)
def reset_metrics_store_before_each_test():
    """Ensures metrics_store is clean before each test."""
    global metrics_store # Ensure we are modifying the global metrics_store from middleware.py
    # Clear specific keys or reset to a known state.
    # For simplicity, we'll clear the common keys. A more robust reset might involve
    # re-initializing it to its exact initial state if it had one.
    keys_to_clear = list(metrics_store.keys()) # Avoid RuntimeError for changing dict size during iteration
    for key in keys_to_clear:
        if key not in ["total_requests", "total_errors"]: # Keep these and reset to 0
            del metrics_store[key]
    metrics_store["total_requests"] = 0
    metrics_store["total_errors"] = 0


@pytest.mark.asyncio
async def test_metrics_middleware_successful_request():
    # Use the main app to ensure middleware is applied as it would be in production.
    # The test_client_integration fixture from test_conversation_flow.py is session-scoped
    # and has DB setup. For middleware tests, we might not need the DB,
    # but using the main app instance is key.
    # We'll create a client directly from the main app instance.
    
    # The BasicMetricsMiddleware is already added to main_fastapi_app in main.py
    
    async with AsyncClient(app=main_fastapi_app, base_url="http://test") as client:
        # Make a request to an existing endpoint (e.g., the root path)
        # Note: This test assumes the root endpoint "/" exists on main_fastapi_app
        response = await client.get("/")
        assert response.status_code == 200 # Assuming root returns 200

    assert metrics_store["total_requests"] == 1
    assert metrics_store["total_errors"] == 0 # No errors for a 200 response
    
    # Check specific metric key
    # The path for root is typically "/"
    # Status code should be 200
    expected_key = get_metric_key(path="/", method="GET", status_code=200)
    assert metrics_store.get(expected_key) == 1

@pytest.mark.asyncio
async def test_metrics_middleware_error_request():
    # This test relies on an endpoint that predictably returns an error,
    # or on how middleware handles exceptions from deeper in the stack.
    # If no such endpoint exists, we might need to add a dummy one or test
    # the middleware more directly.
    
    # For now, let's test a non-existent endpoint, which should result in a 404.
    async with AsyncClient(app=main_fastapi_app, base_url="http://test") as client:
        response = await client.get("/non-existent-path-for-metrics")
        assert response.status_code == 404 # FastAPI default for not found

    assert metrics_store["total_requests"] == 1
    assert metrics_store["total_errors"] == 1 # 404 is an error
    
    expected_key_404 = get_metric_key(path="/non-existent-path-for-metrics", method="GET", status_code=404)
    assert metrics_store.get(expected_key_404) == 1

@pytest.mark.asyncio
async def test_metrics_middleware_multiple_requests():
    async with AsyncClient(app=main_fastapi_app, base_url="http://test") as client:
        await client.get("/") # Request 1 (200)
        await client.get("/") # Request 2 (200)
        await client.get("/another-path-metrics") # Request 3 (404)

    assert metrics_store["total_requests"] == 3
    assert metrics_store["total_errors"] == 1 # Only the 404
    
    key_root_200 = get_metric_key(path="/", method="GET", status_code=200)
    key_another_404 = get_metric_key(path="/another-path-metrics", method="GET", status_code=404)
    
    assert metrics_store.get(key_root_200) == 2
    assert metrics_store.get(key_another_404) == 1

@pytest.mark.asyncio
async def test_metrics_debug_endpoint_reflects_metrics():
    # Make some initial requests to populate metrics
    async with AsyncClient(app=main_fastapi_app, base_url="http://test") as client:
        await client.get("/") # Path: /, Method: GET, Status: 200
        await client.post("/ag-ui/events", headers={"X-Auth-Validation-Status": "success"}) # Path: /ag-ui/events, Method: POST, Status: 405 (assuming no POST handler for GET endpoint)
                                                                               # Actually, this endpoint is GET, so POST will be 405.
                                                                               # Let's use a GET request to a known endpoint.
                                                                               # The sse_endpoint is GET.
        # For SSE, the middleware will log when the initial response headers are sent.
        # The actual streaming content doesn't change that initial metric.
        # We need the auth header for this endpoint.
        await client.get("/ag-ui/events?user_message=test", headers={"X-Auth-Validation-Status": "success"}) # Path: /ag-ui/events, Method: GET, Status: 200
        
        # Get metrics from the debug endpoint
        response = await client.get("/metrics-debug")
        assert response.status_code == 200
        metrics_from_endpoint = response.json()

    assert metrics_from_endpoint["total_requests"] == metrics_store["total_requests"]
    assert metrics_from_endpoint["total_errors"] == metrics_store["total_errors"] 
    
    # Verify some specific counts are present in the detailed section
    # Key for root GET 200
    key_root_get_200 = get_metric_key(path="/", method="GET", status_code=200)
    assert metrics_from_endpoint["detailed_request_counts"].get(key_root_get_200) == metrics_store.get(key_root_get_200)

    # Key for /ag-ui/events GET 200
    key_agui_get_200 = get_metric_key(path="/ag-ui/events", method="GET", status_code=200)
    assert metrics_from_endpoint["detailed_request_counts"].get(key_agui_get_200) == metrics_store.get(key_agui_get_200)


# Test for logging (indirectly, by checking if the middleware's logger is called)
# This requires capturing log output, which can be done with caplog fixture or by patching.
@pytest.mark.asyncio
async def test_metrics_middleware_logs_request(caplog):
    caplog.set_level(logging.INFO) # Ensure INFO logs are captured
    
    # The logger used in BasicMetricsMiddleware is logging.getLogger(__name__) which resolves to "backend.middleware"
    # So, we need to ensure caplog can capture this or we specifically check that logger.
    
    # We can also patch the logger instance used by the middleware if it's hard to capture otherwise.
    # For now, let's assume caplog can get it if the middleware is part of the app.
    
    async with AsyncClient(app=main_fastapi_app, base_url="http://test") as client:
        await client.get("/logged-path-test") # Make a request to any path

    found_log = False
    for record in caplog.records:
        if record.name == "backend.middleware": # Check if the log came from the middleware's logger
            if record.levelname == "INFO" and "Request processed" in record.message:
                log_extra = record.metric_request_details if hasattr(record, 'metric_request_details') else record.msg_dict if hasattr(record, 'msg_dict') else {} # Check for extra
                # The JsonFormatter might put extras directly in record, or under a specific key if configured.
                # For python-json-logger, extras are usually merged into the main log dict.
                if record.pathname == "/logged-path-test" and record.method == "GET": # Assuming these fields are added by formatter or exist in record
                    found_log = True
                    assert record.status_code == 404 # As /logged-path-test doesn't exist
                    assert "latency_ms" in record.msg_dict # Check if latency is in the log extras (might be named differently by formatter)
                    break
    
    # A less fragile check for the log message content if exact fields are tricky with formatting:
    assert any("Request processed: GET /logged-path-test - Status: 404" in message for message in caplog.messages), \
        "Middleware log message not found or content mismatch."

```
