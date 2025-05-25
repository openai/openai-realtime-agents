import pytest
import asyncio
import json
import os
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from backend.main import app as main_app
from backend.database import Base, get_db
from backend.models.conversation_history import ConversationTurn
from backend.models.a2a_messages import A2ATaskRequest # For constructing expected LLM output
from backend.security import FORWARDED_AUTH_HEADER_NAME, EXPECTED_FORWARDED_AUTH_VALUE

# --- Test Database Setup (similar to test_conversation_flow.py) ---
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_a2a_flow.db" # Separate DB for this test suite
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)
IS_SQLITE = TEST_DB_URL.startswith("sqlite")
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def override_get_db_fixture_a2a():
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
def setup_test_db_a2a(override_get_db_fixture_a2a):
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def test_client_a2a_integration(setup_test_db_a2a):
    # Patch OpenAI client within OrchestrationService for controlled LLM responses
    with patch('backend.services.orchestration_service.orchestration_service.client.chat.completions.create') as mock_openai_create:
        async with AsyncClient(app=main_app, base_url="http://test") as client:
            yield client, mock_openai_create

@pytest.mark.asyncio
async def test_a2a_delegation_flow(test_client_a2a_integration):
    """
    Tests the full A2A delegation flow.
    Requires the mock_a2a_server to be running on http://localhost:8001.
    """
    client, mock_openai_create = test_client_a2a_integration
    
    user_message_triggers_a2a = "Please translate 'Hello, how are you?' to Spanish using the translator agent."
    session_id = "integration-test-a2a-session-1"
    
    # 1. LLM responds with an A2A delegation request
    llm_a2a_delegation_request_json = {
        "action": "a2a_delegate",
        "target_agent_id": "mock_translator_agent_001",
        "task_name": "translate_to_spanish", # Ensure this matches a task the mock server handles
        "inputs": {"text_to_translate": "Hello, how are you?"}
    }
    
    # 2. LLM responds after getting the A2A task result
    # The mock_a2a_server for "translate_to_spanish" returns:
    # {"translated_text": "Hello, how are you? en Español", "original_text": "Hello, how are you?"}
    llm_final_response_text = "The translation of 'Hello, how are you?' to Spanish is 'Hello, how are you? en Español'."

    mock_openai_create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_a2a_delegation_request_json)))]),
        MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response_text))])
    ]

    headers = {
        FORWARDED_AUTH_HEADER_NAME: EXPECTED_FORWARDED_AUTH_VALUE,
        "X-Session-ID": session_id
    }
    
    received_events_data = []
    # Note: Ensure the mock_a2a_server is running at http://localhost:8001 for this test to pass.
    print("\nINFO: This test requires the mock_a2a_server to be running on http://localhost:8001")
    async with client.stream("GET", f"/ag-ui/events?user_message={user_message_triggers_a2a}", headers=headers) as response:
        assert response.status_code == 200
        
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                event_data_str = line[len("data: "):]
                received_events_data.append(json.loads(event_data_str))
    
    assert len(received_events_data) == 3, "Should be A2A_DELEGATION_START, A2A_DELEGATION_RESULT, AGENT_RESPONSE"

    # Event 1: A2A_DELEGATION_START
    event1 = received_events_data[0]
    assert event1["event_type"] == "A2A_DELEGATION_START"
    assert event1["data"]["target_agent_id"] == "mock_translator_agent_001"
    assert event1["data"]["task_name"] == "translate_to_spanish"
    assert event1["data"]["inputs"]["text_to_translate"] == "Hello, how are you?"

    # Event 2: A2A_DELEGATION_RESULT (from A2ACommunicationService calling mock_a2a_server)
    event2 = received_events_data[1]
    assert event2["event_type"] == "A2A_DELEGATION_RESULT"
    assert event2["data"]["target_agent_id"] == "mock_translator_agent_001" # This should be part of the A2AResponse data if we echo it back or if AGUIMessage includes it
    assert event2["data"]["status"] == "SUCCESS" # Mock server returns this
    assert event2["data"]["outputs"]["translated_text"] == "Hello, how are you? en Español"

    # Event 3: AGENT_RESPONSE (final LLM response after processing A2A result)
    event3 = received_events_data[2]
    assert event3["event_type"] == "AGENT_RESPONSE"
    assert event3["message"] == llm_final_response_text

    # Verify database interaction
    db_for_check = TestingSessionLocal()
    try:
        turns_in_db = db_for_check.query(ConversationTurn).filter(ConversationTurn.session_id == session_id).all()
        assert len(turns_in_db) == 1
        saved_turn = turns_in_db[0]
        assert saved_turn.user_message == user_message_triggers_a2a
        assert f"LLM (iteration 1): {json.dumps(llm_a2a_delegation_request_json)}" in saved_turn.agent_response
        assert "A2A Delegate: To=mock_translator_agent_001, Task=translate_to_spanish" in saved_turn.agent_response
        assert "\"outputs\": {\"translated_text\": \"Hello, how are you? en Español\"" in saved_turn.agent_response
        assert f"LLM (iteration 2): {llm_final_response_text}" in saved_turn.agent_response
    finally:
        db_for_check.close()

```
