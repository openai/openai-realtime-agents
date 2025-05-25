from pydantic import BaseModel, Field
from typing import Dict, Any, Literal

class MCPToolDefinition(BaseModel):
    """
    Defines the structure for registering and describing a tool
    that can be invoked by the MCPToolService.
    """
    tool_name: str = Field(..., description="Unique identifier for the tool, e.g., 'get_weather_tool'.")
    description: str = Field(..., description="Detailed description for the LLM to understand the tool's purpose and when to use it.")
    
    # JSON Schema describing the expected input parameters for the tool.
    # Example: {"type": "object", "properties": {"location": {"type": "string", "description": "City name"}}, "required": ["location"]}
    input_schema: Dict[str, Any] = Field(..., description="JSON Schema for the tool's input parameters.")
    
    # JSON Schema describing the tool's output.
    # Example: {"type": "object", "properties": {"temperature": {"type": "string"}, "forecast": {"type": "string"}}}
    output_schema: Dict[str, Any] = Field(..., description="JSON Schema for the tool's output.")
    
    handler_type: Literal["python_function", "http_endpoint"] = Field(..., description="Type of handler for the tool.")
    
    # Identifier for the handler.
    # For "python_function": "module.submodule:function_name" (e.g., "backend.tools.mock_weather_tool:get_weather").
    # For "http_endpoint": A fully qualified URL (e.g., "https://api.example.com/tools/weather").
    handler_identifier: str = Field(..., description="Identifier for the tool's handler (function path or URL).")

if __name__ == '__main__':
    # Example usage:
    example_tool_def = MCPToolDefinition(
        tool_name="get_weather_example",
        description="Fetches the current weather for a specified city.",
        input_schema={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city and state, e.g., San Francisco, CA"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"}
            },
            "required": ["location"]
        },
        output_schema={
            "type": "object",
            "properties": {
                "temperature": {"type": "string"},
                "forecast": {"type": "string"},
                "unit": {"type": "string"}
            },
            "required": ["temperature", "forecast", "unit"]
        },
        handler_type="python_function",
        handler_identifier="backend.tools.example_weather_tool:get_weather_for_city"
    )
    print(example_tool_def.json(indent=2))

    example_http_tool_def = MCPToolDefinition(
        tool_name="get_stock_price_example",
        description="Fetches the current stock price for a given symbol.",
        input_schema={
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "The stock ticker symbol, e.g., AAPL"}
            },
            "required": ["symbol"]
        },
        output_schema={
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "price": {"type": "number"},
                "currency": {"type": "string"}
            },
            "required": ["symbol", "price", "currency"]
        },
        handler_type="http_endpoint",
        handler_identifier="https://api.example.com/stocks"
    )
    print(example_http_tool_def.json(indent=2))
