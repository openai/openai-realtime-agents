import pytest
import httpx 
import os
from unittest.mock import patch, AsyncMock, MagicMock 
from sqlalchemy.orm import Session # For mocking DB session for audit calls

from backend.services.mcp_tool_service import MCPToolService, MCPToolRegistry
from backend.models.tool_definition import MCPToolDefinition
from backend.models.mcp_messages import MCPToolCallRequest, MCPToolCallResponse
from backend.security import SupabaseUser 
from backend.services import audit_logging_service # To mock log_audit_event

# Import definitions of tools to be tested
from backend.tools.mock_weather_tool import get_weather as mock_weather_function
from backend.tools.calculator_tool import CALCULATOR_TOOL_DEFINITION
from backend.tools.notes_tool import ADD_NOTE_TOOL_DEFINITION, GET_NOTE_TOOL_DEFINITION
from backend.tools.admin_debug_tool import ADMIN_DEBUG_TOOL_DEFINITION


@pytest.fixture
def mock_db_session_for_mcp(): # Renamed to be specific
    return MagicMock(spec=Session)

@pytest.fixture
def tool_registry():
    return MCPToolRegistry()

@pytest.fixture
def mcp_service(tool_registry: MCPToolRegistry): # tool_registry is already a fixture
    # Patch the audit logging globally for MCPToolService tests to avoid actual DB calls from MCP Service
    with patch.object(audit_logging_service, 'log_audit_event') as mock_audit:
        service = MCPToolService(tool_registry=tool_registry)
        # Yield both service and mock if tests need to assert audit calls from MCPToolService
        yield service, mock_audit 

# --- Tests for MCPToolRegistry ---
def test_registry_register_tool(tool_registry: MCPToolRegistry, caplog):
    tool_def = MCPToolDefinition(tool_name="test_tool", description="A test tool", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="test.module:test_func")
    tool_registry.register_tool(tool_def)
    assert tool_registry.get_tool("test_tool") == tool_def
    assert f"Tool 'test_tool' registered successfully. Cache cleared." in caplog.text

# --- Tests for MCPToolService ---
@pytest.mark.asyncio
async def test_invoke_python_tool_weather_with_creds(mcp_service_tuple, tool_registry: MCPToolRegistry, mock_db_session_for_mcp: Session):
    mcp_service, mock_log_audit = mcp_service_tuple
    weather_def = tool_registry.get_tool("get_weather_tool")
    assert weather_def is not None
    assert weather_def.required_credentials == ["MOCK_WEATHER_TOOL_API_KEY"]

    request = MCPToolCallRequest(tool_name="get_weather_tool", inputs={"location": "London", "unit": "celsius"})
    
    with patch.dict(os.environ, {"MOCK_WEATHER_TOOL_API_KEY": "test_weather_key"}):
        response_success = await mcp_service.invoke_tool(request, db=mock_db_session_for_mcp)
        assert response_success.status == "SUCCESS"
        assert response_success.output["source"] == "Premium Weather Service (Authenticated)"
        # Verify audit log was called for successful attempt (even if it's now in Orchestration)
        # For this unit test, we check if MCPToolService itself calls it during error scenarios.
        # Successful audit calls from MCPToolService were removed, Orchestrator handles that.

    with patch.dict(os.environ, {}, clear=True):
        response_fail_config = await mcp_service.invoke_tool(request, db=mock_db_session_for_mcp)
        assert response_fail_config.status == "ERROR_CONFIGURATION"
        assert "MOCK_WEATHER_TOOL_API_KEY' missing" in response_fail_config.output["error"]
        mock_log_audit.assert_any_call(db=mock_db_session_for_mcp, user=None, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_CONFIGURATION", resource_type="tool", resource_id="get_weather_tool", details=ANY)


    with patch.dict(os.environ, {"MOCK_WEATHER_TOOL_API_KEY": "wrong_key"}):
        response_wrong_key = await mcp_service.invoke_tool(request, db=mock_db_session_for_mcp)
        assert response_wrong_key.status == "SUCCESS" 
        assert response_wrong_key.output["source"] == "Basic Weather Service"
        assert "invalid API key" in response_wrong_key.output["error_message"]

@pytest.mark.asyncio
async def test_invoke_admin_tool_with_rbac(mcp_service_tuple, tool_registry: MCPToolRegistry, mock_db_session_for_mcp: Session):
    mcp_service, mock_log_audit = mcp_service_tuple
    admin_tool_def = tool_registry.get_tool("admin_debug_tool")
    assert admin_tool_def is not None
    assert admin_tool_def.required_role == "admin"

    request = MCPToolCallRequest(tool_name="admin_debug_tool", inputs={})
    
    admin_user = SupabaseUser(id="admin-user", email="admin@example.com", role="admin")
    response_admin = await mcp_service.invoke_tool(request, current_user=admin_user, db=mock_db_session_for_mcp)
    assert response_admin.status == "SUCCESS"
    assert response_admin.output["service_status"] == "OK"

    user_user = SupabaseUser(id="user-user", email="user@example.com", role="user")
    response_user = await mcp_service.invoke_tool(request, current_user=user_user, db=mock_db_session_for_mcp)
    assert response_user.status == "ERROR_FORBIDDEN"
    assert "Access denied" in response_user.output["error"]
    mock_log_audit.assert_any_call(db=mock_db_session_for_mcp, user=user_user, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_FORBIDDEN", resource_type="tool", resource_id="admin_debug_tool", details=ANY)


    response_anon = await mcp_service.invoke_tool(request, current_user=None, db=mock_db_session_for_mcp)
    assert response_anon.status == "ERROR_FORBIDDEN"
    assert "Role 'Anonymous' not authorized" in response_anon.output["error"]
    mock_log_audit.assert_any_call(db=mock_db_session_for_mcp, user=None, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_FORBIDDEN", resource_type="tool", resource_id="admin_debug_tool", details=ANY)


# --- Cache Testing for MCPToolRegistry --- (Copied from previous version, ensure it still works)
from unittest.mock import ANY # For asserting some details in audit log calls

def test_tool_registry_get_tool_caching(tool_registry: MCPToolRegistry):
    tool_def = MCPToolDefinition(tool_name="cached_tool", description="Cache test", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f_cache")
    tool_registry.register_tool(tool_def) 

    with patch.object(tool_registry, '_tools', wraps=tool_registry._tools) as mock_tools_dict_access:
        retrieved_tool1 = tool_registry.get_tool("cached_tool")
        assert retrieved_tool1 == tool_def
        mock_tools_dict_access.get.assert_called_once_with("cached_tool")
        
        mock_tools_dict_access.get.reset_mock()
        
        retrieved_tool2 = tool_registry.get_tool("cached_tool")
        assert retrieved_tool2 == tool_def
        mock_tools_dict_access.get.assert_not_called()

# (Other existing tests like HTTP tool tests, error handling for MCPToolService should be kept and adapted if necessary)

@pytest.fixture(scope="session", autouse=True)
async def close_global_mcp_http_client_after_tests_phase3(): # Renamed to avoid conflict
    yield
    from backend.services.mcp_tool_service import mcp_tool_service as global_service_instance
    await global_service_instance.close_http_client()

```
