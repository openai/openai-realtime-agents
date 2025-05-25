# from backend.models.tool_definition import MCPToolDefinition # Not strictly needed in the tool file itself

def get_weather(location: str, unit: str = "celsius", api_key: str = None) -> dict:
    """
    Simulates fetching weather for a given location using a conceptual API key.
    Supports 'celsius' and 'fahrenheit' units.
    If api_key is provided and matches "test_weather_key", it returns detailed weather.
    Otherwise, a basic response or an indication of failed authentication is returned.
    """
    # In a real tool, the logger would be imported from logging_config or obtained via logging.getLogger
    print(f"mock_weather_tool: Getting weather for {location} in {unit.lower()} units. API key provided: {'Yes' if api_key else 'No'}")

    # Conceptual API key validation
    if api_key == "test_weather_key": # This key would be loaded from env in MCPToolService
        temperature_c = "25" 
        temperature_f = "77"
        forecast_detail = "sunny with clear skies"
        
        current_temp = temperature_c if unit.lower() == "celsius" else temperature_f
        
        print(f"mock_weather_tool: Valid API key used. Returning premium data for {location}.")
        return {
            "location": location, 
            "forecast": forecast_detail, 
            "temperature": current_temp,
            "unit": unit.lower(),
            "source": "Premium Weather Service (Authenticated)"
        }
    else:
        # Basic response or indication of failed auth if key was expected but wrong/missing
        error_message_detail = "Missing or invalid API key for premium data. Showing basic data." if api_key else "No API key provided. Showing basic data."
        print(f"mock_weather_tool: Invalid or missing API key. Reason: '{error_message_detail}'. Returning basic data for {location}.")
        return {
            "location": location,
            "forecast": "partly cloudy",
            "temperature": "22" if unit.lower() == "celsius" else "72",
            "unit": unit.lower(),
            "source": "Basic Weather Service",
            "error_message": error_message_detail 
        }

if __name__ == '__main__':
    print("--- Mock Weather Tool Direct Call Tests ---")
    
    print("\nTest 1: With valid API key (Celsius)")
    print(get_weather(location="London", unit="celsius", api_key="test_weather_key"))
    
    print("\nTest 2: With valid API key (Fahrenheit)")
    print(get_weather(location="New York", unit="fahrenheit", api_key="test_weather_key"))

    print("\nTest 3: With invalid API key")
    print(get_weather(location="Paris", api_key="wrong_key"))

    print("\nTest 4: Without API key")
    print(get_weather(location="Tokyo"))

    # Example of how its MCPToolDefinition might look (defined in mcp_tool_service.py)
    # weather_tool_definition = MCPToolDefinition(
    #     tool_name="get_weather_tool",
    #     description="Gets the current weather for a specified location. Supports 'celsius' and 'fahrenheit' units. Requires an API key for full access.",
    #     input_schema={
    #         "type": "object",
    #         "properties": {
    #             "location": {"type": "string", "description": "The city name, e.g., London"},
    #             "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"}
    #             # api_key is NOT part of the input_schema from LLM. It's injected by MCPToolService.
    #         },
    #         "required": ["location"]
    #     },
    #     output_schema={ ... }, # Define expected output
    #     handler_type="python_function",
    #     handler_identifier="backend.tools.mock_weather_tool:get_weather",
    #     requires_credentials=["MOCK_WEATHER_TOOL_API_KEY"] # New conceptual field
    # )
```
