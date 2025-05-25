import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.orm import Session # For type hinting mock_db_session

from backend.services.orchestration_service import OrchestrationService, MAX_ITERATIONS_PER_TURN, format_mcp_tools_for_llm, format_a2a_agents_for_llm
from backend.models.ag_ui_messages import AGUIMessage
from backend.models.mcp_messages import MCPToolCallRequest, MCPToolCallResponse
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse
from backend.agent_personas.simple_example import get_default_agent_config
# Import A2A service to access its MOCK_AGENT_CARDS for prompt construction in tests
from backend.services.a2a_communication_service import a2a_communication_service as global_a2a_service
from backend.services.mcp_tool_service import mcp_tool_service as global_mcp_service


# Mock for database session
@pytest.fixture
def mock_db_session():
    mock_session = MagicMock(spec=Session)
    return mock_session

# Fixture for OrchestrationService instance
@pytest.fixture
def service(mock_db_session): # Ensure db_session mock is consistent if needed by service directly
    # Create a new instance for each test
    # Patch global services if OrchestrationService uses them directly as module-level singletons
    with patch('backend.services.orchestration_service.mcp_tool_service', new_callable=AsyncMock) as mock_mcp_svc, \
         patch('backend.services.orchestration_service.a2a_communication_service', new_callable=AsyncMock) as mock_a2a_svc:
        
        # Configure the mocked services that are part of the OrchestrationService instance
        # The OrchestrationService constructor assigns these global instances.
        # So, we configure the *actual global instances* if they are used, or patch where OrchestrationService gets them.
        # For this test setup, we'll assume OrchestrationService is re-initialized or its attributes are patched.
        
        # Re-initialize service to pick up module-level mocks if necessary, or patch instance attributes.
        # If OrchestrationService() picks up global mcp_tool_service, the patch above works.
        # If it instantiates its own, then we'd need to patch 'MCPToolService' and 'A2ACommunicationService'
        # before OrchestrationService is instantiated.
        
        # Let's assume OrchestrationService uses the globally imported mcp_tool_service and a2a_communication_service
        # The patches above will affect what `service = OrchestrationService()` gets if those are module globals.
        
        # For clarity and control, let's make the service use these specific mocks
        # This is safer if the global instances are complex or stateful.
        test_service = OrchestrationService() 
        test_service.mcp_service = mock_mcp_svc
        test_service.a2a_service = mock_a2a_svc
        
        # Setup default return values for mocked services
        # Mock the tool registry part of mcp_service
        mock_mcp_svc.tool_registry = MagicMock()
        mock_mcp_svc.tool_registry.list_tools = MagicMock(return_value=[]) # Default to no tools
        
        # Mock the agent cards part of a2a_service
        mock_a2a_svc.agent_cards = {} # Default to no agents
        mock_a2a_svc.get_agent_details = MagicMock(return_value=None) # Default for get_agent_details

        yield test_service # Provide the service instance with mocked sub-services

@pytest.mark.asyncio
async def test_handle_user_message_direct_response(service: OrchestrationService, mock_db_session: Session):
    user_message = "Hello, what's your name?"
    session_id = "test_direct_response_session"
    llm_direct_response = "I am a helpful assistant."

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.return_value = MagicMock(choices=[MagicMock(message=MagicMock(content=llm_direct_response))])
        
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        
        assert len(events) == 1
        assert events[0].event_type == "AGENT_RESPONSE"
        assert events[0].message == llm_direct_response
        mock_openai_create.assert_called_once()
        mock_db_session.add.assert_called_once()

@pytest.mark.asyncio
async def test_handle_user_message_mcp_tool_call_flow(service: OrchestrationService, mock_db_session: Session):
    user_message = "What is the weather in London?"
    session_id = "test_mcp_tool_session"

    # Simulate that get_weather_tool is registered
    mock_weather_tool_def = MCPToolDefinition(
        tool_name="get_weather_tool", description="Gets weather", 
        input_schema={"type": "object", "properties": {"location": {"type": "string"}, "unit": {"type": "string"}}},
        output_schema={}, handler_type="python_function", handler_identifier="backend.tools.mock_weather_tool:get_weather"
    )
    service.mcp_service.tool_registry.list_tools.return_value = [mock_weather_tool_def]
    service.mcp_service.tool_registry.get_tool = MagicMock(return_value=mock_weather_tool_def)


    llm_tool_call_action = {
        "action": "mcp_tool_call",
        "tool_name": "get_weather_tool",
        "inputs": {"location": "London", "unit": "celsius"}
    }
    tool_output_data = {"location": "London", "temperature": "15", "unit": "celsius", "forecast": "Cloudy"}
    llm_final_response = "The weather in London is 15°C and Cloudy."

    service.mcp_service.invoke_tool = AsyncMock(
        return_value=MCPToolCallResponse(tool_name="get_weather_tool", output=tool_output_data, status="SUCCESS")
    )

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.side_effect = [
            MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_tool_call_action)))]),
            MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response))])
        ]
        
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        
        assert len(events) == 3
        assert events[0].event_type == "TOOL_CALL_START"
        assert events[1].event_type == "TOOL_OUTPUT"
        assert events[2].event_type == "AGENT_RESPONSE"
        assert events[2].message == llm_final_response
        
        assert mock_openai_create.call_count == 2
        history_for_second_call = mock_openai_create.call_args_list[1].kwargs['messages']
        assert any(msg["role"] == "user" and "Tool get_weather_tool responded with" in msg["content"] for msg in history_for_second_call)
        mock_db_session.add.assert_called_once()

@pytest.mark.asyncio
async def test_handle_user_message_a2a_delegation_flow(service: OrchestrationService, mock_db_session: Session):
    user_message = "Translate 'hello' to Spanish using the translator agent."
    session_id = "test_a2a_session"

    # Simulate translator agent is registered/discoverable
    translator_agent_id = "mock_translator_agent_001"
    translator_agent_card = {"agent_id": translator_agent_id, "name": "Translator", "description": "Translates text."}
    service.a2a_service.agent_cards = {translator_agent_id: translator_agent_card} # Make it discoverable
    service.a2a_service.get_agent_details = MagicMock(return_value=translator_agent_card)


    llm_a2a_action = {
        "action": "a2a_delegate",
        "target_agent_id": translator_agent_id,
        "task_name": "translate_to_spanish",
        "inputs": {"text_to_translate": "hello"}
    }
    a2a_output_data = {"translated_text": "hola"}
    llm_final_response = "The translation is 'hola'."

    service.a2a_service.send_task_to_agent = AsyncMock(
        return_value=A2ATaskResponse(request_id="dummy", status="SUCCESS", outputs=a2a_output_data)
    )

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.side_effect = [
            MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_a2a_action)))]),
            MagicMock(choices=[MagicMock(message=MagicMock(content=llm_final_response))])
        ]
        
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        
        assert len(events) == 3
        assert events[0].event_type == "A2A_DELEGATION_START"
        assert events[1].event_type == "A2A_DELEGATION_RESULT"
        assert events[1].data["outputs"] == a2a_output_data
        assert events[2].event_type == "AGENT_RESPONSE"
        assert events[2].message == llm_final_response
        
        assert mock_openai_create.call_count == 2
        history_for_second_call = mock_openai_create.call_args_list[1].kwargs['messages']
        assert any(msg["role"] == "user" and f"Agent {translator_agent_id} completed task" in msg["content"] for msg in history_for_second_call)
        mock_db_session.add.assert_called_once()

@pytest.mark.asyncio
async def test_handle_user_message_max_iterations(service: OrchestrationService, mock_db_session: Session):
    user_message = "Keep trying to use a tool."
    session_id = "test_max_iter_session"

    # Simulate a tool is registered
    mock_tool = MCPToolDefinition(tool_name="loop_tool", description="A tool for looping", input_schema={}, output_schema={}, handler_type="python_function", handler_identifier="m:f")
    service.mcp_service.tool_registry.list_tools.return_value = [mock_tool]
    service.mcp_service.tool_registry.get_tool = MagicMock(return_value=mock_tool)

    llm_tool_action = {"action": "mcp_tool_call", "tool_name": "loop_tool", "inputs": {}}
    tool_output = {"result": "still looping"}
    
    service.mcp_service.invoke_tool = AsyncMock(return_value=MCPToolCallResponse(tool_name="loop_tool", output=tool_output, status="SUCCESS"))

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.return_value = MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_tool_action)))])
        
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        
        assert len(events) == (2 * MAX_ITERATIONS_PER_TURN) + 1 # (START, OUTPUT) * N + final AGENT_RESPONSE
        assert events[-1].event_type == "AGENT_RESPONSE"
        assert "I'm having trouble completing your request" in events[-1].message
        assert mock_openai_create.call_count == MAX_ITERATIONS_PER_TURN
        mock_db_session.add.assert_called_once()

@pytest.mark.asyncio
async def test_llm_hallucinates_unregistered_mcp_tool(service: OrchestrationService, mock_db_session: Session):
    user_message = "Use non_existent_mcp_tool."
    session_id = "test_hallucination_mcp"
    llm_fake_tool_action = {"action": "mcp_tool_call", "tool_name": "non_existent_mcp_tool", "inputs": {}}
    llm_correction_response = "Sorry, I can't use that tool."

    # Ensure the tool is NOT in the registry for this test
    service.mcp_service.tool_registry.get_tool = MagicMock(return_value=None)
    service.mcp_service.tool_registry.list_tools.return_value = [] # No tools available for prompt

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.side_effect = [
            MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_fake_tool_action)))]),
            MagicMock(choices=[MagicMock(message=MagicMock(content=llm_correction_response))])
        ]
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        assert len(events) == 1 # Only the final AGENT_RESPONSE after correction
        assert events[0].event_type == "AGENT_RESPONSE"
        assert events[0].message == llm_correction_response
        assert mock_openai_create.call_count == 2
        history_for_second_call = mock_openai_create.call_args_list[1].kwargs['messages']
        assert any(msg["role"] == "user" and "Error: Tool 'non_existent_mcp_tool' is not valid." in msg["content"] for msg in history_for_second_call)

@pytest.mark.asyncio
async def test_llm_hallucinates_unregistered_a2a_agent(service: OrchestrationService, mock_db_session: Session):
    user_message = "Delegate to non_existent_a2a_agent."
    session_id = "test_hallucination_a2a"
    llm_fake_a2a_action = {"action": "a2a_delegate", "target_agent_id": "non_existent_a2a_agent", "task_name": "fake_task", "inputs": {}}
    llm_correction_response = "I cannot delegate to that agent."

    # Ensure the agent is NOT in the A2A service's cards for this test
    service.a2a_service.get_agent_details = MagicMock(return_value=None)
    service.a2a_service.agent_cards = {} # No agents available for prompt

    with patch.object(service.client.chat.completions, 'create', new_callable=MagicMock) as mock_openai_create:
        mock_openai_create.side_effect = [
            MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps(llm_fake_a2a_action)))]),
            MagicMock(choices=[MagicMock(message=MagicMock(content=llm_correction_response))])
        ]
        events = await service.handle_user_message(mock_db_session, user_message, session_id)
        assert len(events) == 1
        assert events[0].event_type == "AGENT_RESPONSE"
        assert events[0].message == llm_correction_response
        assert mock_openai_create.call_count == 2
        history_for_second_call = mock_openai_create.call_args_list[1].kwargs['messages']
        assert any(msg["role"] == "user" and "Invalid A2A delegation request." in msg["content"] for msg in history_for_second_call)

# Test for prompt formatting functions (optional, but good for completeness)
def test_format_mcp_tools_for_llm_with_tools():
    tool_def = MCPToolDefinition(
        tool_name="sample_tool", description="Does something cool.",
        input_schema={"type": "object", "properties": {"param1": {"type": "string", "description": "A parameter"}}},
        output_schema={}, handler_type="python_function", handler_identifier="m:f"
    )
    prompt = format_mcp_tools_for_llm([tool_def])
    assert "Tool Name: `sample_tool`" in prompt
    assert "Description: Does something cool." in prompt
    assert "- `param1` (string): A parameter" in prompt

def test_format_mcp_tools_for_llm_no_tools():
    prompt = format_mcp_tools_for_llm([])
    assert "No MCP tools are currently available." in prompt

def test_format_a2a_agents_for_llm_with_agents():
    agent_card = {"agent_id": "agent1", "name": "Test Agent", "description": "Helps with testing."}
    prompt = format_a2a_agents_for_llm({"agent1": agent_card})
    assert "Agent ID: `agent1`" in prompt
    assert "Name: Test Agent" in prompt
    assert "Description: Helps with testing." in prompt

def test_format_a2a_agents_for_llm_no_agents():
    prompt = format_a2a_agents_for_llm({})
    assert "No other agents are currently available for delegation." in prompt

```
