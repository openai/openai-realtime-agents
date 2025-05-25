import os
import json 
import logging # Import logging
from openai import OpenAI
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.agent_personas.simple_example import get_default_agent_config
from backend.models.conversation_history import ConversationTurn
from backend.services.mcp_tool_service import mcp_tool_service, MCPToolService
from backend.services.a2a_communication_service import a2a_communication_service, A2ACommunicationService
from backend.models.mcp_messages import MCPToolCallRequest
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse
from backend.models.ag_ui_messages import AGUIMessage
from backend.models.tool_definition import MCPToolDefinition

logger = logging.getLogger(__name__) # Get a logger for this module

# --- Prompt Formatting ---
def format_mcp_tools_for_llm(tool_definitions: List[MCPToolDefinition]) -> str:
    if not tool_definitions: return "No MCP tools are currently available."
    prompt_parts = ["\n--- Available Tools (MCP) ---\nTo use a tool, respond ONLY with a JSON object with 'action': 'mcp_tool_call', 'tool_name', and 'inputs'. Example:\n"
                    "```json\n{\"action\": \"mcp_tool_call\", \"tool_name\": \"example_tool_name\", \"inputs\": {\"param1\": \"value1\"}}\n```"]
    for tool_def in tool_definitions:
        prompt_parts.append(f"\nTool Name: `{tool_def.tool_name}`\nDescription: {tool_def.description}")
        prompt_parts.append("Input Schema Details:")
        if tool_def.input_schema and tool_def.input_schema.get("type") == "object" and "properties" in tool_def.input_schema:
            for prop_name, prop_details in tool_def.input_schema["properties"].items():
                prop_desc = prop_details.get("description", "")
                prop_type = prop_details.get("type", "any")
                enum_values = prop_details.get("enum")
                default_value = prop_details.get("default")
                detail_str = f"- `{prop_name}` ({prop_type})"
                if prop_desc: detail_str += f": {prop_desc}"
                if enum_values: detail_str += f" (must be one of: {', '.join(map(str, enum_values))})"
                if default_value is not None: detail_str += f" (defaults to: {default_value})"
                prompt_parts.append(detail_str)
        else:
            prompt_parts.append("- No detailed input schema provided. Refer to description.")
    return "\n".join(prompt_parts)

def format_a2a_agents_for_llm(agent_cards: Dict[str, Dict]) -> str:
    if not agent_cards: return "No other agents are currently available for delegation."
    prompt_parts = ["\n--- Available Agents for Delegation (A2A) ---\nTo delegate a task, respond ONLY with a JSON object with 'action': 'a2a_delegate', 'target_agent_id', 'task_name', and 'inputs'. Example:\n"
                    "```json\n{\"action\": \"a2a_delegate\", \"target_agent_id\": \"example_agent_id\", \"task_name\": \"example_task\", \"inputs\": {\"param1\": \"value1\"}}\n```"]
    for agent_id, card in agent_cards.items():
        prompt_parts.append(f"\nAgent ID: `{agent_id}`\nName: {card.get('name', 'N/A')}\nDescription: {card.get('description', 'N/A')}")
    return "\n".join(prompt_parts)

MAX_ITERATIONS_PER_TURN = 5

class OrchestrationService:
    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
        self.agent_config = get_default_agent_config()
        if not self.agent_config: 
            logger.error("Default agent configuration could not be loaded.")
            raise ValueError("Could not load default agent config")
        self.mcp_service: MCPToolService = mcp_tool_service
        self.a2a_service: A2ACommunicationService = a2a_communication_service
        logger.info("OrchestrationService initialized.")

    async def _save_turn(self, db: Session, session_id: str, user_msg: str, agent_resp_summary: str):
        try:
            db_turn = ConversationTurn(session_id=session_id, user_message=user_msg, agent_response=agent_resp_summary)
            db.add(db_turn)
            db.commit()
            db.refresh(db_turn)
            logger.debug("Conversation turn saved to database.", extra={"session_id": session_id, "user_msg_length": len(user_msg), "summary_length": len(agent_resp_summary)})
        except Exception as e:
            logger.error(f"Failed to save conversation turn for session_id {session_id}: {e}", exc_info=True)
            # Depending on requirements, you might rollback the session or handle this more gracefully.
            # For now, just logging the error.

    async def handle_user_message(self, db: Session, user_message: str, session_id: str) -> List[AGUIMessage]:
        events: List[AGUIMessage] = []
        logger.info(f"Handling user message for session_id: {session_id}", extra={"session_id": session_id, "user_message": user_message})
        
        turn_context = {
            "original_user_message": user_message,
            "history_for_llm": [{"role": "user", "content": user_message}],
            "full_interaction_log": f"User: {user_message}\n"
        }
        
        available_mcp_tools = self.mcp_service.tool_registry.list_tools()
        mcp_tools_prompt = format_mcp_tools_for_llm(available_mcp_tools)
        available_a2a_agents = self.a2a_service.agent_cards
        a2a_agents_prompt = format_a2a_agents_for_llm(available_a2a_agents)
        system_prompt_base = self.agent_config.get("instructions", "You are a helpful assistant.")
        action_guidance_prompt = (
            "\n--- Action Guidance ---\n"
            "Based on the user's message and the history of actions taken so far in this turn, "
            "decide on the next best action. You can respond directly to the user, use an MCP tool, "
            "or delegate a task to another agent. Only choose one action per response. "
            "If all necessary information is gathered, provide a final response to the user (without any 'action' field)."
        )
        system_prompt_full = f"{system_prompt_base}\n{mcp_tools_prompt}\n{a2a_agents_prompt}\n{action_guidance_prompt}"
        
        turn_context["full_interaction_log"] += f"System Prompt Sent (Initial):\n{system_prompt_full}\n"
        logger.debug("System prompt constructed for LLM.", extra={"session_id": session_id, "system_prompt_length": len(system_prompt_full)})
        
        for iteration in range(MAX_ITERATIONS_PER_TURN):
            logger.info(f"Orchestration loop iteration {iteration + 1} for session_id: {session_id}", extra={"session_id": session_id, "iteration": iteration + 1})
            messages_for_llm_this_step = [{"role": "system", "content": system_prompt_full}] + turn_context["history_for_llm"]

            try:
                chat_completion = self.client.chat.completions.create(
                    messages=messages_for_llm_this_step,
                    model="gpt-3.5-turbo",
                )
                agent_response_content = chat_completion.choices[0].message.content
                logger.debug(f"LLM response received (iteration {iteration + 1}): {agent_response_content}", extra={"session_id": session_id, "iteration": iteration + 1})
                turn_context["full_interaction_log"] += f"LLM (iteration {iteration+1}): {agent_response_content}\n"
                turn_context["history_for_llm"].append({"role": "assistant", "content": agent_response_content})

                parsed_llm_response = None
                try:
                    parsed_llm_response = json.loads(agent_response_content)
                except json.JSONDecodeError:
                    logger.info("LLM response is not JSON, treating as direct agent response.", extra={"session_id": session_id, "iteration": iteration + 1})
                    events.append(AGUIMessage(event_type="AGENT_RESPONSE", message=agent_response_content))
                    await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                    return events

                action = parsed_llm_response.get("action") if isinstance(parsed_llm_response, dict) else None
                logger.debug(f"Parsed LLM action: {action}", extra={"session_id": session_id, "iteration": iteration + 1, "action": action})

                if action == "mcp_tool_call":
                    tool_name = parsed_llm_response.get("tool_name")
                    inputs = parsed_llm_response.get("inputs", {})
                    if not tool_name or not self.mcp_service.tool_registry.get_tool(tool_name):
                        logger.warning(f"LLM attempted to call invalid/unregistered MCP tool: '{tool_name}'", extra={"session_id": session_id, "iteration": iteration + 1, "tool_name": tool_name})
                        turn_context["history_for_llm"].append({"role": "user", "content": f"Error: Tool '{tool_name}' is not valid. Please choose from the available tools or respond directly."})
                        turn_context["full_interaction_log"] += f"System: Invalid MCP tool request from LLM for tool '{tool_name}'.\n"
                        continue

                    mcp_request = MCPToolCallRequest(tool_name=tool_name, inputs=inputs)
                    logger.info(f"Initiating MCP tool call: {tool_name}", extra={"session_id": session_id, "iteration": iteration + 1, "tool_name": tool_name, "inputs": inputs})
                    events.append(AGUIMessage(event_type="TOOL_CALL_START", data=mcp_request.dict()))
                    
                    tool_response = await self.mcp_service.invoke_tool(mcp_request)
                    events.append(AGUIMessage(event_type="TOOL_OUTPUT", data=tool_response.dict()))
                    turn_context["full_interaction_log"] += f"MCP Tool: {tool_name}, Input: {inputs}, Output: {tool_response.output}, Status: {tool_response.status}\n"
                    logger.info(f"MCP tool '{tool_name}' call completed with status: {tool_response.status}", extra={"session_id": session_id, "iteration": iteration + 1, "tool_name": tool_name, "status": tool_response.status})
                    
                    if tool_response.status == "SUCCESS":
                        turn_context["history_for_llm"].append({"role": "user", "content": f"Tool {tool_name} responded with: {json.dumps(tool_response.output)}"})
                    else:
                        turn_context["history_for_llm"].append({"role": "user", "content": f"Tool {tool_name} failed with error: {json.dumps(tool_response.output)}. Please analyze this error and proceed."})
                    continue

                elif action == "a2a_delegate":
                    target_agent_id = parsed_llm_response.get("target_agent_id")
                    task_name = parsed_llm_response.get("task_name")
                    inputs = parsed_llm_response.get("inputs", {})
                    if not target_agent_id or not task_name or not self.a2a_service.get_agent_details(target_agent_id):
                        logger.warning(f"LLM attempted invalid A2A delegation: Target '{target_agent_id}', Task '{task_name}'", extra={"session_id": session_id, "iteration": iteration + 1, "target_agent_id": target_agent_id, "task_name": task_name})
                        turn_context["history_for_llm"].append({"role": "user", "content": "Invalid A2A delegation request. Please check agent ID and task name, then try again or provide a direct response."})
                        turn_context["full_interaction_log"] += "System: Invalid A2A delegation request from LLM.\n"
                        continue

                    a2a_request = A2ATaskRequest(target_agent_id=target_agent_id, task_name=task_name, inputs=inputs)
                    logger.info(f"Initiating A2A delegation: To='{target_agent_id}', Task='{task_name}'", extra={"session_id": session_id, "iteration": iteration + 1, "target_agent_id": target_agent_id, "task_name": task_name, "inputs": inputs})
                    events.append(AGUIMessage(event_type="A2A_DELEGATION_START", data=a2a_request.dict()))
                    
                    a2a_response = await self.a2a_service.send_task_to_agent(a2a_request)
                    events.append(AGUIMessage(event_type="A2A_DELEGATION_RESULT", data=a2a_response.dict()))
                    turn_context["full_interaction_log"] += f"A2A Delegate: To={target_agent_id}, Task={task_name}, Input={inputs}, Status={a2a_response.status}, Output/Error={a2a_response.outputs or a2a_response.error_message}\n"
                    logger.info(f"A2A delegation to '{target_agent_id}' for task '{task_name}' completed with status: {a2a_response.status}", extra={"session_id": session_id, "iteration": iteration + 1, "target_agent_id": target_agent_id, "task_name": task_name, "status": a2a_response.status})

                    if a2a_response.status == "SUCCESS":
                        turn_context["history_for_llm"].append({"role": "user", "content": f"Agent {target_agent_id} completed task {task_name} with output: {json.dumps(a2a_response.outputs)}"})
                    else:
                        turn_context["history_for_llm"].append({"role": "user", "content": f"Agent {target_agent_id} failed task {task_name} with error: {a2a_response.error_message}. Please analyze this error and proceed."})
                    continue

                else: 
                    logger.info("LLM provided a direct response (no valid action field).", extra={"session_id": session_id, "iteration": iteration + 1})
                    events.append(AGUIMessage(event_type="AGENT_RESPONSE", message=agent_response_content))
                    await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                    return events

            except Exception as e: 
                logger.error(f"Error during orchestration loop (iteration {iteration+1}) for session_id {session_id}: {e}", exc_info=True)
                error_message = f"Error during processing: {str(e)}"
                turn_context["full_interaction_log"] += f"Error (iteration {iteration+1}): {error_message}\n"
                events.append(AGUIMessage(event_type="ERROR", message=error_message))
                await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                return events
        
        logger.warning(f"Max iterations ({MAX_ITERATIONS_PER_TURN}) reached for session_id: {session_id}", extra={"session_id": session_id, "user_message": user_message})
        events.append(AGUIMessage(event_type="AGENT_RESPONSE", message="I'm having trouble completing your request. Please try rephrasing or breaking it down."))
        turn_context["full_interaction_log"] += "System: Max iterations reached. Ending turn with a generic message.\n"
        await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
        return events

orchestration_service = OrchestrationService()
