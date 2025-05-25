import pytest
import os
import json
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from backend.main import app as main_app
from backend.database import Base, get_db
from backend.security import (
    HEADER_SUPABASE_USER_ID, 
    HEADER_SUPABASE_USER_EMAIL, 
    HEADER_SUPABASE_USER_ROLE
)
from backend.models.tool_definition import MCPToolDefinition # For checking tool defs
from backend.services.mcp_tool_service import mcp_tool_registry_instance # To access registered tools

# --- Test Database Setup ---
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_rbac_flow.db" 
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)
IS_SQLITE = TEST_DB_URL.startswith("sqlite")
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def override_get_db_fixture_rbac(): # Unique fixture name
    async def _override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    original_get_db = main_app.dependency_overrides.get(get_db)
    main_app.dependency_overrides[get_db] = _override_get_db
    yield
    if original_get_db:
        main_app.dependency_overrides[get_db] = original_get_db
    else:
        del main_app.dependency_overrides[get_db]

@pytest.fixture(scope="session")
def setup_test_db_rbac(override_get_db_fixture_rbac): # Depends on the override
    Base.metadata.create_all(bind=engine)
    # Ensure admin_debug_tool is registered with required_role="admin"
    # This happens in MCPToolService._register_initial_tools()
    # We can verify it here.
    admin_tool = mcp_tool_registry_instance.get_tool("admin_debug_tool")
    assert admin_tool is not None, "Admin debug tool should be registered."
    assert admin_tool.required_role == "admin", "Admin debug tool should require 'admin' role."
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def test_client_rbac_integration(setup_test_db_rbac): 
    with patch('backend.services.orchestration_service.orchestration_service.client.chat.completions.create') as mock_openai_create:
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            yield client, mock_openai_create

@pytest.mark.asyncio
async def test_admin_tool_access_by_admin_user(test_client_rbac_integration):
    client, mock_openai_create = test_client_rbac_integration
    
    admin_user_id = "rbac-admin-user-001"
    session_id = admin_user_id 

    # LLM mock: request to use the admin_debug_tool
    llm_admin_tool_request = {
        "action": "mcp_tool_call",
        "tool_name": "admin_debug_tool",
        "inputs": {} 
    }
    # LLM mock: final response after tool output
    llm_final_response = "Admin tool executed, system status is OK."

    mock_openai_create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_admin_tool_request)))]),
        MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response))])
    ]

    headers = {
        HEADER_SUPABASE_USER_ID: admin_user_id,
        HEADER_SUPABASE_USER_EMAIL: "admin_rbac@example.com",
        HEADER_SUPABASE_USER_ROLE: "admin", # Crucial for this test
        "X-Session-ID": session_id
    }
    
    user_message = "Show me the system status (as admin)."
    received_events_data = []
    async with client.stream("GET", f"/ag-ui/events?user_message={user_message}", headers=headers) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                received_events_data.append(json.loads(line[len("data: "):]))
    
    assert len(received_events_data) == 3 # TOOL_CALL_START, TOOL_OUTPUT, AGENT_RESPONSE
    assert received_events_data[0]["event_type"] == "TOOL_CALL_START"
    assert received_events_data[0]["data"]["tool_name"] == "admin_debug_tool"
    assert received_events_data[1]["event_type"] == "TOOL_OUTPUT"
    assert received_events_data[1]["data"]["status"] == "SUCCESS"
    assert "service_status" in received_events_data[1]["data"]["output"] # Check for a field from admin_debug_tool
    assert received_events_data[2]["event_type"] == "AGENT_RESPONSE"
    assert received_events_data[2]["message"] == llm_final_response

@pytest.mark.asyncio
async def test_admin_tool_access_denied_for_user_role(test_client_rbac_integration):
    client, mock_openai_create = test_client_rbac_integration
    
    user_user_id = "rbac-user-user-002"
    session_id = user_user_id

    # LLM mock: initial request to use the admin_debug_tool
    llm_admin_tool_request = {
        "action": "mcp_tool_call",
        "tool_name": "admin_debug_tool",
        "inputs": {}
    }
    # LLM mock: response after being told the tool call failed due to permissions
    # The orchestrator will feed back the error to the LLM.
    # The LLM should then respond appropriately to the user.
    llm_informed_denial_response = "I'm sorry, I cannot access that information as it requires administrator privileges."

    mock_openai_create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_admin_tool_request)))]),
        MagicMock(choices=[MagicMock(message=MagicMock(content=llm_informed_denial_response))])
    ]

    headers = {
        HEADER_SUPABASE_USER_ID: user_user_id,
        HEADER_SUPABASE_USER_EMAIL: "user_rbac@example.com",
        HEADER_SUPABASE_USER_ROLE: "user", # Crucial for this test
        "X-Session-ID": session_id
    }
    
    user_message = "Try to show me the system status (as user)."
    received_events_data = []
    async with client.stream("GET", f"/ag-ui/events?user_message={user_message}", headers=headers) as response:
        assert response.status_code == 200 # The stream itself opens
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                received_events_data.append(json.loads(line[len("data: "):]))
    
    # Expect TOOL_CALL_START, then TOOL_OUTPUT (with error), then AGENT_RESPONSE (LLM reacting to error)
    assert len(received_events_data) == 3
    assert received_events_data[0]["event_type"] == "TOOL_CALL_START"
    assert received_events_data[0]["data"]["tool_name"] == "admin_debug_tool"
    
    assert received_events_data[1]["event_type"] == "TOOL_OUTPUT"
    assert received_events_data[1]["data"]["status"] == "ERROR_FORBIDDEN" # RBAC denial
    assert "Access denied" in received_events_data[1]["data"]["output"]["error"]
    
    assert received_events_data[2]["event_type"] == "AGENT_RESPONSE"
    assert received_events_data[2]["message"] == llm_informed_denial_response
```
