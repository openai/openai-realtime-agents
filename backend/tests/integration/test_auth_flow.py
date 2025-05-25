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

# --- Test Database Setup ---
# Using a separate DB for this test suite to avoid conflicts if tests run in parallel
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_auth_flow.db" 
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)
IS_SQLITE = TEST_DB_URL.startswith("sqlite")
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def override_get_db_fixture_auth(): # Unique fixture name
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
def setup_test_db_auth(override_get_db_fixture_auth): # Depends on the override
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def test_client_auth_integration(setup_test_db_auth): # Ensure DB is set up
    # For these auth flow tests, we primarily care about the headers and if the request
    # passes the security dependency. The actual endpoint logic beyond auth is secondary.
    # We'll still mock LLM calls as OrchestrationService will be hit.
    with patch('backend.services.orchestration_service.orchestration_service.client.chat.completions.create') as mock_openai_create:
        # Provide a default mock response for any LLM call
        mock_openai_create.return_value = MagicMock(choices=[MagicMock(message=MagicMock(content="Mock LLM response for auth test."))])
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            yield client, mock_openai_create

@pytest.mark.asyncio
async def test_ag_ui_endpoint_with_valid_auth_headers(test_client_auth_integration):
    client, _ = test_client_auth_integration # mock_openai_create is not strictly needed here but comes with fixture
    
    user_id = "auth-test-user-123"
    email = "auth_user@example.com"
    role = "authenticated"
    session_id = user_id # session_id is now user_id

    headers = {
        HEADER_SUPABASE_USER_ID: user_id,
        HEADER_SUPABASE_USER_EMAIL: email,
        HEADER_SUPABASE_USER_ROLE: role,
        "X-Session-ID": session_id # Client might still send this, but backend uses user_id
    }
    
    user_message = "Test message for auth flow"
    
    # Test the /ag-ui/events endpoint
    # This assumes the endpoint exists and is protected by `get_supabase_user`
    async with client.stream("GET", f"/ag-ui/events?user_message={user_message}", headers=headers) as response:
        assert response.status_code == 200 # Should succeed
        
        # Check if we receive some events (at least one, likely AGENT_RESPONSE)
        received_event = False
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                received_event = True
                break # We just need to confirm the stream starts
        assert received_event, "Should receive at least one event if auth is successful"

@pytest.mark.asyncio
async def test_ag_ui_endpoint_missing_user_id_header(test_client_auth_integration):
    client, _ = test_client_auth_integration
    
    headers = { # Missing HEADER_SUPABASE_USER_ID
        HEADER_SUPABASE_USER_EMAIL: "no_id@example.com",
        HEADER_SUPABASE_USER_ROLE: "user"
    }
    
    response = await client.get("/ag-ui/events?user_message=test", headers=headers)
    assert response.status_code == 401 # Expect Unauthorized due to missing user ID
    assert "Missing or invalid user identification from gateway" in response.text

@pytest.mark.asyncio
async def test_ag_ui_endpoint_optional_headers_not_present(test_client_auth_integration):
    client, _ = test_client_auth_integration
    
    user_id = "auth-test-user-minimal-456"
    session_id = user_id

    headers = {
        HEADER_SUPABASE_USER_ID: user_id
        # Email and Role are missing, which is acceptable for SupabaseUser model
    }
    
    async with client.stream("GET", "/ag-ui/events?user_message=test_minimal_headers", headers=headers) as response:
        assert response.status_code == 200 # Should succeed
        received_event = False
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                received_event = True
                break
        assert received_event, "Stream should open even with minimal (but valid) auth headers"

# This test suite focuses on whether the FastAPI backend correctly processes the headers
# *as if* they were set by a trusted Edge Function. It does not test the Edge Function itself.
```
