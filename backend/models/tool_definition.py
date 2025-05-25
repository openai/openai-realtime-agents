from pydantic import BaseModel, Field
from typing import Dict, Any, Literal, Optional, List

class MCPToolDefinition(BaseModel):
    """
    Defines the structure for registering and describing a tool
    that can be invoked by the MCPToolService.
    """
    tool_name: str = Field(..., description="Unique identifier for the tool, e.g., 'get_weather_tool'.")
    description: str = Field(..., description="Detailed description for the LLM to understand the tool's purpose and when to use it.")
    
    input_schema: Dict[str, Any] = Field(..., description="JSON Schema for the tool's input parameters, as expected from the LLM.")
    output_schema: Dict[str, Any] = Field(..., description="JSON Schema for the tool's output.")
    
    handler_type: Literal["python_function", "http_endpoint"] = Field(..., description="Type of handler for the tool.")
    handler_identifier: str = Field(..., description="Identifier for the tool's handler (e.g., 'module.submodule:function_name' or a URL).")
    
    required_credentials: Optional[List[str]] = Field(None, 
        description="Optional list of environment variable names that hold credentials required by this tool. These credentials will be injected by the MCPToolService."
    )
    
    # New field for RBAC: specifies the minimum role required to use this tool.
    # If None, the tool is considered public (accessible by any authenticated user).
    # Example: "admin", "user", "editor"
    required_role: Optional[str] = Field(None, 
        description="Optional minimum user role required to execute this tool. If None, accessible by any authenticated user."
    )


if __name__ == '__main__':
    example_weather_tool_def_with_creds_and_role = MCPToolDefinition(
        tool_name="get_weather_premium_admin",
        description="Fetches the current weather for a specified city using a premium service. ADMIN ACCESS.",
        input_schema={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city and state, e.g., San Francisco, CA"},
            },
            "required": ["location"]
        },
        output_schema={
            "type": "object",
            "properties": {"temperature": {"type": "string"}, "forecast": {"type": "string"}},
            "required": ["temperature", "forecast"]
        },
        handler_type="python_function",
        handler_identifier="backend.tools.mock_weather_tool:get_weather",
        required_credentials=["MOCK_WEATHER_TOOL_API_KEY"],
        required_role="admin" # This tool now requires 'admin' role
    )
    print("--- Weather Tool with Credentials and Role Example ---")
    print(example_weather_tool_def_with_creds_and_role.json(indent=2))

    example_public_tool_def = MCPToolDefinition(
        tool_name="calculator_public",
        description="Calculates a simple arithmetic expression. Publicly accessible.",
        input_schema={"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]},
        output_schema={"type": "object", "properties": {"result": {"type": "number"}}},
        handler_type="python_function",
        handler_identifier="backend.tools.calculator_tool:calculate",
        required_role=None # Explicitly public, or omit for same effect
    )
    print("\n--- Public Calculator Tool Example ---")
    print(example_public_tool_def.json(indent=2))
