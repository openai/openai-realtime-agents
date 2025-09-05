import asyncio
import importlib
import httpx 
import logging
import os 
from typing import Callable, Dict, Any, List, Optional
from sqlalchemy.orm import Session 
from backend.models.mcp_messages import MCPToolCallRequest, MCPToolCallResponse
from backend.models.tool_definition import MCPToolDefinition
from backend.security import SupabaseUser 
from backend.database import get_db 
from backend.services.audit_logging_service import log_audit_event 
from cachetools import LRUCache, cached 
from cachetools.keys import hashkey 
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor # Import httpx instrumentor

# Import specific tool definitions for registration
from backend.tools.mock_weather_tool import get_weather 
from backend.tools.calculator_tool import CALCULATOR_TOOL_DEFINITION
from backend.tools.notes_tool import ADD_NOTE_TOOL_DEFINITION, GET_NOTE_TOOL_DEFINITION
from backend.tools.admin_debug_tool import ADMIN_DEBUG_TOOL_DEFINITION

logger = logging.getLogger(__name__)

# --- MCP Tool Registry ---
class MCPToolRegistry:
    def __init__(self, max_cache_size=128):
        self._tools: Dict[str, MCPToolDefinition] = {}
        self.tool_definition_cache: LRUCache = LRUCache(maxsize=max_cache_size)
        logger.info(f"MCPToolRegistry initialized with LRUCache (maxsize={max_cache_size}).")

    def register_tool(self, tool_definition: MCPToolDefinition):
        if not isinstance(tool_definition, MCPToolDefinition):
            logger.error("Attempted to register invalid tool definition type.", extra={"definition_type": type(tool_definition)})
            raise TypeError("tool_definition must be an instance of MCPToolDefinition")
        tool_name = tool_definition.tool_name
        if tool_name in self._tools:
            logger.warning(f"Tool '{tool_name}' is being re-registered.", extra={"tool_name": tool_name})
        self._tools[tool_name] = tool_definition
        self.tool_definition_cache.clear() 
        logger.info(f"Tool '{tool_name}' registered successfully. Cache cleared.", extra={"tool_name": tool_name})

    @cached(cache=lambda self: self.tool_definition_cache, key=lambda self, tool_name: hashkey(tool_name))
    def get_tool(self, tool_name: str) -> MCPToolDefinition | None:
        logger.debug(f"MCPToolRegistry.get_tool cache miss for: {tool_name} (or first call).", extra={"tool_name": tool_name})
        return self._tools.get(tool_name)

    def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools.values())

# --- MCP Tool Service ---
class MCPToolService:
    def __init__(self, tool_registry: MCPToolRegistry):
        self.tool_registry = tool_registry
        self.http_client = httpx.AsyncClient(trust_env=False) 
        # Instrument the httpx client for OpenTelemetry
        # This should ideally be done once. If client is created/managed elsewhere (e.g. app lifespan),
        # instrument it there. If created here, this is the place.
        HTTPXClientInstrumentor.instrument_client(self.http_client)
        logger.info("MCPToolService initialized and HTTPXClientInstrumentor applied.")
        self._register_initial_tools()

    def _register_initial_tools(self):
        logger.info("Registering initial tools...")
        weather_tool_definition = MCPToolDefinition(
            tool_name="get_weather_tool",
            description="Gets the current weather for a specified location. Supports 'celsius' and 'fahrenheit' units. Requires an API key for full access.",
            input_schema={ 
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city name, e.g., London"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"}
                }, "required": ["location"]
            },
            output_schema={ 
                "type": "object", "properties": {
                    "location": {"type": "string"}, "forecast": {"type": "string"},
                    "temperature": {"type": "string"}, "unit": {"type": "string"},
                    "source": {"type": "string"}, 
                    "error_message": {"type": "string", "description": "Error message if API key was invalid or data could not be fetched."} 
                }, "required": ["location", "forecast", "temperature", "unit", "source"] 
            },
            handler_type="python_function",
            handler_identifier="backend.tools.mock_weather_tool:get_weather",
            required_credentials=["MOCK_WEATHER_TOOL_API_KEY"] 
        )
        self.tool_registry.register_tool(weather_tool_definition)
        self.tool_registry.register_tool(CALCULATOR_TOOL_DEFINITION) 
        self.tool_registry.register_tool(ADD_NOTE_TOOL_DEFINITION)    
        self.tool_registry.register_tool(GET_NOTE_TOOL_DEFINITION)   
        
        admin_def = ADMIN_DEBUG_TOOL_DEFINITION
        if admin_def.required_role is None: 
            admin_def = admin_def.copy(update={"required_role": "admin"})
        self.tool_registry.register_tool(admin_def)
        logger.info(f"Tool '{admin_def.tool_name}' registered with required_role='{admin_def.required_role}'.")
        logger.info("Initial tools registration complete.")

    async def invoke_tool(self, request: MCPToolCallRequest, current_user: Optional[SupabaseUser] = None, db: Optional[Session] = None) -> MCPToolCallResponse:
        log_extras = {
            "tool_name": request.tool_name, "inputs": request.inputs,
            "user_id": current_user.id if current_user else None,
            "user_role": current_user.role if current_user else "anonymous"
        }
        logger.info(f"Attempting to invoke tool: {request.tool_name}", extra=log_extras)
        tool_definition = self.tool_registry.get_tool(request.tool_name)
        
        audit_details_base = {"tool_name": request.tool_name, "inputs": request.inputs}

        if not tool_definition:
            logger.warning(f"Tool '{request.tool_name}' not found.", extra=log_extras)
            if db: log_audit_event(db, user=current_user, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_NOT_FOUND", resource_type="tool", resource_id=request.tool_name, details={**audit_details_base, "error": "Tool not found"})
            return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Tool '{request.tool_name}' not found."}, status="ERROR_NOT_FOUND")
        
        if tool_definition.required_role:
            user_role = current_user.role if current_user else None
            is_authorized = (user_role == tool_definition.required_role) or (user_role == "admin")
            if not is_authorized:
                logger.warning(f"Auth failed for tool '{request.tool_name}'. User role '{user_role}' vs required '{tool_definition.required_role}'.", extra=log_extras)
                if db: log_audit_event(db, user=current_user, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_FORBIDDEN", resource_type="tool", resource_id=request.tool_name, details={**audit_details_base, "required_role": tool_definition.required_role, "actual_role": user_role})
                return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Access denied. Role '{tool_definition.required_role}' required."}, status="ERROR_FORBIDDEN")
            logger.debug(f"User role '{user_role}' authorized for tool '{request.tool_name}'.", extra=log_extras)

        tool_inputs = request.inputs.copy()
        if tool_definition.required_credentials:
            for cred_env_var_name in tool_definition.required_credentials:
                cred_value = os.getenv(cred_env_var_name)
                if not cred_value:
                    logger.error(f"Credential env var '{cred_env_var_name}' for tool '{request.tool_name}' not set.", extra={**log_extras, "credential_name": cred_env_var_name})
                    if db: log_audit_event(db, user=current_user, action="MCP_TOOL_INVOKE_ATTEMPT", status="ERROR_CONFIGURATION", resource_type="tool", resource_id=request.tool_name, details={**audit_details_base, "error": f"Missing credential: {cred_env_var_name}"})
                    return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Config error: Credential '{cred_env_var_name}' missing."}, status="ERROR_CONFIGURATION")
                kwarg_name = cred_env_var_name.split("_TOOL_")[-1].lower() if "_TOOL_" in cred_env_var_name else cred_env_var_name.lower()
                tool_inputs[kwarg_name] = cred_value 
                logger.debug(f"Injected credential '{cred_env_var_name}' as kwarg '{kwarg_name}'.", extra={**log_extras, "credential_name": cred_env_var_name})
        
        try:
            output: Any = None 
            if tool_definition.handler_type == "python_function":
                module_name, function_name = tool_definition.handler_identifier.rsplit(":", 1)
                if not module_name.startswith("backend.tools."):
                     logger.error(f"Security risk: Tool function '{tool_definition.handler_identifier}' outside 'backend.tools'.", extra={**log_extras, "handler": tool_definition.handler_identifier})
                     raise ImportError(f"Tool function '{tool_definition.handler_identifier}' is outside allowed 'backend.tools' path.")
                module = importlib.import_module(module_name)
                tool_function = getattr(module, function_name)
                logger.debug(f"Invoking Python function: {tool_definition.handler_identifier}", extra=log_extras)
                if asyncio.iscoroutinefunction(tool_function):
                    output = await tool_function(**tool_inputs)
                else:
                    loop = asyncio.get_running_loop()
                    output = await loop.run_in_executor(None, lambda: tool_function(**tool_inputs))
            elif tool_definition.handler_type == "http_endpoint":
                logger.debug(f"Invoking HTTP endpoint: {tool_definition.handler_identifier}", extra={**log_extras, "url": tool_definition.handler_identifier})
                # self.http_client is already instrumented
                response = await self.http_client.post(tool_definition.handler_identifier, json=tool_inputs) 
                response.raise_for_status() 
                output = response.json() 
            else:
                logger.error(f"Unsupported handler_type: {tool_definition.handler_type} for tool '{request.tool_name}'.", extra={**log_extras, "handler_type": tool_definition.handler_type})
                raise ValueError(f"Unsupported handler_type: {tool_definition.handler_type} for tool '{request.tool_name}'.")

            logger.info(f"Tool '{request.tool_name}' invoked successfully.", extra={**log_extras, "status": "SUCCESS"})
            return MCPToolCallResponse(tool_name=request.tool_name, output=output, status="SUCCESS")
        
        except Exception as e:
            status_code = "ERROR_EXECUTION"
            if isinstance(e, ImportError): status_code = "ERROR_CONFIGURATION"
            elif isinstance(e, AttributeError): status_code = "ERROR_CONFIGURATION"
            elif isinstance(e, httpx.HTTPStatusError): status_code = "ERROR_HTTP"
            elif isinstance(e, httpx.RequestError): status_code = "ERROR_NETWORK"
            
            error_output = {"error": f"Tool execution failed: {type(e).__name__} - {str(e)}"}
            if isinstance(e, httpx.HTTPStatusError):
                error_output = {"error": f"HTTP error: {e.response.status_code}", "details": e.response.text}
            elif isinstance(e, httpx.RequestError):
                error_output = {"error": f"HTTP request failed to connect: {tool_definition.handler_identifier}.", "details": str(e)}
            
            logger.error(f"Error invoking tool '{request.tool_name}': {type(e).__name__} - {e}", exc_info=True, extra=log_extras)
            return MCPToolCallResponse(tool_name=request.tool_name, output=error_output, status=status_code)

    async def close_http_client(self):
        await self.http_client.aclose()
        logger.info("MCPToolService HTTP client closed.")

# --- Service Instantiation ---
mcp_tool_registry_instance = MCPToolRegistry()
mcp_tool_service = MCPToolService(tool_registry=mcp_tool_registry_instance)
```
