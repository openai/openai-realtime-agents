import asyncio
import importlib
import httpx # For HTTP tools
import logging # Import logging
from typing import Callable, Dict, Any, List
from backend.models.mcp_messages import MCPToolCallRequest, MCPToolCallResponse
from backend.models.tool_definition import MCPToolDefinition
from backend.tools.mock_weather_tool import get_weather
from backend.tools.calculator_tool import CALCULATOR_TOOL_DEFINITION
from backend.tools.notes_tool import ADD_NOTE_TOOL_DEFINITION, GET_NOTE_TOOL_DEFINITION

logger = logging.getLogger(__name__) # Get a logger for this module

# --- MCP Tool Registry ---
class MCPToolRegistry:
    def __init__(self):
        self._tools: Dict[str, MCPToolDefinition] = {}
        logger.info("MCPToolRegistry initialized.")

    def register_tool(self, tool_definition: MCPToolDefinition):
        if not isinstance(tool_definition, MCPToolDefinition):
            logger.error("Attempted to register invalid tool definition type.", extra={"definition_type": type(tool_definition)})
            raise TypeError("tool_definition must be an instance of MCPToolDefinition")
        if tool_definition.tool_name in self._tools:
            logger.warning(f"Tool '{tool_definition.tool_name}' is being re-registered.", extra={"tool_name": tool_definition.tool_name})
        self._tools[tool_definition.tool_name] = tool_definition
        logger.info(f"Tool '{tool_definition.tool_name}' registered successfully.", extra={"tool_name": tool_definition.tool_name})

    def get_tool(self, tool_name: str) -> MCPToolDefinition | None:
        return self._tools.get(tool_name)

    def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools.values())

# --- MCP Tool Service ---
class MCPToolService:
    def __init__(self, tool_registry: MCPToolRegistry):
        self.tool_registry = tool_registry
        self.http_client = httpx.AsyncClient(trust_env=False) 
        logger.info("MCPToolService initialized.")
        self._register_initial_tools()

    def _register_initial_tools(self):
        logger.info("Registering initial tools...")
        weather_tool_definition = MCPToolDefinition(
            tool_name="get_weather_tool",
            description="Gets the current weather for a specified location. Supports 'celsius' and 'fahrenheit' units.",
            input_schema={
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city name, e.g., London"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"}
                },
                "required": ["location"]
            },
            output_schema={ 
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "forecast": {"type": "string"},
                    "temperature": {"type": "string"}, 
                    "unit": {"type": "string"}
                },
                 "required": ["location", "forecast", "temperature", "unit"]
            },
            handler_type="python_function",
            handler_identifier="backend.tools.mock_weather_tool:get_weather"
        )
        self.tool_registry.register_tool(weather_tool_definition)
        self.tool_registry.register_tool(CALCULATOR_TOOL_DEFINITION)
        self.tool_registry.register_tool(ADD_NOTE_TOOL_DEFINITION)
        self.tool_registry.register_tool(GET_NOTE_TOOL_DEFINITION)
        logger.info("Initial tools registration complete.")

    async def invoke_tool(self, request: MCPToolCallRequest) -> MCPToolCallResponse:
        logger.info(f"Attempting to invoke tool: {request.tool_name}", extra={"tool_name": request.tool_name, "inputs": request.inputs})
        tool_definition = self.tool_registry.get_tool(request.tool_name)
        
        if not tool_definition:
            logger.warning(f"Tool '{request.tool_name}' not found in registry.", extra={"tool_name": request.tool_name})
            return MCPToolCallResponse(
                tool_name=request.tool_name,
                output={"error": f"Tool '{request.tool_name}' not found in registry."},
                status="ERROR_NOT_FOUND" 
            )
        
        # Optional: Input validation
        # try:
        #     from jsonschema import validate, ValidationError
        #     validate(instance=request.inputs, schema=tool_definition.input_schema)
        #     logger.debug(f"Input validation successful for tool {request.tool_name}", extra={"tool_name": request.tool_name})
        # except ValidationError as e:
        #     logger.warning(f"Input validation failed for tool {request.tool_name}: {e.message}", extra={"tool_name": request.tool_name, "validation_error": e.message})
        #     return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Input validation failed: {e.message}", "details": str(e)}, status="ERROR_VALIDATION")
        # except ImportError:
        #     logger.debug("jsonschema not installed, skipping input validation.", extra={"tool_name": request.tool_name})


        try:
            if tool_definition.handler_type == "python_function":
                module_name, function_name = tool_definition.handler_identifier.rsplit(":", 1)
                if not module_name.startswith("backend.tools."):
                     logger.error(f"Security risk: Tool function '{tool_definition.handler_identifier}' is outside the allowed 'backend.tools' module path.", extra={"handler": tool_definition.handler_identifier})
                     raise ImportError(f"Tool function '{tool_definition.handler_identifier}' is outside the allowed 'backend.tools' module path for security reasons.")
                module = importlib.import_module(module_name)
                tool_function = getattr(module, function_name)
                logger.debug(f"Invoking Python function: {tool_definition.handler_identifier}", extra={"tool_name": request.tool_name})
                if asyncio.iscoroutinefunction(tool_function):
                    output = await tool_function(**request.inputs)
                else:
                    loop = asyncio.get_running_loop()
                    output = await loop.run_in_executor(None, lambda: tool_function(**request.inputs))
            elif tool_definition.handler_type == "http_endpoint":
                logger.debug(f"Invoking HTTP endpoint: {tool_definition.handler_identifier}", extra={"tool_name": request.tool_name, "url": tool_definition.handler_identifier})
                response = await self.http_client.post(tool_definition.handler_identifier, json=request.inputs)
                response.raise_for_status() 
                output = response.json() 
            else:
                logger.error(f"Unsupported handler_type: {tool_definition.handler_type} for tool '{request.tool_name}'.", extra={"tool_name": request.tool_name, "handler_type": tool_definition.handler_type})
                raise ValueError(f"Unsupported handler_type: {tool_definition.handler_type} for tool '{request.tool_name}'.")

            # Optional: Output validation
            # try:
            #     validate(instance=output, schema=tool_definition.output_schema)
            #     logger.debug(f"Output validation successful for tool {request.tool_name}", extra={"tool_name": request.tool_name})
            # except ValidationError as e:
            #     logger.warning(f"Output validation failed for tool {request.tool_name}: {e.message}", extra={"tool_name": request.tool_name, "validation_error": e.message, "actual_output": output})
            #     return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Output validation failed: {e.message}", "actual_output": output}, status="ERROR_VALIDATION")
            # except ImportError:
            #     logger.debug("jsonschema not installed, skipping output validation.", extra={"tool_name": request.tool_name})


            logger.info(f"Tool '{request.tool_name}' invoked successfully.", extra={"tool_name": request.tool_name, "status": "SUCCESS"})
            return MCPToolCallResponse(
                tool_name=request.tool_name,
                output=output,
                status="SUCCESS"
            )
        except ImportError as e:
            logger.error(f"ImportError for tool '{request.tool_name}': {e}", exc_info=True, extra={"tool_name": request.tool_name, "handler": tool_definition.handler_identifier})
            return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Tool function configuration error: {e}"}, status="ERROR_CONFIGURATION")
        except AttributeError as e:
            logger.error(f"AttributeError for tool '{request.tool_name}': {e}", exc_info=True, extra={"tool_name": request.tool_name, "handler": tool_definition.handler_identifier})
            return MCPToolCallResponse(tool_name=request.tool_name, output={"error": f"Tool function not found in module: {e}"}, status="ERROR_CONFIGURATION")
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTPStatusError for tool '{request.tool_name}' to {e.request.url}: {e.response.status_code}", exc_info=True, extra={"tool_name": request.tool_name, "url": str(e.request.url), "status_code": e.response.status_code, "response_text": e.response.text})
            return MCPToolCallResponse(
                tool_name=request.tool_name,
                output={"error": f"HTTP tool error: {e.response.status_code}", "details": e.response.text},
                status="ERROR_HTTP"
            )
        except httpx.RequestError as e: 
            logger.error(f"RequestError for tool '{request.tool_name}' to {e.request.url}: {e}", exc_info=True, extra={"tool_name": request.tool_name, "url": str(e.request.url)})
            return MCPToolCallResponse(
                tool_name=request.tool_name,
                output={"error": f"HTTP request failed: Could not connect to {tool_definition.handler_identifier}.", "details": str(e)},
                status="ERROR_NETWORK"
            )
        except Exception as e:
            logger.error(f"Unexpected error invoking tool '{request.tool_name}': {type(e).__name__} - {e}", exc_info=True, extra={"tool_name": request.tool_name})
            return MCPToolCallResponse(
                tool_name=request.tool_name,
                output={"error": f"Tool execution failed: {type(e).__name__} - {str(e)}"},
                status="ERROR_EXECUTION"
            )

    async def close_http_client(self):
        await self.http_client.aclose()
        logger.info("MCPToolService HTTP client closed.")

# --- Service Instantiation ---
mcp_tool_registry_instance = MCPToolRegistry()
mcp_tool_service = MCPToolService(tool_registry=mcp_tool_registry_instance)

# (Removed __main__ block for brevity, it was already updated and tested in previous step)
# Conceptual notes from awesome-mcp-servers review also removed for brevity as they were noted as completed.
