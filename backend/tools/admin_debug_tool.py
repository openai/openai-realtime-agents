import os
import logging
from backend.models.tool_definition import MCPToolDefinition

logger = logging.getLogger(__name__)

def get_system_status() -> dict:
    """
    (Admin Only) Returns mock system status information.
    This tool is intended for administrative/debugging purposes.
    """
    logger.info("admin_debug_tool: get_system_status called.", extra={"tool_name": "admin_debug_tool"})
    # In a real scenario, this would fetch actual system metrics, configurations, etc.
    return {
        "service_status": "OK",
        "active_connections": 15, # Example data
        "cpu_load_percent": 35.5, # Example data
        "memory_usage_mb": 512,   # Example data
        "version": "0.2.1-alpha", # Example data
        "log_level": os.environ.get("LOG_LEVEL", "N/A"),
        "message": "System is operating normally. This is an admin-only debug tool."
    }

# --- Tool Definition ---
ADMIN_DEBUG_TOOL_DEFINITION = MCPToolDefinition(
    tool_name="admin_debug_tool",
    description="(Admin Only) Retrieves current system status and diagnostic information. Requires admin privileges.",
    input_schema={ # No specific inputs needed from LLM for this mock tool
        "type": "object",
        "properties": {} 
    },
    output_schema={
        "type": "object",
        "properties": {
            "service_status": {"type": "string"},
            "active_connections": {"type": "integer"},
            "cpu_load_percent": {"type": "number"},
            "memory_usage_mb": {"type": "integer"},
            "version": {"type": "string"},
            "log_level": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["service_status", "version", "message"]
    },
    handler_type="python_function",
    handler_identifier="backend.tools.admin_debug_tool:get_system_status"
    # `required_credentials` is not needed for this tool.
    # RBAC will be handled by MCPToolService based on user role.
)

if __name__ == '__main__':
    # Test the function
    status = get_system_status()
    print("System Status:")
    for key, value in status.items():
        print(f"  {key}: {value}")

    print("\nTool Definition:")
    print(ADMIN_DEBUG_TOOL_DEFINITION.json(indent=2))
```
