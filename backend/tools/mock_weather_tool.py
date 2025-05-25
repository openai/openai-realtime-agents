def get_weather(location: str, unit: str = "celsius") -> dict:
    """
    Simulates fetching weather for a given location.
    Supports 'celsius' and 'fahrenheit' units.
    """
    print(f"mock_weather_tool: Getting weather for {location} in {unit.lower()} units.")
    # Simulate some processing time
    # import time
    # time.sleep(1)
    
    temperature_c = "25°C"
    temperature_f = "77°F"
    
    current_temp = temperature_c if unit.lower() == "celsius" else temperature_f
    
    return {
        "location": location, 
        "forecast": "sunny", 
        "temperature": current_temp.split("°")[0], # Return just the number part for consistency
        "unit": unit.lower()
    }

if __name__ == '__main__':
    print(get_weather(location="London"))
    print(get_weather(location="Paris", unit="fahrenheit"))
    print(get_weather(location="Tokyo", unit="CELSIUS"))
