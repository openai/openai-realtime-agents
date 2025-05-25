import pytest
import os
import json
from httpx import AsyncClient
from sqlalchemy import create_engine, text as sql_text
from sqlalchemy.orm import sessionmaker, Session

from backend.main import app as main_app
from backend.database import Base, get_db
from backend.models.audit_log import AuditEvent # The model to query
from backend.security import (
    HEADER_SUPABASE_USER_ID, 
    HEADER_SUPABASE_USER_EMAIL, 
    HEADER_SUPABASE_USER_ROLE
)
from unittest.mock import patch, MagicMock

# --- Test Database Setup ---
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_audit_logging.db" 
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)
IS_SQLITE = TEST_DB_URL.startswith("sqlite")
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def override_get_db_fixture_audit(): # Unique fixture name
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
def setup_test_db_audit(override_get_db_fixture_audit): # Depends on the override
    Base.metadata.create_all(bind=engine) # Creates all tables including audit_events
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def test_client_audit_integration(setup_test_db_audit): 
    with patch('backend.services.orchestration_service.orchestration_service.client.chat.completions.create') as mock_openai_create:
        mock_openai_create.return_value = MagicMock(choices=[MagicMock(message=MagicMock(content="Mock LLM response for audit test."))])
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            yield client, mock_openai_create

def query_audit_log(db_session: Session, action: str, user_id: str = None) -> list[AuditEvent]:
    """Helper function to query audit logs for specific action and user."""
    stmt = db_session.query(AuditEvent).filter(AuditEvent.action == action)
    if user_id:
        stmt = stmt.filter(AuditEvent.user_id == user_id)
    return stmt.all()

@pytest.mark.asyncio
async def test_audit_log_for_sse_request_received(test_client_audit_integration):
    client, _ = test_client_audit_integration
    db_session = TestingSessionLocal() # Get a session for querying

    user_id = "audit-user-sse-001"
    headers = {
        HEADER_SUPABASE_USER_ID: user_id,
        HEADER_SUPABASE_USER_EMAIL: "audit_sse@example.com",
        HEADER_SUPABASE_USER_ROLE: "user",
        "X-Session-ID": user_id 
    }
    user_message = "trigger SSE audit log"

    try:
        # Clear previous audit logs for this user/action if any, for a clean test
        db_session.query(AuditEvent).filter(AuditEvent.user_id == user_id, AuditEvent.action == "SSE_REQUEST_RECEIVED").delete()
        db_session.commit()

        async with client.stream("GET", f"/ag-ui/events?user_message={user_message}", headers=headers) as response:
            assert response.status_code == 200
            async for line in response.aiter_lines(): # Consume the stream briefly
                if line.startswith("data:"): break
        
        await asyncio.sleep(0.1) # Allow time for async audit logging if any delays

        audit_events = query_audit_log(db_session, "SSE_REQUEST_RECEIVED", user_id)
        assert len(audit_events) >= 1
        latest_event = audit_events[-1] # Get the last one for this user/action
        assert latest_event.user_id == user_id
        assert latest_event.action == "SSE_REQUEST_RECEIVED"
        assert latest_event.status == "SUCCESS"
        assert latest_event.resource_type == "endpoint"
        assert latest_event.resource_id == "/ag-ui/events"
        assert latest_event.details["user_message"] == user_message
    finally:
        db_session.close()


@pytest.mark.asyncio
async def test_audit_log_for_mcp_tool_invocation(test_client_audit_integration):
    client, mock_openai_create = test_client_audit_integration
    db_session = TestingSessionLocal()

    user_id = "audit-user-mcp-002"
    user_role = "user" # Calculator tool is public
    session_id = user_id
    user_message = "Calculate 2+2"

    llm_tool_call_action = { "action": "mcp_tool_call", "tool_name": "calculator_tool", "inputs": {"expression": "2+2"} }
    llm_final_response = "The result is 4."
    mock_openai_create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_tool_call_action)))]),
        MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response))])
    ]
    headers = { HEADER_SUPABASE_USER_ID: user_id, HEADER_SUPABASE_USER_ROLE: user_role, "X-Session-ID": session_id }

    try:
        db_session.query(AuditEvent).filter(AuditEvent.user_id == user_id).delete() # Clear previous
        db_session.commit()

        async with client.stream("GET", f"/ag-ui/events?user_message={user_message}", headers=headers) as response:
            assert response.status_code == 200
            async for _ in response.aiter_lines(): pass # Consume stream
        
        await asyncio.sleep(0.1)

        # Check for MCP_TOOL_CALL_INITIATED
        initiated_events = query_audit_log(db_session, "MCP_TOOL_CALL_INITIATED", user_id)
        assert len(initiated_events) >= 1
        initiated_event = initiated_events[-1]
        assert initiated_event.resource_id == "calculator_tool"
        assert initiated_event.details["inputs"]["expression"] == "2+2"

        # Check for MCP_TOOL_CALL_COMPLETED
        completed_events = query_audit_log(db_session, "MCP_TOOL_CALL_COMPLETED", user_id)
        assert len(completed_events) >= 1
        completed_event = completed_events[-1]
        assert completed_event.resource_id == "calculator_tool"
        assert completed_event.status == "SUCCESS" # Assuming calculator tool works
        assert completed_event.details["output"]["result"] == 4.0
    finally:
        db_session.close()

@pytest.mark.asyncio
async def test_audit_log_for_auth_gateway_validation_failure(test_client_audit_integration):
    client, _ = test_client_audit_integration # LLM not involved here
    db_session = TestingSessionLocal()

    headers = { # Missing X-Supabase-User-ID
        HEADER_SUPABASE_USER_EMAIL: "audit_auth_fail@example.com",
        HEADER_SUPABASE_USER_ROLE: "user"
    }
    try:
        db_session.query(AuditEvent).filter(AuditEvent.action == "AUTH_GATEWAY_VALIDATION", AuditEvent.status == "FAILURE").delete()
        db_session.commit()

        response = await client.get("/ag-ui/events?user_message=test_auth_fail", headers=headers)
        assert response.status_code == 401 # Auth failure
        
        await asyncio.sleep(0.1)

        audit_events = query_audit_log(db_session, "AUTH_GATEWAY_VALIDATION")
        # Filter for the specific failure if other auth logs might exist
        failure_events = [e for e in audit_events if e.status == "FAILURE" and e.details["reason"] == f"Missing '{HEADER_SUPABASE_USER_ID}' header"]
        assert len(failure_events) >= 1
        latest_event = failure_events[-1]
        assert latest_event.user_id is None # No user_id was provided
        assert latest_event.action == "AUTH_GATEWAY_VALIDATION"
        assert latest_event.status == "FAILURE"
        assert f"Missing '{HEADER_SUPABASE_USER_ID}' header" in latest_event.details["reason"]
    finally:
        db_session.close()
```
