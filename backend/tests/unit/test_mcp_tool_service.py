import pytest
import httpx # For mocking HTTP calls
from unittest.mock import patch, AsyncMock # AsyncMock for async methods
from backend.services.mcp_tool_service import MCPToolService, MCPToolRegistry
from backend.models.tool_definition import MCPToolDefinition
from backend.models.mcp_messages import MCPToolCallRequest, MCPToolCallResponse

# Import definitions of tools to be tested (these are registered in _register_initial_tools)
from backend.tools.mock_weather_tool import get_weather as mock_weather_function
from backend.tools.calculator_tool import calculate as calculator_function, CALCULATOR_TOOL_DEFINITION
from backend.tools.notes_tool import add_note as add_note_function, get_note as get_note_function, ADD_NOTE_TOOL_DEFINITION, GET_NOTE_TOOL_DEFINITION

# Fixture for a fresh MCPToolRegistry instance for each test
@pytest.fixture
def tool_registry():
    return MCPToolRegistry()

# Fixture for MCPToolService with an injected (and fresh) registry
@pytest.fixture
def mcp_service(tool_registry):
    # The MCPToolService's __init__ calls _register_initial_tools,
    # which now registers weather, calculator, and notes tools.
    return MCPToolService(tool_registry=tool_registry)

# --- Tests for MCPToolRegistry ---
def test_registry_register_tool(tool_registry: MCPToolRegistry):
    tool_def = MCPToolDefinition(tool_name="test_tool", description="A test tool", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="test.module:test_func")
    tool_registry.register_tool(tool_def)
    assert tool_registry.get_tool("test_tool") == tool_def

def test_registry_get_non_existent_tool(tool_registry: MCPToolRegistry):
    assert tool_registry.get_tool("non_existent_tool") is None

def test_registry_list_tools(tool_registry: MCPToolRegistry):
    tool_def1 = MCPToolDefinition(tool_name="test_tool1", description="1", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f1")
    tool_def2 = MCPToolDefinition(tool_name="test_tool2", description="2", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f2")
    tool_registry.register_tool(tool_def1)
    tool_registry.register_tool(tool_def2)
    listed_tools = tool_registry.list_tools()
    assert len(listed_tools) == 2
    assert tool_def1 in listed_tools
    assert tool_def2 in listed_tools

def test_registry_reregister_tool_warning(tool_registry: MCPToolRegistry, caplog):
    tool_def = MCPToolDefinition(tool_name="test_tool", description="Original", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f_orig")
    tool_registry.register_tool(tool_def)
    tool_def_new = MCPToolDefinition(tool_name="test_tool", description="New", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f_new")
    tool_registry.register_tool(tool_def_new)
    assert "Warning: Tool 'test_tool' is being re-registered." in caplog.text
    assert tool_registry.get_tool("test_tool").description == "New"


# --- Tests for MCPToolService ---
@pytest.mark.asyncio
async def test_invoke_python_tool_weather(mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    # Weather tool is registered by MCPToolService's _register_initial_tools
    weather_def = tool_registry.get_tool("get_weather_tool")
    assert weather_def is not None
    
    request = MCPToolCallRequest(tool_name="get_weather_tool", inputs={"location": "London", "unit": "celsius"})
    response = await mcp_service.invoke_tool(request)
    
    assert response.status == "SUCCESS"
    assert response.output["location"] == "London"
    assert response.output["temperature"] == "25" 
    assert response.output["unit"] == "celsius"

@pytest.mark.asyncio
async def test_invoke_python_tool_calculator(mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    assert tool_registry.get_tool("calculator_tool") is not None
    request = MCPToolCallRequest(tool_name="calculator_tool", inputs={"expression": "(2 + 3) * 4"})
    response = await mcp_service.invoke_tool(request)
    assert response.status == "SUCCESS"
    assert response.output["result"] == 20.0

@pytest.mark.asyncio
async def test_invoke_python_tool_add_note_and_get_note(mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    assert tool_registry.get_tool("add_note_tool") is not None
    assert tool_registry.get_tool("get_note_tool") is not None
    
    # Clear notes_storage before this specific test sequence for predictability
    from backend.tools import notes_tool
    notes_tool.notes_storage.clear()

    add_request = MCPToolCallRequest(tool_name="add_note_tool", inputs={"content": "Test note for MCP", "title": "MCPTitle"})
    add_response = await mcp_service.invoke_tool(add_request)
    
    assert add_response.status == "SUCCESS"
    assert "note_id" in add_response.output
    note_id = add_response.output["note_id"]
    
    get_request = MCPToolCallRequest(tool_name="get_note_tool", inputs={"note_id": note_id})
    get_response = await mcp_service.invoke_tool(get_request)
    
    assert get_response.status == "SUCCESS"
    assert get_response.output["content"] == "Test note for MCP"
    assert get_response.output["title"] == "MCPTitle"

@pytest.mark.asyncio
async def test_invoke_tool_not_found(mcp_service: MCPToolService):
    request = MCPToolCallRequest(tool_name="non_existent_tool", inputs={})
    response = await mcp_service.invoke_tool(request)
    assert response.status == "ERROR_NOT_FOUND"
    assert "not found in registry" in response.output["error"]

@pytest.mark.asyncio
async def test_invoke_tool_python_handler_import_error(mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    bad_def = MCPToolDefinition(tool_name="bad_import_tool", description="test", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="non_existent_module:non_existent_func")
    tool_registry.register_tool(bad_def)
    
    request = MCPToolCallRequest(tool_name="bad_import_tool", inputs={})
    response = await mcp_service.invoke_tool(request)
    assert response.status == "ERROR_CONFIGURATION"
    assert "Tool function configuration error" in response.output["error"]

@pytest.mark.asyncio
async def test_invoke_tool_python_handler_attribute_error(mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    bad_def = MCPToolDefinition(tool_name="bad_attr_tool", description="test", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="backend.tools.mock_weather_tool:non_existent_func")
    tool_registry.register_tool(bad_def)
    
    request = MCPToolCallRequest(tool_name="bad_attr_tool", inputs={})
    response = await mcp_service.invoke_tool(request)
    assert response.status == "ERROR_CONFIGURATION"
    assert "Tool function not found in module" in response.output["error"]

@pytest.mark.asyncio
async def test_invoke_tool_python_handler_execution_error_calculator(mcp_service: MCPToolService):
    # Calculator tool's calculate() function itself handles errors and returns them in 'output'
    request = MCPToolCallRequest(tool_name="calculator_tool", inputs={"expression": "1/0"})
    response = await mcp_service.invoke_tool(request)
    assert response.status == "SUCCESS" # The tool executed successfully by returning an error structure
    assert "error" in response.output
    assert response.output["error"] == "Calculation result is undefined (e.g., division by zero)."

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_invoke_http_tool_success(mock_post: AsyncMock, mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    http_tool_def = MCPToolDefinition(
        tool_name="http_test_tool", description="HTTP test", input_schema={}, output_schema={}, 
        handler_type="http_endpoint", handler_identifier="http://example.com/api/test"
    )
    tool_registry.register_tool(http_tool_def)
    
    mock_response_data = {"result": "http_success"}
    mock_post.return_value = httpx.Response(200, json=mock_response_data)
    
    request = MCPToolCallRequest(tool_name="http_test_tool", inputs={"data": "payload"})
    response = await mcp_service.invoke_tool(request)
    
    mock_post.assert_called_once_with(http_tool_def.handler_identifier, json=request.inputs)
    assert response.status == "SUCCESS"
    assert response.output == mock_response_data

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_invoke_http_tool_http_error(mock_post: AsyncMock, mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    http_tool_def = MCPToolDefinition(tool_name="http_error_tool", description="HTTP error test", input_schema={}, output_schema={}, handler_type="http_endpoint", handler_identifier="http://example.com/api/httperror")
    tool_registry.register_tool(http_tool_def)
    
    # Simulate an HTTPStatusError by setting up the mock response that httpx.raise_for_status() would process
    mock_post.return_value = httpx.Response(500, text="Internal Server Error")
    # If you want to directly test the exception path where raise_for_status() is called:
    # mock_post.side_effect = httpx.HTTPStatusError("Server Error", request=httpx.Request("POST", "http://example.com/api/httperror"), response=httpx.Response(500, text="Internal Server Error"))

    request = MCPToolCallRequest(tool_name="http_error_tool", inputs={})
    response = await mcp_service.invoke_tool(request)
    
    assert response.status == "ERROR_HTTP"
    assert "HTTP tool error: 500" in response.output["error"]
    assert "Internal Server Error" in response.output["details"]

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post', new_callable=AsyncMock)
async def test_invoke_http_tool_network_error(mock_post: AsyncMock, mcp_service: MCPToolService, tool_registry: MCPToolRegistry):
    http_tool_def = MCPToolDefinition(tool_name="http_network_error_tool", description="HTTP network error test", input_schema={}, output_schema={}, handler_type="http_endpoint", handler_identifier="http://nonexistent.example.com/api")
    tool_registry.register_tool(http_tool_def)
    
    mock_post.side_effect = httpx.RequestError("Network error occurred", request=httpx.Request("POST", "http://nonexistent.example.com/api"))

    request = MCPToolCallRequest(tool_name="http_network_error_tool", inputs={})
    response = await mcp_service.invoke_tool(request)
    
    assert response.status == "ERROR_NETWORK"
    assert "HTTP request failed: Could not connect" in response.output["error"]

@pytest.fixture(scope="session", autouse=True)
async def close_global_mcp_http_client_after_tests():
    # This fixture ensures that the HTTP client associated with the globally instantiated
    # `mcp_tool_service` (from mcp_tool_service.py) is closed after all tests in the session.
    # Tests within this file primarily use the `mcp_service` fixture, which creates
    # a fresh service (and client) per test. However, if other tests elsewhere import
    # and use the global `mcp_tool_service` directly, its client needs cleanup.
    yield
    from backend.services.mcp_tool_service import mcp_tool_service as global_service_instance
    await global_service_instance.close_http_client()
```
