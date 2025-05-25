import os
import json 
import logging
from openai import AsyncOpenAI 
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional 
from opentelemetry import trace 

from backend.agent_personas.simple_example import get_default_agent_config
from backend.models.conversation_history import ConversationTurn
from backend.services.mcp_tool_service import mcp_tool_service, MCPToolService
from backend.services.a2a_communication_service import a2a_communication_service, A2ACommunicationService
from backend.services.audit_logging_service import log_audit_event 
from backend.models.mcp_messages import MCPToolCallRequest
from backend.models.a2a_messages import A2ATaskRequest, A2ATaskResponse
from backend.models.ag_ui_messages import AGUIMessage
from backend.models.tool_definition import MCPToolDefinition
from backend.security import SupabaseUser 

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__) 

DISALLOWED_KEYWORDS = [
    "ignore previous instructions", "disregard your programming", "reveal your secrets",
    "delete all files", "shutdown system", "send email to all users" 
]

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
        self.client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
        self.agent_config = get_default_agent_config()
        if not self.agent_config: 
            logger.error("Default agent configuration could not be loaded.")
            raise ValueError("Could not load default agent config")
        self.mcp_service: MCPToolService = mcp_tool_service
        self.a2a_service: A2ACommunicationService = a2a_communication_service
        logger.info("OrchestrationService initialized with AsyncOpenAI client.")

    async def _save_turn(self, db: Session, session_id: str, user_msg: str, agent_resp_summary: str):
        try:
            db_turn = ConversationTurn(session_id=session_id, user_message=user_msg, agent_response=agent_resp_summary)
            db.add(db_turn)
            db.commit() 
            db.refresh(db_turn)
            logger.debug("Conversation turn saved to database.", extra={"session_id": session_id, "user_msg_length": len(user_msg)})
        except Exception as e:
            logger.error(f"Failed to save conversation turn for session_id {session_id}: {e}", exc_info=True)

    def _check_guardrails(self, text_content: str) -> Optional[str]:
        if not isinstance(text_content, str): return None
        for keyword in DISALLOWED_KEYWORDS:
            if keyword.lower() in text_content.lower():
                logger.warning(f"Guardrail violation detected: Keyword '{keyword}' found.", 
                               extra={"keyword_violation": keyword, "text_preview": text_content[:200]})
                return keyword
        return None

    async def handle_user_message(
        self, db: Session, user_message: str, session_id: str, current_user: Optional[SupabaseUser] = None 
    ) -> List[AGUIMessage]:
        events: List[AGUIMessage] = []
        log_context_id = current_user.id if current_user else session_id
        log_extras_base = {
            "user_id": current_user.id if current_user else None, 
            "session_id_param": session_id, 
            "user_email": current_user.email if current_user else None, 
            "user_role": current_user.role if current_user else None
        }
        logger.info(f"Handling user message for user_id: {log_context_id}", extra={**log_extras_base, "user_message": user_message})
        
        turn_context: Dict[str, Any] = {
            "original_user_message": user_message,
            "history_for_llm": [{"role": "user", "content": user_message}],
            "full_interaction_log": f"User (ID: {log_context_id}): {user_message}\n",
            "executed_plan_steps": [], 
            "pending_plan_steps": []  
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
            "or delegate a task to another agent. "
            "If a previous tool or A2A call failed, analyze the error and decide how to proceed (e.g., retry with different inputs, use a different tool/agent, or inform the user if the task cannot be completed). "
            "If the user's request is complex and requires multiple steps, you can optionally return a 'plan' field "
            "containing a list of sequential actions (mcp_tool_call or a2a_delegate). "
            "The orchestrator will execute these plan steps one by one. "
            "If providing a plan, do not also provide a top-level 'action' field for immediate execution. "
            "If all necessary information is gathered, or if a plan is complete, provide a final response to the user (without any 'action' or 'plan' field)."
        )
        system_prompt_full = f"{system_prompt_base}\n{mcp_tools_prompt}\n{a2a_agents_prompt}\n{action_guidance_prompt}"
        
        turn_context["full_interaction_log"] += f"System Prompt Sent (Initial):\n{system_prompt_full}\n"
        logger.debug("System prompt constructed.", extra={**log_extras_base, "system_prompt_length": len(system_prompt_full)})
        
        for iteration in range(MAX_ITERATIONS_PER_TURN):
            current_log_extras = {**log_extras_base, "iteration": iteration + 1}
            logger.info(f"Orchestration loop iteration {iteration + 1}", extra=current_log_extras)
            
            agent_response_content = "" # Initialize to ensure it's always defined
            
            if turn_context["pending_plan_steps"]:
                next_action_from_plan = turn_context["pending_plan_steps"].pop(0)
                turn_context["executed_plan_steps"].append(next_action_from_plan)
                logger.info(f"Executing next step from plan: {next_action_from_plan.get('action')} {next_action_from_plan.get('tool_name') or next_action_from_plan.get('task_name')}", 
                            extra=current_log_extras)
                agent_response_content = json.dumps(next_action_from_plan)
                # Add a system note to history that this action is part of an ongoing plan
                # This assistant message is crucial as it simulates the LLM deciding this step.
                turn_context["history_for_llm"].append({"role": "assistant", "content": agent_response_content})
                # We don't add a system message here to history_for_llm as the LLM isn't called for this decision.
            else: 
                messages_for_llm_this_step = [{"role": "system", "content": system_prompt_full}] + turn_context["history_for_llm"]
                with tracer.start_as_current_span("LLM_call", attributes={"llm.model_name": "gpt-3.5-turbo", "iteration": iteration + 1}) as llm_span:
                    chat_completion = await self.client.chat.completions.create(
                        messages=messages_for_llm_this_step, model="gpt-3.5-turbo",
                    )
                    agent_response_content = chat_completion.choices[0].message.content
                    if chat_completion.usage:
                        llm_span.set_attribute("llm.usage.prompt_tokens", chat_completion.usage.prompt_tokens)
                        llm_span.set_attribute("llm.usage.completion_tokens", chat_completion.usage.completion_tokens)
                    llm_span.set_attribute("llm.response_preview", agent_response_content[:100])

                logger.debug(f"LLM response received", extra={**current_log_extras, "llm_response_preview": agent_response_content[:200]})
                turn_context["full_interaction_log"] += f"LLM (iteration {iteration+1}): {agent_response_content}\n"
                # LLM's direct response is added to history here
                turn_context["history_for_llm"].append({"role": "assistant", "content": agent_response_content})
            
            violation = self._check_guardrails(agent_response_content)
            if violation:
                error_message = f"Guardrail violation: LLM response or planned action contained disallowed keyword ('{violation}'). Action aborted."
                logger.warning(error_message, extra={**current_log_extras, "guardrail_violation": violation})
                log_audit_event(db, user=current_user, action="GUARDRAIL_VIOLATION_DETECTED", status="FAILURE",
                                resource_type="llm_response_or_plan", details={"keyword": violation, "content_preview": agent_response_content[:200]})
                events.append(AGUIMessage(event_type="GUARDRAIL_VIOLATION", message=error_message, data={"keyword_violation": violation, "content_preview": agent_response_content[:200]}))
                events.append(AGUIMessage(event_type="AGENT_RESPONSE", message="I cannot proceed with that type of request due to safety guidelines."))
                turn_context["full_interaction_log"] += f"System: Guardrail violation detected. Keyword: {violation}.\n"
                await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                return events

            parsed_llm_response = None
            try: parsed_llm_response = json.loads(agent_response_content)
            except json.JSONDecodeError:
                logger.info("LLM response is not JSON, treating as direct agent response.", extra=current_log_extras)
                events.append(AGUIMessage(event_type="AGENT_RESPONSE", message=agent_response_content))
                await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                return events

            action = parsed_llm_response.get("action") if isinstance(parsed_llm_response, dict) else None
            plan_steps = parsed_llm_response.get("plan") if isinstance(parsed_llm_response, dict) else None
            
            logger.debug(f"Parsed LLM output: action='{action}', plan_exists='{bool(plan_steps)}'", extra=current_log_extras)

            # Handle new plan from LLM if no action is immediately present and no plan is currently being executed
            if plan_steps and isinstance(plan_steps, list) and not action and not turn_context["executed_plan_steps"]:
                logger.info(f"LLM provided a plan with {len(plan_steps)} steps.", extra=current_log_extras)
                turn_context["pending_plan_steps"] = plan_steps
                turn_context["full_interaction_log"] += f"LLM Plan Received: {json.dumps(plan_steps)}\n"
                if turn_context["pending_plan_steps"]: 
                    continue # Loop will pick up first planned action
                else: 
                    logger.warning("LLM provided an empty plan. Awaiting next action or direct response.", extra=current_log_extras)
            
            # Execute action (either from direct LLM response or from a plan step)
            if action:
                if action == "mcp_tool_call":
                    tool_name = parsed_llm_response.get("tool_name")
                    inputs = parsed_llm_response.get("inputs", {})
                    if not tool_name or not self.mcp_service.tool_registry.get_tool(tool_name):
                        logger.warning(f"LLM attempted invalid MCP tool: '{tool_name}'", extra={**current_log_extras, "tool_name": tool_name})
                        turn_context["history_for_llm"].append({"role": "user", "content": f"System: The tool '{tool_name}' is not available or your request was malformed. Please choose from the available tools or provide a direct response."})
                        turn_context["full_interaction_log"] += f"System: Invalid MCP tool request for '{tool_name}'.\n"; continue
                    
                    mcp_request = MCPToolCallRequest(tool_name=tool_name, inputs=inputs)
                    log_audit_event(db, user=current_user, action="MCP_TOOL_CALL_INITIATED", status="PENDING",
                                    resource_type="tool", resource_id=tool_name, details=mcp_request.dict())
                    events.append(AGUIMessage(event_type="TOOL_CALL_START", data=mcp_request.dict()))
                    
                    tool_response = await self.mcp_service.invoke_tool(mcp_request, current_user=current_user, db=db) 
                    log_audit_event(db, user=current_user, action="MCP_TOOL_CALL_COMPLETED", status=tool_response.status,
                                    resource_type="tool", resource_id=tool_name, details=tool_response.dict())
                    events.append(AGUIMessage(event_type="TOOL_OUTPUT", data=tool_response.dict()))
                    turn_context["full_interaction_log"] += f"MCP Tool: {tool_name}, Input: {inputs}, Output: {tool_response.output}, Status: {tool_response.status}\n"
                    logger.info(f"MCP tool '{tool_name}' status: {tool_response.status}", extra={**current_log_extras, "tool_name": tool_name, "status": tool_response.status})
                    
                    if tool_response.status != "SUCCESS":
                        msg_content = (f"System: The previous attempt to use tool '{tool_name}' with inputs {json.dumps(inputs)} "
                                       f"failed with status '{tool_response.status}' and error: {json.dumps(tool_response.output)}. "
                                       "Analyze this error and decide the next course of action. You can retry (potentially with different inputs), "
                                       "try a different tool, ask the user for clarification, or respond to the user if the goal cannot be achieved.")
                    else:
                        msg_content = f"Tool {tool_name} responded with: {json.dumps(tool_response.output)}"
                    turn_context["history_for_llm"].append({"role": "user", "content": msg_content}); continue

                elif action == "a2a_delegate":
                    target_agent_id = parsed_llm_response.get("target_agent_id")
                    task_name = parsed_llm_response.get("task_name")
                    inputs = parsed_llm_response.get("inputs", {})
                    if not target_agent_id or not task_name or not self.a2a_service.get_agent_details(target_agent_id):
                        logger.warning(f"LLM attempted invalid A2A delegation: Target '{target_agent_id}', Task '{task_name}'", extra={**current_log_extras, "target_agent_id": target_agent_id})
                        turn_context["history_for_llm"].append({"role": "user", "content": "System: Invalid A2A delegation request. Please check the agent ID and task name, then try again or choose a different action."})
                        turn_context["full_interaction_log"] += "System: Invalid A2A delegation request from LLM.\n"; continue

                    a2a_request = A2ATaskRequest(target_agent_id=target_agent_id, task_name=task_name, inputs=inputs)
                    log_audit_event(db, user=current_user, action="A2A_DELEGATION_INITIATED", status="PENDING",
                                    resource_type="agent", resource_id=target_agent_id, details=a2a_request.dict())
                    events.append(AGUIMessage(event_type="A2A_DELEGATION_START", data=a2a_request.dict()))
                    
                    a2a_response = await self.a2a_service.send_task_to_agent(a2a_request) 
                    log_audit_event(db, user=current_user, action="A2A_DELEGATION_COMPLETED", status=a2a_response.status,
                                    resource_type="agent", resource_id=target_agent_id, details=a2a_response.dict())
                    events.append(AGUIMessage(event_type="A2A_DELEGATION_RESULT", data=a2a_response.dict()))
                    turn_context["full_interaction_log"] += f"A2A Delegate: To={target_agent_id}, Task={task_name}, Input={inputs}, Status={a2a_response.status}, Output/Error={a2a_response.outputs or a2a_response.error_message}\n"
                    logger.info(f"A2A delegation to '{target_agent_id}' task '{task_name}' status: {a2a_response.status}", extra={**current_log_extras, "target_agent_id": target_agent_id, "status": a2a_response.status})

                    if a2a_response.status != "SUCCESS":
                        msg_content = (f"System: The previous attempt to delegate task '{task_name}' to agent '{target_agent_id}' with inputs {json.dumps(inputs)} "
                                       f"failed with status '{a2a_response.status}' and error: '{a2a_response.error_message}'. "
                                       "Analyze this error and decide the next course of action.")
                    else:
                        msg_content = f"Agent {target_agent_id} completed task {task_name} with output: {json.dumps(a2a_response.outputs)}"
                    turn_context["history_for_llm"].append({"role": "user", "content": msg_content}); continue
            
            # If no action and no pending plan steps, it means LLM should have given a direct response
            if not turn_context["pending_plan_steps"]:
                logger.info("LLM provided direct response or plan completed.", extra=current_log_extras)
                # agent_response_content here is the text from the last LLM call, which should be the final answer.
                events.append(AGUIMessage(event_type="AGENT_RESPONSE", message=agent_response_content))
                await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
                return events
            else: # Still pending plan steps, continue loop
                logger.info("Continuing with pending plan steps.", extra=current_log_extras)
                continue # This continue is crucial for the plan execution loop

        except Exception as e: 
            logger.error(f"Error in orchestration loop (iteration {iteration+1}) for user_id {log_context_id}: {e}", exc_info=True)
            error_message = f"Error during processing: {str(e)}"
            turn_context["full_interaction_log"] += f"Error (iteration {iteration+1}): {error_message}\n"
            log_audit_event(db, user=current_user, action="ORCHESTRATION_ERROR", status="FAILURE", details={"error": error_message, "iteration": iteration + 1})
            events.append(AGUIMessage(event_type="ERROR", message=error_message))
            await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
            return events
        
        logger.warning(f"Max iterations ({MAX_ITERATIONS_PER_TURN}) reached for user_id: {log_context_id}", extra={**log_extras_base, "user_message": user_message})
        log_audit_event(db, user=current_user, action="MAX_ITERATIONS_REACHED", status="FAILURE", details={"user_message": user_message, "iterations": MAX_ITERATIONS_PER_TURN})
        events.append(AGUIMessage(event_type="AGENT_RESPONSE", message="I'm having trouble completing your request. Please try rephrasing or breaking it down."))
        turn_context["full_interaction_log"] += "System: Max iterations reached. Ending turn with a generic message.\n"
        await self._save_turn(db, session_id, user_message, turn_context["full_interaction_log"])
        return events

orchestration_service = OrchestrationService()
```
