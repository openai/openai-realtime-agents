import pytest
import asyncio
import json
import os # Import os to access environment variables
from httpx import AsyncClient
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from unittest.mock import patch, MagicMock, AsyncMock

from backend.main import app as main_app
# Ensure that the main app's DATABASE_URL is updated if TEST_SUPABASE_DATABASE_URL is used
# This might require careful fixture setup or app re-initialization if main.DATABASE_URL is set at import time.
# For now, we assume that if TEST_SUPABASE_DATABASE_URL is set, main.py will pick it up
# if the env var is set *before* main.py is imported by the test runner.
# A cleaner way is to have the app factory pattern or allow DATABASE_URL override in `main.py`.
# For this modification, we'll focus on the test-side database connection.

from backend.database import Base, get_db 
from backend.models.conversation_history import ConversationTurn
# The EXPECTED_API_KEY is now gone, auth is via X-Auth-Validation-Status
# from backend.security import EXPECTED_API_KEY 
from backend.security import FORWARDED_AUTH_HEADER_NAME, EXPECTED_FORWARDED_AUTH_VALUE

# --- Test Database Setup ---
# Default to SQLite if Supabase URL for testing is not provided
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_integration.db"
# Use TEST_SUPABASE_DATABASE_URL from env if available, otherwise use SQLite.
# This allows flexibility to run tests against a local SQLite or a real Supabase instance.
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)

# Determine if we are using SQLite based on the URL
IS_SQLITE = TEST_DB_URL.startswith("sqlite")

# Create engine with appropriate connect_args for SQLite
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency for the application
@pytest.fixture(scope="session")
def override_get_db_fixture():
    async def _override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    original_get_db = main_app.dependency_overrides.get(get_db)
    main_app.dependency_overrides[get_db] = _override_get_db
    yield
    # Restore original or clear after tests
    if original_get_db:
        main_app.dependency_overrides[get_db] = original_get_db
    else:
        del main_app.dependency_overrides[get_db]


@pytest.fixture(scope="session")
def setup_test_db(override_get_db_fixture): # Depends on the override being in place
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def test_client_integration(setup_test_db): # Ensure DB is set up
    # Patch the OpenAI client within the OrchestrationService globally for tests
    # This avoids making real OpenAI calls during integration tests.
    with patch('backend.services.orchestration_service.orchestration_service.client.chat.completions.create') as mock_openai_create:
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            # Yield both client and the mock to allow tests to configure LLM responses
            yield client, mock_openai_create 
    # No need to clear main_app.dependency_overrides here for mock_openai_create as it's managed by 'with patch'

@pytest.mark.asyncio
async def test_full_conversation_flow_with_tool_call(test_client_integration):
    client, mock_openai_create = test_client_integration
    
    user_message_triggers_tool = "What is the weather like in London?"
    session_id = "integration-test-session-tool-call" # Unique session ID for this test
    
    llm_tool_call_response_json = {
        "action": "mcp_tool_call", # Updated to include action
        "tool_name": "get_weather_tool",
        "inputs": {"location": "London", "unit": "celsius"} # Assuming unit is part of the tool's capability
    }
    llm_final_response_text = "The weather in London is sunny, 25°C, based on the tool."

    mock_openai_create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_tool_call_response_json)))]),
        MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response_text))])
    ]

    # Headers for the new authentication mechanism (via Edge Function)
    headers = {
        FORWARDED_AUTH_HEADER_NAME: EXPECTED_FORWARDED_AUTH_VALUE, 
        "X-Session-ID": session_id
    }
    
    received_events_data = []
    async with client.stream("GET", f"/ag-ui/events?user_message={user_message_triggers_tool}", headers=headers) as response:
        assert response.status_code == 200
        
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                event_data_str = line[len("data: "):]
                received_events_data.append(json.loads(event_data_str))
    
    assert len(received_events_data) == 3, "Should be TOOL_CALL_START, TOOL_OUTPUT, AGENT_RESPONSE"

    # Event 1: TOOL_CALL_START
    event1 = received_events_data[0]
    assert event1["event_type"] == "TOOL_CALL_START"
    assert event1["data"]["tool_name"] == "get_weather_tool"
    assert event1["data"]["inputs"]["location"] == "London"

    # Event 2: TOOL_OUTPUT (from mock_weather_tool)
    event2 = received_events_data[1]
    assert event2["event_type"] == "TOOL_OUTPUT"
    assert event2["data"]["tool_name"] == "get_weather_tool"
    assert event2["data"]["status"] == "SUCCESS"
    # mock_weather_tool now returns unit and temp without '°C'
    assert event2["data"]["output"]["location"] == "London"
    assert event2["data"]["output"]["forecast"] == "sunny" 
    assert event2["data"]["output"]["temperature"] == "25" 
    assert event2["data"]["output"]["unit"] == "celsius"

    # Event 3: AGENT_RESPONSE (final LLM response)
    event3 = received_events_data[2]
    assert event3["event_type"] == "AGENT_RESPONSE"
    assert event3["message"] == llm_final_response_text

    # Verify database interaction
    db_for_check = TestingSessionLocal()
    try:
        turns_in_db = db_for_check.query(ConversationTurn).filter(ConversationTurn.session_id == session_id).all()
        assert len(turns_in_db) == 1
        saved_turn = turns_in_db[0]
        assert saved_turn.user_message == user_message_triggers_tool
        assert "User: What is the weather like in London?" in saved_turn.agent_response
        assert f"LLM (iteration 1): {json.dumps(llm_tool_call_response_json)}" in saved_turn.agent_response # Check for action based response
        assert "Tool: get_weather_tool Input: {\"location\": \"London\", \"unit\": \"celsius\"}" in saved_turn.agent_response
        assert "\"output\": {\"location\": \"London\", \"forecast\": \"sunny\", \"temperature\": \"25\", \"unit\": \"celsius\"}" in saved_turn.agent_response
        assert f"LLM (iteration 2): {llm_final_response_text}" in saved_turn.agent_response # Check for final response
    finally:
        db_for_check.close()

# Note: The AG-UI router was previously updated to accept `user_message` as a query param.
# This test relies on that change.
# The authentication mechanism has changed from X-API-KEY to X-Auth-Validation-Status.
# The `EXPECTED_API_KEY` is no longer used in this test's headers.
# The `mock_weather_tool` was updated to accept `unit` and return temperature as a string number.
# Test data and assertions have been updated to reflect these changes.
